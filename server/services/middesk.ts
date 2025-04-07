import axios from 'axios';
import { logger } from './logger';

/**
 * MidDesk service for business verification
 *
 * This service integrates with MidDesk API for business verification during merchant signup:
 * - Creating business verification requests
 * - Retrieving verification results
 * - Processing webhooks
 */

// Interface for our simplified business verification data
interface BusinessVerificationData {
  legalName: string;
  ein: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber?: string;
  businessType?: string;
  website?: string;
}

// Define MidDesk API response interfaces
interface MiddeskBusiness {
  id: string;
  object: string;
  created_at: string;
  updated_at: string;
  name: string;
  website: string;
  tax_id: string;
  phone: string;
  formation_state: string;
  formation_date: string;
  status: 'pending' | 'reviewing' | 'completed' | 'archived' | 'reopened';
  subscriptions: {
    id: string;
    object: string;
    name: string;
    status: string;
  }[];
  addresses: {
    id: string;
    object: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    address_type: string;
  }[];
  persons: {
    id: string;
    object: string;
    first_name: string;
    last_name: string;
    email: string;
    title: string;
    address: {
      line1: string;
      line2: string | null;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    } | null;
  }[];
}

interface MiddeskBusinessCreateParams {
  name: string;
  tax_id?: string;
  formation_state?: string;
  website?: string;
  addresses?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country?: string;
    address_type?: string;
  }[];
  persons?: {
    first_name: string;
    last_name: string;
    email?: string;
    title?: string;
    address?: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country?: string;
    };
  }[];
  phone?: string;
  external_id?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

