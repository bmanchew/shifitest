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
      params.append('field', 'consumer_consented');
      params.append('field', 'consumer_disputed');
      params.append('field', 'consumer_complaint_narrative');
      params.append('field', 'tags');

      // Add required parameters for the CFPB API
      params.append('size', '1000'); // Get maximum results
      params.append('no_aggs', 'false'); // Enable aggregations
      params.append('format', 'json');

      logger.info({
        message: 'Fetching CFPB complaint data',
        category: 'api',
        source: 'internal',
        metadata: { params: params.toString() }
      });

      const response = await axios.get(`${this.baseUrl}?${params.toString()}`, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.data || !response.data.hits) {
        throw new Error('Invalid response format from CFPB API');
      }

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