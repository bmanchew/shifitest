import axios from 'axios';
import { logger } from './logger';

export class CFPBService {
  private baseUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/';

  async getCFPBData(params = new URLSearchParams()) {
    try {
      const fields = [
        'date_received', 'product', 'sub_product', 'issue', 'sub_issue',
        'company', 'state', 'complaint_what_happened', 'company_response',
        'consumer_disputed', 'consumer_complaint_narrative'
      ];

      fields.forEach(field => params.append('field', field));

      params.append('size', '0');
      params.append('no_aggs', 'false');
      params.append('format', 'json');
      params.append('agg', 'date_received');
      params.append('agg_term_type', 'month');

      // Set date range to past 24 months from today
      const startDate = new Date('2023-03-19').toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      params.set('date_received_min', startDate);
      params.set('date_received_max', endDate);

      if (!params.has('product')) {
        params.append('product', 'Personal loan');
      }

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
          params: params.toString()
        }
      });
      throw error;
    }
  }

  async getPersonalLoanComplaints() {
    const params = new URLSearchParams({ product: 'Personal loan' });
    return this.getCFPBData(params);
  }
}

export const cfpbService = new CFPBService();