class MiddeskService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private initialized: boolean;

  constructor() {
    this.apiKey = process.env.MIDDESK_API_KEY || '';
    this.baseUrl = 'https://api.middesk.com/v1';
    this.initialized = !!this.apiKey;

    if (!this.initialized) {
      logger.warn({
        message: 'MidDesk service failed to initialize: Missing API key',
        category: 'system',
        source: 'middesk'
      });
    } else {
      logger.info({
        message: 'MidDesk service initialized successfully',
        category: 'system',
        source: 'middesk'
      });
    }
  }

  /**
   * Check if the MidDesk service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create a business verification request with MidDesk
   * @param params Business information for verification
   * @returns Business verification object or null on failure
   */
  async createBusinessVerification(params: MiddeskBusinessCreateParams): Promise<MiddeskBusiness | null> {
    if (!this.isInitialized()) {
      logger.error({
        message: 'Cannot create business verification: MidDesk service not initialized',
        category: 'api',
        source: 'middesk',
        metadata: { businessName: params.name }
      });
      return null;
    }

    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/businesses`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        data: params
      });

      logger.info({
        message: 'MidDesk business verification created successfully',
        category: 'api',
        source: 'middesk',
        metadata: {
          businessId: response.data.id,
          businessName: params.name,
          status: response.data.status
        }
      });

      return response.data;
    } catch (error) {
      let errorMessage = 'Unknown error';
      let errorDetails = {};

      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data?.error?.message || 'API error';
        errorDetails = {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        };
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      logger.error({
        message: `Failed to create MidDesk business verification: ${errorMessage}`,
        category: 'api',
        source: 'middesk',
        metadata: {
          businessName: params.name,
          errorDetails
        }
      });

      return null;
    }
  }

  /**
   * Get business verification status from MidDesk
   * @param businessId The ID of the business in MidDesk
   * @returns Business verification object or null on failure
   */
  async getBusinessVerificationStatus(businessId: string): Promise<MiddeskBusiness | null> {
    if (!this.isInitialized()) {
      logger.error({
        message: 'Cannot get business verification: MidDesk service not initialized',
        category: 'api',
        source: 'middesk',
        metadata: { businessId }
      });
      return null;
    }

    try {
      const response = await axios({
        method: 'get',
        url: `${this.baseUrl}/businesses/${businessId}`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info({
        message: 'Retrieved MidDesk business verification status',
        category: 'api',
        source: 'middesk',
        metadata: {
          businessId,
          status: response.data.status
        }
      });

      return response.data;
    } catch (error) {
      let errorMessage = 'Unknown error';
      let errorDetails = {};

      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data?.error?.message || 'API error';
        errorDetails = {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        };
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      logger.error({
        message: `Failed to get MidDesk business verification status: ${errorMessage}`,
        category: 'api',
        source: 'middesk',
        metadata: {
          businessId,
          errorDetails
        }
      });

      return null;
    }
  }

  /**
   * Convert a verification status from MidDesk to our internal status
   * @param middeskStatus MidDesk status string
   * @returns Internal status string
   */
  mapVerificationStatus(middeskStatus: string): 'pending' | 'verified' | 'failed' {
    switch (middeskStatus) {
      case 'completed':
        return 'verified';
      case 'pending':
      case 'reviewing':
      case 'reopened':
        return 'pending';
      default:
        return 'failed';
    }
  }

  /**
   * Check if business verification shows the business as legitimate
   * @param verification MidDesk business verification object
   * @returns True if business verification confirms legitimacy
   */
  isBusinessVerified(verification: MiddeskBusiness): boolean {
    // Business is considered verified if status is completed
    // In a production environment, you would likely have more sophisticated logic here
    // based on the verification subscriptions and their results
    return verification.status === 'completed';
  }

  /**
   * Submit a business for verification using our simplified data format
   * This converts our internal data format to MidDesk's expected format
   * @param data Business details to verify
   * @returns MidDesk business verification object or null on failure
   */
  async submitBusinessVerification(data: BusinessVerificationData): Promise<MiddeskBusiness | null> {
    if (!this.isInitialized()) {
      logger.error({
        message: 'Cannot submit business verification: MidDesk service not initialized',
        category: 'api',
        source: 'middesk',
        metadata: { businessName: data.legalName }
      });
      return null;
    }

    // Map our data format to MidDesk's expected format
    const params: MiddeskBusinessCreateParams = {
      name: data.legalName,
      tax_id: data.ein,
      phone: data.phoneNumber,
      website: data.website,
      addresses: [
        {
          line1: data.addressLine1,
          line2: data.addressLine2,
          city: data.city,
          state: data.state,
          postal_code: data.zipCode,
          country: 'US',
          address_type: 'business'
        }
      ]
    };

    try {
      logger.info({
        message: 'Submitting business for MidDesk verification',
        category: 'api',
        source: 'middesk',
        metadata: {
          businessName: data.legalName,
          ein: data.ein ? `${data.ein.substring(0, 2)}...` : 'Not provided' // Log only partial EIN for privacy
        }
      });

      // Use our existing method to create the verification
      return await this.createBusinessVerification(params);
    } catch (error) {
      logger.error({
        message: `Failed to submit business verification: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'middesk',
        metadata: {
          businessName: data.legalName,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      return null;
    }
  }
  /**
   * Get business details with formatted verification status
   * @param businessId The ID of the business in MidDesk
   * @returns Formatted business details or null on failure
   */
  async getBusinessDetails(businessId: string): Promise<any | null> {
    try {
      const verification = await this.getBusinessVerificationStatus(businessId);
      
      if (!verification) {
        return null;
      }
      
      return {
        status: verification.status,
        isVerified: this.isBusinessVerified(verification),
        lastUpdated: verification.updated_at,
        details: {
          name: verification.name,
          tax_id: verification.tax_id ? `${verification.tax_id.substring(0, 2)}...` : null, // Partial for privacy
          website: verification.website,
          phone: verification.phone,
          formation_state: verification.formation_state,
          formation_date: verification.formation_date,
          addresses: verification.addresses,
          subscriptions: verification.subscriptions,
          created_at: verification.created_at,
          updated_at: verification.updated_at
        }
      };
    } catch (error) {
      logger.error({
        message: `Failed to get business details: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'middesk',
        metadata: {
          businessId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      return null;
    }
  }

  /**
   * Initiate business verification process
   * @param businessData Business data from merchant profile
   * @returns Response with businessId if successful
   */
  async initiateBusinessVerification(businessData: any): Promise<{ businessId: string } | null> {
    try {
      // Format the business data for verification
      const verificationData: BusinessVerificationData = {
        legalName: businessData.legalName || '',
        ein: businessData.ein || '',
        addressLine1: businessData.address?.line1 || '',
        addressLine2: businessData.address?.line2 || '',
        city: businessData.address?.city || '',
        state: businessData.address?.state || '',
        zipCode: businessData.address?.zip || '',
        phoneNumber: businessData.phone || '',
        website: businessData.website || ''
      };
      
      // Submit for verification
      const result = await this.submitBusinessVerification(verificationData);
      
      if (!result || !result.id) {
        return null;
      }
      
      return {
        businessId: result.id
      };
    } catch (error) {
      logger.error({
        message: `Failed to initiate business verification: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'middesk',
        metadata: {
          businessName: businessData.legalName,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      return null;
    }
  }
}

export const middeskService = new MiddeskService();