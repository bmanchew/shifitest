import axios from 'axios';
import { logger } from '../logger';

interface PreFiPreQualification {
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  ConsentDate: string; // Format: YYYY-MM-DDThh:mm:ssTZD
  ConsentIP: string;
}

interface PreFiOffer {
  Name: string;
  Score: string;
  Details: string;
  Status: string;
  Amount: string;
  Contingencies: string;
}

interface PreFiDataPerfection {
  Emails?: string[];
  Phones?: string[];
  Bankruptcy?: string[];
  Addresses?: {
    Address: string;
    City: string;
    State: string;
    Zip: string;
  }[];
  DOB?: {
    Age: string;
  };
  Income?: {
    Estimate: string;
  };
}

interface PreFiResponse {
  Status: string;
  Code: string;
  Offers?: PreFiOffer[];
  DataPerfection?: PreFiDataPerfection;
  Errors?: string[];
}

class PreFiService {
  private baseUrl: string;
  private accessToken: string | null;
  private initialized: boolean;

  constructor() {
    this.baseUrl = process.env.PREFI_BASE_URL || 'https://pre-fi.com/api/v2';
    this.accessToken = process.env.PREFI_ACCESS_TOKEN || null;
    this.initialized = !!this.accessToken;

    if (!this.initialized) {
      logger.warn({
        message: 'Pre-Fi service not properly configured: missing access token',
        category: 'system',
        source: 'prefi',
      });
    }
  }

  /**
   * Check if the Pre-Fi service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Set the access token for the Pre-Fi API
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
    this.initialized = true;
  }

  /**
   * Test the Pre-Fi API connection
   */
  async ping(): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('Pre-Fi service not initialized');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/ping`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.data.Status === 'Success';
    } catch (error) {
      logger.error({
        message: `Pre-Fi ping failed: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'prefi',
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      return false;
    }
  }

  /**
   * Pre-qualify a customer via the Pre-Fi API
   */
  async preQualify(customerData: PreFiPreQualification): Promise<PreFiResponse> {
    if (!this.isInitialized()) {
      throw new Error('Pre-Fi service not initialized');
    }

    try {
      logger.info({
        message: 'Submitting pre-qualification request to Pre-Fi',
        category: 'api',
        source: 'prefi',
        metadata: {
          customerEmail: customerData.Email,
          customerName: `${customerData.FirstName} ${customerData.LastName}`,
        },
      });

      const response = await axios.post(
        `${this.baseUrl}/pre-qualification`,
        customerData,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info({
        message: 'Received pre-qualification response from Pre-Fi',
        category: 'api',
        source: 'prefi',
        metadata: {
          status: response.data.Status,
          customerEmail: customerData.Email,
          offersCount: response.data.Offers?.length || 0,
        },
      });

      return response.data;
    } catch (error) {
      logger.error({
        message: `Pre-Fi pre-qualification failed: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'prefi',
        metadata: {
          customerEmail: customerData.Email,
          customerName: `${customerData.FirstName} ${customerData.LastName}`,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }

  /**
   * Parse credit score from Pre-Fi offers
   * @returns Credit score or null if not found
   */
  parseCreditScore(preFiResponse: PreFiResponse): number | null {
    if (!preFiResponse.Offers || preFiResponse.Offers.length === 0) {
      return null;
    }

    // Try to extract credit score from the first offer
    const firstOffer = preFiResponse.Offers[0];
    if (firstOffer.Score) {
      const score = parseInt(firstOffer.Score, 10);
      return isNaN(score) ? null : score;
    }

    return null;
  }

  /**
   * Parse annual income from Pre-Fi data perfection
   * @returns Annual income estimate in number format or null if not found
   */
  parseAnnualIncome(preFiResponse: PreFiResponse): number | null {
    if (!preFiResponse.DataPerfection?.Income?.Estimate) {
      return null;
    }

    // Extract the income estimate, removing non-numeric characters except decimal points
    const incomeStr = preFiResponse.DataPerfection.Income.Estimate.replace(/[^0-9.]/g, '');
    const income = parseFloat(incomeStr);
    return isNaN(income) ? null : income;
  }

  /**
   * Extract all useful data from Pre-Fi response for credit evaluation
   */
  extractCreditData(preFiResponse: PreFiResponse): {
    creditScore: number | null;
    annualIncome: number | null;
    bankrupctyDates: string[] | null;
    age: number | null;
  } {
    const creditScore = this.parseCreditScore(preFiResponse);
    const annualIncome = this.parseAnnualIncome(preFiResponse);
    
    // Extract age
    let age = null;
    if (preFiResponse.DataPerfection?.DOB?.Age) {
      const ageValue = parseInt(preFiResponse.DataPerfection.DOB.Age, 10);
      age = isNaN(ageValue) ? null : ageValue;
    }
    
    // Extract bankruptcy dates
    const bankrupctyDates = preFiResponse.DataPerfection?.Bankruptcy || null;

    return {
      creditScore,
      annualIncome,
      bankrupctyDates,
      age
    };
  }
}

// Create a singleton instance
export const preFiService = new PreFiService();