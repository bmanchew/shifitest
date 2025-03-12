import fetch, { RequestInit, Response } from 'node-fetch';
import { logger } from './logger';

// Extended RequestInit interface to include timeout
interface ExtendedRequestInit extends RequestInit {
  timeout?: number;
}

// Delay utility function for retry mechanism
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Service to interact with the Consumer Financial Protection Bureau's
 * Consumer Complaint Database API
 */
export class CFPBService {
  private readonly baseUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/';
  private readonly maxRetries = 3; // Maximum number of retry attempts
  
  /**
   * Helper method to fetch data from CFPB API with retry logic for throttling
   * @param url The complete URL to fetch
   * @param options Fetch options
   * @returns Response object and response text
   */
  private async fetchWithRetry(url: string, options: ExtendedRequestInit): Promise<{response: Response, text: string}> {
    let retries = 0;
    let lastError: Error | null = null;
    
    while (retries <= this.maxRetries) {
      try {
        const response = await fetch(url, options);
        const text = await response.text();
        
        // Check if we got a throttling response
        if (response.status === 429 || 
            (text.includes("throttled") && text.includes("Request was throttled"))) {
          
          // Extract the wait time if available
          let waitTime = 2000 * Math.pow(2, retries); // Default exponential backoff
          
          // Try to parse the wait time from response if available
          const waitTimeMatch = text.match(/Expected available in (\d+) seconds/);
          if (waitTimeMatch && waitTimeMatch[1]) {
            const seconds = parseInt(waitTimeMatch[1], 10);
            waitTime = (seconds + 1) * 1000; // Convert to ms and add a little buffer
          }
          
          logger.info({
            message: `CFPB API request throttled, retrying in ${waitTime/1000} seconds...`,
            category: 'api',
            source: 'internal',
            metadata: { 
              retryCount: retries + 1, 
              maxRetries: this.maxRetries,
              waitTimeMs: waitTime,
              url
            }
          });
          
          // Wait before retrying
          await delay(waitTime);
          retries++;
          continue;
        }
        
        // If not throttled, return the response
        return { response, text };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Only retry on network errors or timeouts
        if (error instanceof Error && 
            (error.message.includes('timeout') || 
             error.message.includes('network') ||
             error.message.includes('ECONNRESET'))) {
          
          const waitTime = 1000 * Math.pow(2, retries);
          
          logger.info({
            message: `CFPB API network error, retrying in ${waitTime/1000} seconds...`,
            category: 'api',
            source: 'internal',
            metadata: { 
              retryCount: retries + 1, 
              maxRetries: this.maxRetries,
              error: error.message,
              url
            }
          });
          
          await delay(waitTime);
          retries++;
          continue;
        }
        
        // Other errors should be thrown immediately
        throw error;
      }
    }
    
    // If we've exhausted all retries
    throw lastError || new Error('Failed to fetch data after multiple retries');
  }
  
