import axios from 'axios';
import { logger } from './logger';

class PreFiService {
  private apiKey: string;
  private apiBaseUrl: string;
  
  constructor() {
    this.apiKey = process.env.PREFI_API_KEY || '';
    this.apiBaseUrl = 'https://pre-fi.com/api/v2';
    
    if (!this.apiKey) {
      logger.warn({
        message: "Pre-Fi API key not found in environment variables",
        category: "api",
        source: "prefi"
      });
    } else {
      logger.info({
        message: "Pre-Fi service initialized with API key",
        category: "system",
        source: "prefi"
      });
    }
  }
  
  async getCreditReport(ssn: string, firstName: string, lastName: string, dob: string, address: any) {
    try {
      if (!this.apiKey) {
        throw new Error('Pre-Fi API key not configured');
      }
      
      const response = await axios.post(
        `${this.apiBaseUrl}/credit/report`,
        {
          ssn,
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dob,
          address
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error({
        message: "Error getting credit report from Pre-Fi API",
        category: "api",
        source: "prefi",
        metadata: { 
          error: error instanceof Error ? error.stack : String(error),
          firstName,
          lastName
        }
      });
      throw error;
    }
  }
  
  /**
   * Send user data to Pre-Fi for pre-qualification after successful KYC verification
   * 
   * @param userData User data from database or KYC verification
   * @param ipAddress IP address of the user when they consented (required by Pre-Fi)
   * @returns Pre-qualification results from Pre-Fi API
   */
  async preQualifyUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    contractId?: number;
    userId?: number;
  }, ipAddress: string) {
    try {
      if (!this.apiKey) {
        throw new Error('Pre-Fi API key not configured');
      }
      
      // Validate required fields
      if (!userData.firstName || !userData.lastName || !userData.email || !userData.phone) {
        throw new Error('Missing required user data for pre-qualification');
      }
      
      // Format phone number (remove any non-digits)
      const formattedPhone = userData.phone.replace(/\D/g, '');
      
      // Format the date exactly as the PreFi API expects
      const now = new Date();
      // Format like: "2024-10-16T09:50:38-0700"
      // Get timezone offset in minutes
      const tzOffset = now.getTimezoneOffset();
      const tzOffsetHours = Math.abs(Math.floor(tzOffset / 60)).toString().padStart(2, '0');
      const tzOffsetMinutes = Math.abs(tzOffset % 60).toString().padStart(2, '0');
      const tzSign = tzOffset > 0 ? '-' : '+';
      
      // Format the date parts
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      
      // Assemble the date string in the required format
      const consentDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzOffsetHours}${tzOffsetMinutes}`;
      
      // Prepare the request payload according to Pre-Fi API documentation
      const requestPayload = {
        FirstName: userData.firstName,
        LastName: userData.lastName,
        Email: userData.email,
        Phone: formattedPhone,
        ConsentDate: consentDate, // Using the exact format from the Postman example
        ConsentIP: ipAddress || '127.0.0.1', // Use provided IP or default
      };
      
      // Log the request being sent
      console.log('Sending Pre-Fi pre-qualification request:', JSON.stringify(requestPayload, null, 2));
      
      logger.info({
        message: "Sending pre-qualification request to Pre-Fi API",
        category: "api",
        source: "prefi",
        metadata: {
          userId: userData.userId,
          contractId: userData.contractId,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          requestPayload: requestPayload
        }
      });
      
      // Call Pre-Fi API
      const response = await axios.post(
        `${this.apiBaseUrl}/pre-qualification`,
        requestPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Log the full response
      console.log('Pre-Fi API Response:', JSON.stringify(response.data, null, 2));
      
      // Log success response
      logger.info({
        message: "Received pre-qualification response from Pre-Fi API",
        category: "api",
        source: "prefi",
        metadata: {
          userId: userData.userId,
          contractId: userData.contractId,
          responseStatus: response.data.Status,
          responseCode: response.data.Code,
          offersCount: response.data.Offers?.length || 0,
          fullResponse: response.data // Log the entire response
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error in Pre-Fi pre-qualification:', error);
      
      logger.error({
        message: "Error sending pre-qualification request to Pre-Fi API",
        category: "api",
        source: "prefi",
        metadata: { 
          error: error instanceof Error ? error.stack : String(error),
          userId: userData.userId,
          contractId: userData.contractId,
          firstName: userData.firstName,
          lastName: userData.lastName,
          errorDetails: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }
  
  /**
   * Check if Pre-Fi API is accessible and account is authorized
   * @returns Whether the API connection is valid
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }
      
      const response = await axios.get(
        `${this.apiBaseUrl}/ping`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          }
        }
      );
      
      // Log ping response
      console.log('Pre-Fi Ping Response:', JSON.stringify(response.data, null, 2));
      
      return response.data?.Status === 'Success';
    } catch (error) {
      console.error('Error pinging Pre-Fi API:', error);
      
      logger.error({
        message: "Error pinging Pre-Fi API",
        category: "api",
        source: "prefi",
        metadata: { 
          error: error instanceof Error ? error.stack : String(error),
        }
      });
      return false;
    }
  }
  
  calculateCreditTier(creditScore: number, totalPoints: number): 'tier1' | 'tier2' | 'tier3' | 'declined' {
    if (creditScore >= 720 && totalPoints >= 22 && totalPoints <= 30) {
      return 'tier1';
    } else if (creditScore >= 660 && creditScore <= 719 && totalPoints >= 15 && totalPoints <= 21) {
      return 'tier2';
    } else if (creditScore >= 620 && creditScore <= 659 && totalPoints >= 6 && totalPoints <= 14) {
      return 'tier3';
    } else {
      return 'declined';
    }
  }
  
  calculateAnnualIncomePoints(annualIncome: number): number {
    if (annualIncome >= 100000) return 5;
    if (annualIncome >= 75000) return 4;
    if (annualIncome >= 50000) return 3;
    if (annualIncome >= 35000) return 2;
    if (annualIncome >= 25000) return 1;
    return 0;
  }
  
  calculateEmploymentHistoryPoints(months: number): number {
    if (months >= 60) return 5;  // 5+ years
    if (months >= 36) return 4;  // 3+ years
    if (months >= 24) return 3;  // 2+ years
    if (months >= 12) return 2;  // 1+ year
    if (months >= 6) return 1;   // 6+ months
    return 0;
  }
  
  calculateCreditScorePoints(score: number): number {
    if (score >= 750) return 5;
    if (score >= 720) return 4;
    if (score >= 690) return 3;
    if (score >= 660) return 2;
    if (score >= 620) return 1;
    return 0;
  }
  
  calculateDtiRatioPoints(dtiRatio: number): number {
    if (dtiRatio <= 0.2) return 5;  // 20% or less
    if (dtiRatio <= 0.3) return 4;  // 30% or less
    if (dtiRatio <= 0.4) return 3;  // 40% or less
    if (dtiRatio <= 0.5) return 2;  // 50% or less
    if (dtiRatio <= 0.6) return 1;  // 60% or less
    return 0;
  }
  
  calculateHousingStatusPoints(status: string, paymentHistoryMonths: number): number {
    // Base points by housing status
    let basePoints = 0;
    if (status === 'own') basePoints = 4;
    else if (status === 'mortgage') basePoints = 3;
    else if (status === 'rent') basePoints = 2;
    else if (status === 'other') basePoints = 1;
    
    // Add 1 point for 12+ months of on-time payments
    if (paymentHistoryMonths >= 12) {
      return Math.min(basePoints + 1, 5);
    }
    
    return basePoints;
  }
  
  calculateDelinquencyPoints(delinquencyHistory: any): number {
    if (!delinquencyHistory || Object.keys(delinquencyHistory).length === 0) {
      return 5; // No delinquencies
    }
    
    const latePayments30 = delinquencyHistory.late30 || 0;
    const latePayments60 = delinquencyHistory.late60 || 0;
    const latePayments90 = delinquencyHistory.late90 || 0;
    
    if (latePayments90 > 0) return 0;
    if (latePayments60 > 1) return 1;
    if (latePayments60 === 1) return 2;
    if (latePayments30 > 2) return 2;
    if (latePayments30 === 2) return 3;
    if (latePayments30 === 1) return 4;
    
    return 5; // No late payments
  }
}

export const preFiService = new PreFiService();