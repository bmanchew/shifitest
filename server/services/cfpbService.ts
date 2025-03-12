import axios from 'axios';
import { logger } from './logger';

export class CFPBService {
  private baseUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/';

  async getCFPBData(params = new URLSearchParams()) {
    try {
      // Add standard fields that we always want to retrieve
      params.append('field', 'date_received');
      params.append('field', 'product');
      params.append('field', 'sub_product');
      params.append('field', 'issue');
      params.append('field', 'sub_issue');
      params.append('field', 'company');
      params.append('field', 'state');
      params.append('field', 'complaint_what_happened');
      params.append('field', 'company_response');
      params.append('field', 'consumer_consented'); // Added to ensure consent data is included
      params.append('field', 'consumer_disputed'); // Added to ensure dispute data is included
      params.append('field', 'consumer_complaint_narrative'); // Added to get consumer narrative
      params.append('field', 'tags'); // Get any tags that might identify the consumer

      logger.info({
        message: 'Fetching CFPB complaint data',
        category: 'api',
        source: 'internal',
        metadata: { params: params.toString() }
      });

      const response = await axios.get(`${this.baseUrl}?${params.toString()}`);
      return response.data;
    } catch (error) {
      logger.error({
        message: `Error fetching CFPB data: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'internal',
        metadata: { error: error instanceof Error ? error.stack : null }
      });
      throw error;
    }
  }
}

export const cfpbService = new CFPBService();