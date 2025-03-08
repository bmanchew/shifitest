
import fetch from 'node-fetch';
import { logger } from './logger';

/**
 * Service to interact with the Consumer Financial Protection Bureau's
 * Consumer Complaint Database API
 */
export class CFPBService {
  private readonly baseUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/';

  /**
   * Get complaints related to a specific financial product
   */
  async getComplaintsByProduct(product: string, options: {
    dateReceivedMin?: string;
    dateReceivedMax?: string;
    size?: number;
    state?: string;
    issue?: string;
  } = {}) {
    try {
      const params = new URLSearchParams();
      
      // Add product filter
      params.append('product', product);
      
      // Add optional parameters
      if (options.dateReceivedMin) params.append('date_received_min', options.dateReceivedMin);
      if (options.dateReceivedMax) params.append('date_received_max', options.dateReceivedMax);
      if (options.size) params.append('size', options.size.toString());
      if (options.state) params.append('state', options.state);
      if (options.issue) params.append('issue', options.issue);
      
      // Format should be JSON
      params.append('format', 'json');

      logger.info({
        message: 'Fetching CFPB complaints',
        category: 'api',
        source: 'cfpb',
        metadata: { product, ...options }
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`CFPB API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      logger.info({
        message: 'Successfully fetched CFPB complaints',
        category: 'api',
        source: 'cfpb',
        metadata: { 
          product,
          complaintsCount: data.hits?.total || 0
        }
      });
      
      return data;
    } catch (error) {
      logger.error({
        message: `Failed to fetch CFPB complaints: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'cfpb',
        metadata: {
          error: error instanceof Error ? error.stack : null,
          product
        }
      });
      
      throw error;
    }
  }

  /**
   * Get complaints related to a specific company
   */
  async getComplaintsByCompany(company: string, options: {
    dateReceivedMin?: string;
    dateReceivedMax?: string;
    size?: number;
    product?: string;
    issue?: string;
  } = {}) {
    try {
      const params = new URLSearchParams();
      
      // Add company filter
      params.append('company', company);
      
      // Add optional parameters
      if (options.dateReceivedMin) params.append('date_received_min', options.dateReceivedMin);
      if (options.dateReceivedMax) params.append('date_received_max', options.dateReceivedMax);
      if (options.size) params.append('size', options.size.toString());
      if (options.product) params.append('product', options.product);
      if (options.issue) params.append('issue', options.issue);
      
      // Format should be JSON
      params.append('format', 'json');

      logger.info({
        message: 'Fetching CFPB complaints for company',
        category: 'api',
        source: 'cfpb',
        metadata: { company, ...options }
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`CFPB API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      logger.info({
        message: 'Successfully fetched CFPB complaints for company',
        category: 'api',
        source: 'cfpb',
        metadata: { 
          company,
          complaintsCount: data.hits?.total || 0
        }
      });
      
      return data;
    } catch (error) {
      logger.error({
        message: `Failed to fetch CFPB complaints for company: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'cfpb',
        metadata: {
          error: error instanceof Error ? error.stack : null,
          company
        }
      });
      
      throw error;
    }
  }

  /**
   * Get industry trends based on complaints data
   */
  async getIndustryTrends(options: {
    product?: string;
    dateReceivedMin?: string;
    dateReceivedMax?: string;
    size?: number;
  } = {}) {
    try {
      const params = new URLSearchParams();
      
      // Add optional parameters
      if (options.product) params.append('product', options.product);
      if (options.dateReceivedMin) params.append('date_received_min', options.dateReceivedMin);
      if (options.dateReceivedMax) params.append('date_received_max', options.dateReceivedMax);
      if (options.size) params.append('size', options.size.toString());
      
      // We want aggregations
      params.append('no_aggs', 'false');
      
      // Format should be JSON
      params.append('format', 'json');

      logger.info({
        message: 'Fetching CFPB industry trends',
        category: 'api',
        source: 'cfpb',
        metadata: options
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`CFPB API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      logger.info({
        message: 'Successfully fetched CFPB industry trends',
        category: 'api',
        source: 'cfpb',
        metadata: { 
          product: options.product || 'all',
          aggregationsReceived: !!data._meta?.has_data?.aggregations
        }
      });
      
      return data;
    } catch (error) {
      logger.error({
        message: `Failed to fetch CFPB industry trends: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'cfpb',
        metadata: {
          error: error instanceof Error ? error.stack : null,
          options
        }
      });
      
      throw error;
    }
  }
}

export const cfpbService = new CFPBService();
