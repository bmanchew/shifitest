import twilio from 'twilio';
import { logger } from './logger';

export interface TwilioMessage {
  to: string;
  body: string;
  from?: string;
}

class TwilioService {
  private client: twilio.Twilio | null = null;
  private initialized = false;
  private twilioPhone: string | undefined;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    this.twilioPhone = process.env.TWILIO_PHONE_NUMBER?.trim();

    if (accountSid && authToken && this.twilioPhone) {
      try {
        this.client = twilio(accountSid, authToken);
        // Validate credentials by making a test API call
        const isValid = await this.validateCredentials();
        this.initialized = isValid;
        
        if (!isValid) {
          logger.error({
            message: "Twilio credentials validation failed",
            category: "system",
            source: "twilio"
          });
          return;
        }
        logger.info({
          message: "Twilio service initialized successfully",
          category: "system",
          source: "twilio",
          metadata: {
            fromNumber: this.twilioPhone,
            accountConfigured: !!accountSid,
            tokenConfigured: !!authToken,
            clientInitialized: !!this.client,
            initialized: this.initialized
          }
        });
      } catch (error) {
        logger.error({
          message: `Failed to initialize Twilio client: ${error instanceof Error ? error.message : String(error)}`,
          category: "system",
          source: "twilio",
          metadata: {
            error: error instanceof Error ? error.stack : null
          }
        });
      }
    } else {
      logger.warn({
        message: "Twilio credentials not configured, SMS functionality will be simulated",
        category: "system",
        source: "twilio"
      });
    }
  }

  isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }

  async sendSMS(message: TwilioMessage): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    isSimulated?: boolean;
  }> {
    if (!this.isInitialized() || !this.client) {
      logger.warn({
        message: `Twilio not initialized - Simulating SMS to ${message.to}`,
        category: "api",
        source: "twilio",
        metadata: {
          accountSid: !!process.env.TWILIO_ACCOUNT_SID,
          authToken: !!process.env.TWILIO_AUTH_TOKEN,
          phoneNumber: process.env.TWILIO_PHONE_NUMBER,
          isInitialized: this.isInitialized(),
          hasClient: !!this.client
        }
      });

      // Return simulated success response
      return {
        success: true,
        messageId: `SM${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
        isSimulated: true
      };
    }

    try {
      const fromNumber = message.from || this.twilioPhone;

      if (!fromNumber) {
        throw new Error("No 'from' phone number provided and TWILIO_PHONE_NUMBER is not set");
      }

      logger.info({
        message: `Sending SMS to ${message.to} from ${fromNumber}`,
        category: "api",
        source: "twilio"
      });

      const result = await this.client.messages.create({
        body: message.body,
        to: message.to,
        from: fromNumber
      });

      logger.info({
        message: `SMS sent successfully to ${message.to}, SID: ${result.sid}`,
        category: "api",
        source: "twilio",
        metadata: {
          sid: result.sid,
          status: result.status
        }
      });

      return {
        success: true,
        messageId: result.sid
      };
    } catch (error) {
      logger.error({
        message: `Failed to send SMS to ${message.to}: ${error instanceof Error ? error.message : String(error)}`,
        category: "api", 
        source: "twilio",
        metadata: {
          error: error instanceof Error ? error.stack : null,
          to: message.to
        }
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async validateCredentials(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Validate account info and phone number ownership
      const accounts = await this.client.api.v2010.accounts.list({limit: 1});
      const phoneNumbers = await this.client.incomingPhoneNumbers.list({limit: 1});
      
      const isValid = accounts.length > 0 && phoneNumbers.some(p => p.phoneNumber === this.twilioPhone);
      
      if (!isValid) {
        logger.error({
          message: "Twilio validation failed - account exists but phone number not found",
          category: "system",
          source: "twilio",
          metadata: {
            configuredPhone: this.twilioPhone,
            hasAccounts: accounts.length > 0,
            hasPhone: phoneNumbers.length > 0
          }
        });
      }
      
      return isValid;
    } catch (error) {
      logger.error({
        message: `Twilio credentials validation failed: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "twilio",
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
      return false;
    }
  }
}

export const twilioService = new TwilioService();