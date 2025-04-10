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
  
  // Characters to use for OTP generation (excluding similar looking characters)
  private otpCharset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

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
    // Validate phone number format
    const normalizedPhone = message.to.replace(/\D/g, '');
    if (normalizedPhone.length < 10) {
      logger.warn({
        message: `Invalid phone number format: ${message.to}`,
        category: "api",
        source: "twilio"
      });
      
      return {
        success: false,
        error: `Invalid phone number format: ${message.to}`
      };
    }
    
    // Check message length - Twilio has a 1600 character limit
    if (message.body && message.body.length > 1600) {
      logger.warn({
        message: `SMS message too long (${message.body.length} chars)`,
        category: "api",
        source: "twilio",
        metadata: {
          messageLength: message.body.length,
          limit: 1600
        }
      });
      
      // Truncate message if too long
      message.body = message.body.substring(0, 1590) + "...";
    }
    
    // If Twilio is not initialized, use simulation mode
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
        logger.error({
          message: "No 'from' phone number provided and TWILIO_PHONE_NUMBER is not set",
          category: "api",
          source: "twilio"
        });
        
        return {
          success: false,
          error: "No 'from' phone number provided and TWILIO_PHONE_NUMBER is not set"
        };
      }

      // Format the phone number for Twilio if it doesn't start with +
      let formattedTo = normalizedPhone;
      if (!formattedTo.startsWith('+')) {
        // If it already starts with "1", just add the + prefix
        if (formattedTo.startsWith('1')) {
          formattedTo = `+${formattedTo}`;
        } else {
          // Otherwise add +1 prefix
          formattedTo = `+1${formattedTo}`;
        }
      }
      
      logger.info({
        message: `Sending SMS to ${formattedTo} from ${fromNumber}`,
        category: "api",
        source: "twilio",
        metadata: {
          messageLength: message.body.length
        }
      });

      const result = await this.client.messages.create({
        body: message.body,
        to: formattedTo,
        from: fromNumber
      });

      logger.info({
        message: `SMS sent successfully to ${formattedTo}, SID: ${result.sid}`,
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
      // Twilio can return various error types - handle them gracefully
      let errorMessage = "Unknown Twilio error";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Handle Twilio API error objects
        errorMessage = JSON.stringify(error);
      }
      
      logger.error({
        message: `Failed to send SMS to ${message.to}: ${errorMessage}`,
        category: "api", 
        source: "twilio",
        metadata: {
          error: error instanceof Error ? error.stack : JSON.stringify(error),
          to: message.to
        }
      });

      return {
        success: false,
        error: errorMessage
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
  
  /**
   * Generate a random OTP code
   * @param length Length of the OTP code
   * @returns A random alphanumeric OTP code
   */
  generateOtpCode(length: number = 6): string {
    let otp = '';
    const charsetLength = this.otpCharset.length;
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charsetLength);
      otp += this.otpCharset.charAt(randomIndex);
    }
    
    return otp;
  }
  
  /**
   * Send a one-time password via SMS
   * @param phoneNumber The phone number to send the OTP to
   * @param otpCode The OTP code to send
   * @param purpose The purpose of the OTP (e.g., 'login', 'verification')
   * @returns Result of sending the SMS
   */
  async sendOtp(
    phoneNumber: string, 
    otpCode: string, 
    purpose: string = 'login'
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    isSimulated?: boolean;
  }> {
    // Create the message text
    const messageText = `Your ShiFi verification code is: ${otpCode}. This code will expire in 15 minutes. Don't share this code with anyone.`;
    
    // Log the OTP sending event but mask the actual code in logs
    logger.info({
      message: `Sending OTP to ${phoneNumber} for ${purpose}`,
      category: 'auth',
      source: 'twilio',
      metadata: {
        phoneNumber,
        purpose,
        codeLength: otpCode.length,
        // Only log the first and last character for debugging
        codeMasked: `${otpCode.charAt(0)}****${otpCode.charAt(otpCode.length - 1)}`
      }
    });
    
    // Send the SMS message with the OTP
    return this.sendSMS({
      to: phoneNumber,
      body: messageText
    });
  }
}

export const twilioService = new TwilioService();