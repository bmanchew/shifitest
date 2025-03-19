import axios from 'axios';
import { logger } from './logger';

export class CFPBService {
  private baseUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1';

  async getCFPBData(params = new URLSearchParams()) {
    try {
      // Add standard fields we want to retrieve
      const fields = [
        'date_received',
        'product',
        'sub_product',
        'issue',
        'sub_issue',
        'company',
        'state',
        'complaint_what_happened',
        'company_response',
        'consumer_disputed',
        'consumer_complaint_narrative'
      ];

      fields.forEach(field => params.append('field', field));

      // Add required parameters for aggregations
      params.append('size', '0');
      params.append('no_aggs', 'false');
      params.append('format', 'json');
      
      // Set exact date range from March 19, 2023 to March 19, 2025
      const endDate = new Date('2025-03-19');
      const startDate = new Date('2023-03-19');
      
      params.append('date_received_min', startDate.toISOString().split('T')[0]);
      params.append('date_received_max', endDate.toISOString().split('T')[0]);
      params.append('agg', 'date_received');
      params.append('agg_term_type', 'month');

      // Add product filter if not present
      if (!params.has('product')) {
        params.append('product', 'personal loan');
      }

      // Add date range if not present
      if (!params.has('date_received_min')) {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        params.append('date_received_min', twoYearsAgo.toISOString().split('T')[0]);
      }

      logger.info({
        message: 'Fetching CFPB complaint data',
        category: 'api',
        source: 'cfpb',
        metadata: { params: params.toString() }
      });

      const response = await axios.get(`${this.baseUrl}?${params.toString()}`, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
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
          params: params.toString()
        }
      });
      throw error;
    }
  }

  async getPersonalLoanComplaints() {
    const params = new URLSearchParams();
    params.append('product', 'personal loan');
    return this.getCFPBData(params);
  }
}

export const cfpbService = new CFPBService();