  /**
   * Get complaints related to a specific financial product
   */
  async getComplaintsByProduct(product: string, options: {
    dateReceivedMin?: string;
    dateReceivedMax?: string;
    size?: number;
    state?: string;
    issue?: string;
    subProduct?: string;
    searchTerm?: string;
  } = {}) {
    try {
      const params = new URLSearchParams();

      // According to CFPB API docs, we need to use the correct product parameter
      // The CFPB API accepts direct URL parameters
      params.append('product', product);
      
      // Add specific sub-product if provided - use direct parameter
      if (options.subProduct) {
        params.append('sub_product', options.subProduct);
      }

      // Set date range
      // Use date parameters properly formatted according to CFPB documentation
      if (options.dateReceivedMin) params.append('date_received_min', options.dateReceivedMin);
      // Set today as the max date if not provided
      if (options.dateReceivedMax) {
        params.append('date_received_max', options.dateReceivedMax);
      } else {
        // Default to current date if not specified
        const today = new Date().toISOString().split('T')[0];
        params.append('date_received_max', today);
      }
      
      // Set result size (default is small, we want more data)
      params.append('size', (options.size || 1000).toString());
      
      // Add other filters if provided
      if (options.state) params.append('state', options.state);
      if (options.issue) params.append('issue', options.issue);
      
      // Add searchTerm for free-text searching
      // This allows us to find mentions of specific terms in complaint narratives
      if (options.searchTerm) {
        params.append('search_term', options.searchTerm);
        // When using search_term, we need to ensure the complaint_what_happened field is included
        params.append('field', 'complaint_what_happened');
        // Also search company name for relevant terms
        params.append('field', 'company');
        // And include issue field
        params.append('field', 'issue');
      }

      // Format should be JSON
      params.append('format', 'json');
      
      // Add required fields for better data
      params.append('field', 'product');
      params.append('field', 'sub_product');
      params.append('field', 'issue');
      params.append('field', 'date_received');
      params.append('field', 'company');
      
      // Request aggregations for analysis
      params.append('no_aggs', 'false');

      logger.info({
        message: 'Fetching CFPB complaints',
        category: 'api',
        source: 'internal',
        metadata: { product, subProduct: options.subProduct, ...options }
      });

      // Handle the request with better error logging
      try {
        const requestUrl = `${this.baseUrl}?${params.toString()}`;
        logger.info({
          message: 'CFPB API request URL',
          category: 'api',
          source: 'internal',
          metadata: { url: requestUrl }
        });
        
        const fetchOptions: ExtendedRequestInit = {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Financial-Platform/1.0'
          },
          timeout: 15000 // 15 second timeout
        };
        
        // Use fetchWithRetry instead of direct fetch
        const { response, text: responseText } = await this.fetchWithRetry(requestUrl, fetchOptions);
        
        if (!response.ok) {
          logger.error({
            message: `CFPB API returned error status: ${response.status}`,
            category: 'api',
            source: 'internal',
            metadata: { 
              status: response.status,
              statusText: response.statusText,
              responseText: responseText.substring(0, 500), // Log first 500 chars to avoid overly large logs
              requestUrl
            }
          });
          throw new Error(`CFPB API error: ${response.status} ${response.statusText}`);
        }
        
        // Check if response is valid JSON
        try {
          // Check if the response seems to be HTML instead of JSON
          if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            logger.error({
              message: `CFPB API returned HTML instead of JSON`,
              category: 'api',
              source: 'internal',
              metadata: {
                responsePreview: responseText.substring(0, 500),
                contentType: response.headers.get('content-type'),
                requestUrl
              }
            });
            // Don't return mock data - throw an error to ensure data integrity
            logger.error({
              message: 'CFPB API returned HTML instead of JSON - this is likely an error with the API',
              category: 'api',
              source: 'internal'
            });
            throw new Error('CFPB API returned HTML instead of JSON data');
          }
          
          const data = JSON.parse(responseText);
          
          // Improve handling of different response formats from CFPB API
          let complaintsCount = 0;
          let hasHits = false;
          
          // Check for different response formats
          if (data.hits && typeof data.hits.total === 'number') {
            complaintsCount = data.hits.total;
            hasHits = true;
          } else if (data.hits && typeof data.hits.total === 'object' && data.hits.total.value) {
            // Handle Elasticsearch 7+ format where total is an object like { value: 123, relation: "eq" }
            complaintsCount = data.hits.total.value;
            hasHits = true;
          } else if (Array.isArray(data) && data.length > 0) {
            // Handle array response format
            complaintsCount = data.length;
            hasHits = true;
          }
          
          logger.info({
            message: 'Successfully fetched CFPB complaints',
            category: 'api',
            source: 'internal',
            metadata: { 
              product,
              complaintsCount,
              hasAggregations: !!data.aggregations,
              hasHits,
              responsePreview: JSON.stringify(data).substring(0, 500), // Log first 500 chars of response
              hitsSample: data.hits?.hits?.length > 0 ? JSON.stringify(data.hits.hits[0]).substring(0, 300) : 'No hits',
              responseType: Array.isArray(data) ? 'array' : 'object',
              hasHitsProperty: !!data.hits,
              totalType: data.hits?.total ? (typeof data.hits.total) : 'undefined'
            }
          });
          
          return data;
        } catch (parseError) {
          logger.error({
            message: `Failed to parse CFPB API response as JSON`,
            category: 'api',
            source: 'internal',
            metadata: {
              parseError: parseError instanceof Error ? parseError.message : String(parseError),
              responsePreview: responseText.substring(0, 500),
              requestUrl
            }
          });
          throw new Error(`Invalid JSON response from CFPB API: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      } catch (fetchError) {
        logger.error({
          message: `Fetch error when calling CFPB API`,
          category: 'api',
          source: 'internal',
          metadata: {
            error: fetchError instanceof Error ? fetchError.message : String(fetchError)
          }
        });
        throw fetchError;
      }
    } catch (error) {
      logger.error({
        message: `Failed to fetch CFPB complaints: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.stack : null,
          product
        }
      });
      
      // Throw the error to ensure proper error handling
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

      // Add company filter - use direct parameter instead of search_term syntax
      params.append('company', company);

