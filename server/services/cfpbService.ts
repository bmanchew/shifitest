
import axios from 'axios';
import { logger } from './logger';

export class CFPBService {
  private baseUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/';

  async getCFPBData(params = new URLSearchParams()) {
    try {
      // Use minimal verified parameters
      const baseParams = {
        product: 'Personal loan',
        date_received_min: '2023-03-19',
        date_received_max: '2024-03-18',
        size: '0',
        agg: 'date_received',
        agg_term_type: 'month',
        format: 'json',
        no_aggs: 'false'
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
          response: error.response?.data
        }
      });
      throw error;
    }
  }

  async getPersonalLoanComplaints() {
    const params = new URLSearchParams({
      product: 'Personal loan',
      date_received_min: '2023-03-19',
      date_received_max: '2024-03-18',
      agg: 'date_received',
      agg_term_type: 'month',
      size: '0',
      no_aggs: 'false',
      format: 'json'
    });
    return this.getCFPBData(params);
  }
}

export const cfpbService = new CFPBService();
