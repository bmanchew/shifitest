
import axios from 'axios';
import { logger } from './logger';

class PreFiService {
  private apiKey: string;
  private apiBaseUrl: string;
  
  constructor() {
    this.apiKey = process.env.PREFI_API_KEY || '';
    this.apiBaseUrl = 'https://api.prefi.com/v2'; // Replace with actual API base URL
    
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
        metadata: { error }
      });
      throw error;
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
    // This is a simplified example
    // In a real system, you'd have more detailed analysis
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