      // Add optional parameters using the direct parameter format
      if (options.dateReceivedMin) params.append('date_received_min', options.dateReceivedMin);
      if (options.dateReceivedMax) params.append('date_received_max', options.dateReceivedMax);
      if (options.size) params.append('size', options.size.toString());
      if (options.product) params.append('product', options.product);
      if (options.issue) params.append('issue', options.issue);

      // Format should be JSON
      params.append('format', 'json');
      
      // Request aggregations for analysis
      params.append('no_aggs', 'false');
      
      // Add field parameters
      params.append('field', 'company');
      params.append('field', 'issue');
      params.append('field', 'product');
      params.append('field', 'date_received');
      params.append('field', 'sub_product');

      logger.info({
        message: 'Fetching CFPB complaints for company',
        category: 'api',
        source: 'internal',
        metadata: { company, ...options }
      });

      // Create full request URL for logging
      const requestUrl = `${this.baseUrl}?${params.toString()}`;
      logger.info({
        message: 'CFPB API company request URL',
        category: 'api',
        source: 'internal',
        metadata: { url: requestUrl }
      });

      const fetchOptions: ExtendedRequestInit = {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Financial-Platform/1.0'
        },
        timeout: 15000 // 15 second timeout
      };
      
      // Use fetchWithRetry instead of direct fetch
      const { response, text: responseText } = await this.fetchWithRetry(requestUrl, fetchOptions);
      
      if (!response.ok) {
        logger.error({
          message: `CFPB API returned error status: ${response.status}`,
          category: 'api',
          source: 'internal',
          metadata: { 
            status: response.status,
            statusText: response.statusText,
            responseText: responseText.substring(0, 500),
            requestUrl
          }
        });
        throw new Error(`CFPB API error: ${response.status} ${response.statusText}`);
      }
      
      // Check for valid JSON
      try {
        // Check if the response is HTML
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
          logger.error({
            message: `CFPB API returned HTML instead of JSON`,
            category: 'api',
            source: 'internal',
            metadata: {
              responsePreview: responseText.substring(0, 500),
              contentType: response.headers.get('content-type'),
              requestUrl
            }
          });
          // Don't return mock data - throw an error to ensure data integrity
          logger.error({
            message: 'CFPB API returned HTML instead of JSON - this is likely an error with the API',
            category: 'api',
            source: 'internal'
          });
          throw new Error('CFPB API returned HTML instead of JSON data');
        }
        
        const data = JSON.parse(responseText);
        
        // Improve handling of different response formats
        let complaintsCount = 0;
        let hasHits = false;
        
        // Check for different response formats
        if (data.hits && typeof data.hits.total === 'number') {
          complaintsCount = data.hits.total;
          hasHits = true;
        } else if (data.hits && typeof data.hits.total === 'object' && data.hits.total.value) {
          // Handle Elasticsearch 7+ format where total is an object like { value: 123, relation: "eq" }
          complaintsCount = data.hits.total.value;
          hasHits = true;
        } else if (Array.isArray(data) && data.length > 0) {
          // Handle array response format
          complaintsCount = data.length;
          hasHits = true;
        }
        
        logger.info({
          message: 'Successfully fetched CFPB complaints for company',
          category: 'api',
          source: 'internal',
          metadata: { 
            company,
            complaintsCount,
            hasAggregations: !!data.aggregations,
            hasHits,
            responsePreview: JSON.stringify(data).substring(0, 500), // Log first 500 chars of response
            hitsSample: data.hits?.hits?.length > 0 ? JSON.stringify(data.hits.hits[0]).substring(0, 300) : 'No hits',
            responseType: Array.isArray(data) ? 'array' : 'object',
            hasHitsProperty: !!data.hits,
            totalType: data.hits?.total ? (typeof data.hits.total) : 'undefined'
          }
        });
        
        return data;
      } catch (parseError) {
        logger.error({
          message: `Failed to parse CFPB API response as JSON`,
          category: 'api',
          source: 'internal',
          metadata: {
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
            responsePreview: responseText.substring(0, 500),
            requestUrl
          }
        });
        throw new Error(`Invalid JSON response from CFPB API: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    } catch (error) {
      logger.error({
        message: `Failed to fetch CFPB complaints for company: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.stack : null,
          company
        }
      });

      // Throw the error to ensure proper error handling
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

      // Add optional parameters with direct parameter approach
      if (options.product) params.append('product', options.product);
      if (options.dateReceivedMin) params.append('date_received_min', options.dateReceivedMin);
      if (options.dateReceivedMax) params.append('date_received_max', options.dateReceivedMax);
      if (options.size) params.append('size', options.size.toString());

      // We want aggregations for trend analysis
      params.append('no_aggs', 'false');

      // Format should be JSON
      params.append('format', 'json');
      
      // Fields to include in the response
      params.append('field', 'company');
      params.append('field', 'date_received');
      params.append('field', 'issue');
      params.append('field', 'product');
      params.append('field', 'sub_product');
      params.append('field', 'sub_issue');
      params.append('field', 'state');
      
      // Use trends endpoint for this call
      const trendsUrl = this.baseUrl.replace(/\/$/, '') + '/trends';

      logger.info({
        message: 'Fetching CFPB industry trends',
        category: 'api',
        source: 'internal',
        metadata: options
      });

      // Create full request URL for logging
      const requestUrl = `${trendsUrl}?${params.toString()}`;
      logger.info({
        message: 'CFPB API trends request URL',
        category: 'api',
        source: 'internal',
        metadata: { url: requestUrl }
      });

      const fetchOptions: ExtendedRequestInit = {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Financial-Platform/1.0'
        },
        timeout: 15000 // 15 second timeout
      };
      
      // Use fetchWithRetry instead of direct fetch
      const { response, text: responseText } = await this.fetchWithRetry(requestUrl, fetchOptions);
      
      if (!response.ok) {
        logger.error({
          message: `CFPB API returned error status: ${response.status}`,
          category: 'api',
          source: 'internal',
          metadata: { 
            status: response.status,
            statusText: response.statusText,
            responseText: responseText.substring(0, 500),
            requestUrl
          }
        });
        throw new Error(`CFPB API error: ${response.status} ${response.statusText}`);
      }
      
      // Check for valid JSON
      try {
        // Check if the response is HTML
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
          logger.error({
            message: `CFPB API returned HTML instead of JSON`,
            category: 'api',
            source: 'internal',
            metadata: {
              responsePreview: responseText.substring(0, 500),
              contentType: response.headers.get('content-type'),
              requestUrl
            }
          });
          // Don't return mock data - throw an error to ensure data integrity
          logger.error({
            message: 'CFPB API returned HTML instead of JSON - this is likely an error with the API',
            category: 'api',
            source: 'internal'
          });
          throw new Error('CFPB API returned HTML instead of JSON data');
        }
        
        const data = JSON.parse(responseText);
        
        // Improve handling of different response formats
        let complaintsCount = 0;
        let hasHits = false;
        
        // Check for different response formats
        if (data.hits && typeof data.hits.total === 'number') {
          complaintsCount = data.hits.total;
          hasHits = true;
        } else if (data.hits && typeof data.hits.total === 'object' && data.hits.total.value) {
          // Handle Elasticsearch 7+ format where total is an object like { value: 123, relation: "eq" }
          complaintsCount = data.hits.total.value;
          hasHits = true;
        } else if (Array.isArray(data) && data.length > 0) {
          // Handle array response format
          complaintsCount = data.length;
          hasHits = true;
        } else if (data.trends && Array.isArray(data.trends)) {
          // Special handling for trends data which has a different format
          complaintsCount = data.trends.length;
          hasHits = true;
        }
        
        logger.info({
          message: 'Successfully fetched CFPB industry trends',
          category: 'api',
          source: 'internal',
          metadata: { 
            complaintsCount,
            hasAggregations: !!data.aggregations,
            hasTrends: !!data.trends,
            hasHits,
            dataStructure: Object.keys(data).join(', '),
            responsePreview: JSON.stringify(data).substring(0, 500), // Log first 500 chars of response
            hitsSample: data.hits?.hits?.length > 0 ? JSON.stringify(data.hits.hits[0]).substring(0, 300) : 'No hits',
            responseType: Array.isArray(data) ? 'array' : 'object',
            hasHitsProperty: !!data.hits,
            totalType: data.hits?.total ? (typeof data.hits.total) : 'undefined'
          }
        });
        
        return data;
      } catch (parseError) {
        logger.error({
          message: `Failed to parse CFPB API response as JSON`,
          category: 'api',
          source: 'internal',
          metadata: {
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
            responsePreview: responseText.substring(0, 500),
            requestUrl
          }
        });
        throw new Error(`Invalid JSON response from CFPB API: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    } catch (error) {
      logger.error({
        message: `Failed to fetch CFPB industry trends: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });

      // Throw the error to ensure proper error handling
      throw error;
    }
  }
}

// Export a singleton instance
export const cfpbService = new CFPBService();