
import axios from 'axios';
import { logger } from './logger';

export class CFPBService {
  private baseUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/';

  async getCFPBData(params = new URLSearchParams()) {
    try {
      // Only set format as base param
      const baseParams = {
        format: 'json'
      };

      // Merge base params with any custom params
      Object.entries(baseParams).forEach(([key, value]) => {
        if (!params.has(key)) {
          params.append(key, value);
        }
      });

      logger.info({
        message: 'Fetching CFPB complaint data',
        category: 'api',
        source: 'cfpb',
        metadata: { params: params.toString() }
      });

      const response = await axios.get(`${this.baseUrl}?${params.toString()}`, {
        timeout: 30000,
        headers: { 'Accept': 'application/json' }
      });

      if (!response.data) {
        throw new Error('Empty response from CFPB API');
      }

      return response.data;
    } catch (error) {
      logger.error({
        message: `Error fetching CFPB data: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'cfpb',
        metadata: {
          error: error instanceof Error ? error.stack : null,
          params: params.toString(),
          response: axios.isAxiosError(error) ? error.response?.data : null
        }
      });
      throw error;
    }
  }

  async getPersonalLoanComplaints() {
    const params = new URLSearchParams({
      product: 'Personal loan',
      date_received_min: '2023-01-01',
      date_received_max: new Date().toISOString().split('T')[0],
      size: '100',
      sort: 'date_received:desc',
      field: ['date_received', 'sub_product', 'issue', 'complaint_what_happened']
    });
    return this.getCFPBData(params);
  }

  async getMerchantCashAdvanceComplaints() {
    const params = new URLSearchParams({
      product: 'merchant cash advance',
      date_received_min: '2023-01-01',
      date_received_max: new Date().toISOString().split('T')[0],
      size: '100',
      sort: 'date_received:desc',
      field: ['date_received', 'sub_product', 'issue', 'complaint_what_happened']
    });
    return this.getCFPBData(params);
  }
  
  async getComplaintTrends() {
    try {
      const personalLoanComplaints = await this.getPersonalLoanComplaints();
      const merchantCashAdvanceComplaints = await this.getMerchantCashAdvanceComplaints();
      
      return {
        personalLoans: personalLoanComplaints,
        merchantCashAdvance: merchantCashAdvanceComplaints
      };
    } catch (error) {
      logger.error({
        message: `Error fetching complaint trends: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'cfpb',
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
      throw error;
    }
  }
}

export const cfpbService = new CFPBService();
