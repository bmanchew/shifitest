
import axios from 'axios';
import { logger } from './logger';

export class NLPearlService {
  private readonly accountId: string;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.nlpearl.ai/v1';

  constructor() {
    this.accountId = process.env.NLPEARL_ACCOUNT_ID || '';
    this.apiKey = process.env.NLPEARL_API_KEY || '';

    if (!this.accountId || !this.apiKey) {
      logger.warn({
        message: 'NLPearl service not properly configured',
        category: 'service',
        source: 'nlpearl',
        metadata: {
          hasAccountId: !!this.accountId,
          hasApiKey: !!this.apiKey
        }
      });
    }
  }

  isInitialized(): boolean {
    return !!(this.accountId && this.apiKey);
  }

  private getAuthHeader() {
    return `Bearer ${this.accountId}:${this.apiKey}`;
  }

  async initiateApplicationCall(phoneNumber: string, applicationUrl: string, merchantName: string) {
    try {
      if (!this.isInitialized()) {
        throw new Error('NLPearl service not properly configured');
      }

      const response = await axios.post(`${this.baseUrl}/calls/initiate`, {
        phone_number: phoneNumber,
        context: {
          merchant_name: merchantName,
          application_url: applicationUrl
        },
        flow_id: 'application_walkthrough'  // You'll need to create this flow in NLPearl dashboard
      }, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      logger.info({
        message: 'NLPearl call initiated',
        category: 'service',
        source: 'nlpearl',
        metadata: {
          phoneNumber,
          callId: response.data.call_id
        }
      });

      return response.data;
    } catch (error) {
      logger.error({
        message: `Failed to initiate NLPearl call: ${error instanceof Error ? error.message : String(error)}`,
        category: 'service',
        source: 'nlpearl',
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      throw error;
    }
  }
}

export const nlpearlService = new NLPearlService();
