
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
          complaintsCount: data.hits?.total || 0
        }
      });
      
      return data;
    } catch (error) {
      logger.error({
        message: `Failed to fetch CFPB industry trends: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'cfpb',
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
      
      throw error;
    }
  }

  /**
   * Get mock complaint trends data for demo purposes
   * This is used when we can't connect to the real CFPB API
   */
  getMockComplaintTrends() {
    // Generate random data for the charts
    const generateMonthlyData = () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months.map(month => ({
        month,
        complaints: Math.floor(Math.random() * 100) + 20
      }));
    };

    const generateTopIssues = () => {
      const issues = [
        'Getting a loan', 
        'Problem with interest rate', 
        'Application denied', 
        'Payment problems', 
        'Credit limit changed'
      ];
      
      return issues.map(issue => ({
        issue,
        count: Math.floor(Math.random() * 200) + 50
      }));
    };

    const generateTopCompanies = () => {
      const companies = [
        'Big Bank Co.', 
        'Finance Express', 
        'Credit Corp', 
        'Lending Tree', 
        'First Capital'
      ];
      
      return companies.map(company => ({
        company,
        count: Math.floor(Math.random() * 150) + 30
      }));
    };

    const generateInsights = () => {
      return [
        'Complaints about payment problems have increased by 12% over the last quarter',
        'Application denial issues are trending downward in most states',
        'Interest rate complaints spike during the 3rd quarter of each year',
        'First-time borrowers file 35% more complaints than repeat customers'
      ];
    };

    const generateRecommendations = () => {
      return [
        'Consider more flexible payment terms for borrowers with seasonal income',
        'Review interest rate increase notification practices for clarity',
        'Application process needs better explanation of qualification criteria',
        'Review customer communication regarding credit limits'
      ];
    };

    return {
      lastUpdated: new Date().toISOString(),
      totalComplaints: 2547,
      personalLoans: {
        totalComplaints: 1258,
        topIssues: generateTopIssues(),
        topCompanies: generateTopCompanies(),
        monthlyTrend: generateMonthlyData(),
      },
      creditCards: {
        totalComplaints: 1289,
        topIssues: generateTopIssues(),
        topCompanies: generateTopCompanies(),
        monthlyTrend: generateMonthlyData(),
      },
      insights: generateInsights(),
      recommendedUnderwritingAdjustments: generateRecommendations(),
    };
  }
}

// Export a singleton instance
export const cfpbService = new CFPBService();
