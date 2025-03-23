
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
    try {
      const params = new URLSearchParams({
        product: 'consumer loan',
        sub_product: 'personal loan',
        date_received_min: '2023-01-01',
        date_received_max: new Date().toISOString().split('T')[0],
        size: '100',
        sort: 'date_received:desc',
        field: 'date_received,sub_product,issue,complaint_what_happened'
      });
      return this.getCFPBData(params);
    } catch (error) {
      logger.error({
        message: `Error fetching personal loan complaints: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'cfpb',
        metadata: { error: error instanceof Error ? error.stack : null }
      });
      throw error;
    }
  }

  async getMerchantCashAdvanceComplaints() {
    try {
      // Use the correct search terms for merchant cash advance
      const params = new URLSearchParams({
        search_term: 'merchant cash advance',
        date_received_min: '2023-01-01',
        date_received_max: new Date().toISOString().split('T')[0],
        size: '100',
        sort: 'date_received:desc',
        field: 'date_received,sub_product,issue,complaint_what_happened'
      });
      return this.getCFPBData(params);
    } catch (error) {
      logger.error({
        message: `Error fetching merchant cash advance complaints: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'cfpb',
        metadata: { error: error instanceof Error ? error.stack : null }
      });
      throw error;
    }
  }
  
  async getComplaintTrends() {
    try {
      // Fetch both types of complaints in parallel
      const [personalLoanComplaints, merchantCashAdvanceComplaints] = await Promise.all([
        this.getPersonalLoanComplaints(),
        this.getMerchantCashAdvanceComplaints()
      ]);
      
      // Log what we got from the API
      logger.info({
        message: 'Successfully fetched complaint trends data',
        category: 'api',
        source: 'cfpb',
        metadata: {
          personalLoanCount: personalLoanComplaints?.hits?.total || 0,
          merchantCashAdvanceCount: merchantCashAdvanceComplaints?.hits?.total || 0
        }
      });
      
      return {
        personalLoans: personalLoanComplaints || { hits: { total: 0, hits: [] } },
        merchantCashAdvance: merchantCashAdvanceComplaints || { hits: { total: 0, hits: [] } }
      };
    } catch (error) {
      logger.error({
        message: `Error fetching complaint trends: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'cfpb',
        metadata: { error: error instanceof Error ? error.stack : null }
      });
      
      // Instead of propagating the error, return empty results
      return {
        personalLoans: { hits: { total: 0, hits: [] } },
        merchantCashAdvance: { hits: { total: 0, hits: [] } },
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export const cfpbService = new CFPBService();
