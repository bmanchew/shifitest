# External Integration Enhancement Plan

## Overview

This document outlines our plan to enhance the external service integrations (Plaid, Stripe, Twilio, OpenAI, and Email) with improved error handling, retry logic, and consistent patterns across all service implementations.

## Current Assessment

After reviewing the existing service implementations, we found:

1. **Inconsistent Error Handling**: While most service files include basic error handling with try/catch blocks and logging, there's inconsistency in how errors are classified, retried, and propagated.

2. **Limited Retry Logic**: Most services don't implement robust retry mechanisms for transient failures, which can lead to unnecessary error states.

3. **Duplicate Code Patterns**: Common error handling patterns are repeated across services instead of using centralized utilities.

4. **Initialization Inconsistencies**: Services have their own initialization checks, leading to different behaviors when configuration is missing.

## Enhancement Plan

### 1. Create a Common Service Base Class

Create a base class for all external services that provides:

```typescript
// server/services/base/ServiceBase.ts
import { logger } from '../logger';
import { ErrorFactory } from '../errorHandler';

export type RetryOptions = {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableStatuses?: number[];
  retryableErrors?: string[];
};

export const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 3000,
  backoffFactor: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED']
};

export abstract class ServiceBase {
  protected isInitialized = false;
  protected serviceName: string;
  protected initialized: Promise<boolean>;
  
  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.initialized = this.initialize();
  }
  
  /**
   * Initialize the service
   * @returns Promise resolving to initialization status
   */
  protected abstract initialize(): Promise<boolean>;
  
  /**
   * Check if service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }
  
  /**
   * Wait for service to be initialized
   * @returns Promise resolving when service is initialized
   */
  public async waitForInitialization(): Promise<boolean> {
    return this.initialized;
  }
  
  /**
   * Execute a function with retry logic
   * @param fn Function to execute
   * @param options Retry options
   * @returns Result of the function
   */
  protected async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const retryOpts: RetryOptions = { ...defaultRetryOptions, ...options };
    let lastError: any;
    let delay = retryOpts.initialDelayMs;
    
    for (let attempt = 0; attempt <= retryOpts.maxRetries; attempt++) {
      try {
        // If not first attempt, log retry attempt
        if (attempt > 0) {
          logger.info({
            message: `Retrying ${this.serviceName} API call (attempt ${attempt}/${retryOpts.maxRetries})`,
            category: 'api',
            source: this.serviceName.toLowerCase(),
            metadata: { attempt, maxRetries: retryOpts.maxRetries, delay }
          });
        }
        
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry this error
        const shouldRetry = this.shouldRetryError(error, retryOpts);
        
        // If we shouldn't retry or this is our last attempt, throw
        if (!shouldRetry || attempt === retryOpts.maxRetries) {
          logger.error({
            message: `${this.serviceName} API error (${attempt}/${retryOpts.maxRetries} attempts): ${error instanceof Error ? error.message : String(error)}`,
            category: 'api',
            source: this.serviceName.toLowerCase(),
            metadata: {
              error: error instanceof Error ? error.stack : String(error),
              attempt,
              maxRetries: retryOpts.maxRetries
            }
          });
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Calculate next delay with exponential backoff
        delay = Math.min(delay * retryOpts.backoffFactor, retryOpts.maxDelayMs);
      }
    }
    
    // This should never be reached due to the throw in the loop above
    throw lastError;
  }
  
  /**
   * Determine if an error should be retried
   * @param error The error
   * @param options Retry options
   * @returns True if the error should be retried
   */
  private shouldRetryError(error: any, options: RetryOptions): boolean {
    // Network errors
    if (error && error.code && options.retryableErrors?.includes(error.code)) {
      return true;
    }
    
    // HTTP status code errors
    if (error && error.response && error.response.status) {
      return options.retryableStatuses?.includes(error.response.status) || false;
    }
    
    // Rate limit errors
    if (
      error &&
      (error.message?.includes('rate limit') || 
       error.message?.includes('too many requests'))
    ) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Create a standardized service error
   * @param error Original error
   * @param message User-friendly error message
   * @returns Standardized error
   */
  protected createServiceError(error: any, message: string): Error {
    // Log the error
    logger.error({
      message: `${this.serviceName} error: ${message}`,
      category: 'api',
      source: this.serviceName.toLowerCase(),
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    });
    
    // Return a standardized error using the ErrorFactory
    return ErrorFactory.externalApi(
      message,
      this.serviceName,
      error
    );
  }
}
```

### 2. Enhance Plaid Service

Create an improved Plaid service implementation:

```typescript
// server/services/enhanced/plaid.service.ts
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { ServiceBase } from '../base/ServiceBase';
import { logger } from '../logger';
import { storage } from '../../storage';

export class PlaidService extends ServiceBase {
  private client: PlaidApi | null = null;
  
  constructor() {
    super('Plaid');
  }
  
  protected async initialize(): Promise<boolean> {
    try {
      const clientId = process.env.PLAID_CLIENT_ID;
      const secret = process.env.PLAID_SECRET;
      const environment = process.env.PLAID_ENVIRONMENT as keyof typeof PlaidEnvironments || 'sandbox';
      
      if (!clientId || !secret) {
        logger.warn({
          message: 'Plaid service not initialized - missing credentials',
          category: 'system',
          source: 'plaid'
        });
        return false;
      }
      
      const configuration = new Configuration({
        basePath: PlaidEnvironments[environment],
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': clientId,
            'PLAID-SECRET': secret,
          },
        },
      });
      
      this.client = new PlaidApi(configuration);
      
      // Verify API credentials with a simple call
      await this.executeWithRetry(() => this.client!.institutionsGet({
        count: 1,
        offset: 0,
        country_codes: ['US'],
      }));
      
      this.isInitialized = true;
      
      logger.info({
        message: 'Plaid service initialized successfully',
        category: 'system',
        source: 'plaid',
        metadata: {
          environment
        }
      });
      
      return true;
    } catch (error) {
      logger.error({
        message: `Failed to initialize Plaid service: ${error instanceof Error ? error.message : String(error)}`,
        category: 'system',
        source: 'plaid',
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return false;
    }
  }
  
  /**
   * Create a link token for initializing Plaid Link
   * @param userId User ID
   * @param clientName Client name
   * @returns Link token data
   */
  async createLinkToken(userId: number, clientName: string = 'ShiFi') {
    await this.waitForInitialization();
    
    if (!this.isInitialized || !this.client) {
      throw this.createServiceError(
        new Error('Service not initialized'),
        'Plaid service is not available'
      );
    }
    
    return this.executeWithRetry(async () => {
      const request = {
        user: {
          client_user_id: userId.toString(),
        },
        client_name: clientName,
        products: ['auth', 'transactions'],
        country_codes: ['US'],
        language: 'en',
      };
      
      const response = await this.client!.linkTokenCreate(request);
      
      logger.info({
        message: `Created Plaid link token for user ${userId}`,
        category: 'api',
        source: 'plaid',
        metadata: {
          userId
        }
      });
      
      return response.data;
    });
  }
  
  /**
   * Exchange a public token for an access token
   * @param publicToken Public token from Plaid Link
   * @returns Access token and item ID
   */
  async exchangePublicToken(publicToken: string) {
    await this.waitForInitialization();
    
    if (!this.isInitialized || !this.client) {
      throw this.createServiceError(
        new Error('Service not initialized'),
        'Plaid service is not available'
      );
    }
    
    return this.executeWithRetry(async () => {
      const response = await this.client!.itemPublicTokenExchange({
        public_token: publicToken,
      });
      
      const accessToken = response.data.access_token;
      const itemId = response.data.item_id;
      
      logger.info({
        message: 'Exchanged Plaid public token for access token',
        category: 'api',
        source: 'plaid',
        metadata: {
          itemId
        }
      });
      
      return { accessToken, itemId };
    });
  }
  
  /**
   * Get accounts for a user
   * @param accessToken Plaid access token
   * @returns Array of accounts
   */
  async getAccounts(accessToken: string) {
    await this.waitForInitialization();
    
    if (!this.isInitialized || !this.client) {
      throw this.createServiceError(
        new Error('Service not initialized'),
        'Plaid service is not available'
      );
    }
    
    return this.executeWithRetry(async () => {
      const response = await this.client!.accountsGet({
        access_token: accessToken
      });
      
      logger.info({
        message: `Retrieved ${response.data.accounts.length} accounts from Plaid`,
        category: 'api',
        source: 'plaid',
        metadata: {
          accountCount: response.data.accounts.length
        }
      });
      
      return response.data.accounts;
    });
  }
}

export const plaidService = new PlaidService();
```

### 3. Enhance Stripe Service

Apply similar patterns to the Stripe service:

```typescript
// server/services/enhanced/stripe.service.ts
import Stripe from 'stripe';
import { ServiceBase } from '../base/ServiceBase';
import { logger } from '../logger';

export class StripeService extends ServiceBase {
  private client: Stripe | null = null;
  
  constructor() {
    super('Stripe');
  }
  
  protected async initialize(): Promise<boolean> {
    try {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      
      if (!secretKey) {
        logger.warn({
          message: 'Stripe service not initialized - missing secret key',
          category: 'system',
          source: 'stripe'
        });
        return false;
      }
      
      this.client = new Stripe(secretKey, {
        apiVersion: '2023-10-16'
      });
      
      // Verify API key with a simple call
      await this.executeWithRetry(() => this.client!.balance.retrieve());
      
      this.isInitialized = true;
      
      logger.info({
        message: 'Stripe service initialized successfully',
        category: 'system',
        source: 'stripe'
      });
      
      return true;
    } catch (error) {
      logger.error({
        message: `Failed to initialize Stripe service: ${error instanceof Error ? error.message : String(error)}`,
        category: 'system',
        source: 'stripe',
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return false;
    }
  }
  
  /**
   * Create a payment intent
   * @param amount Amount in dollars (will be converted to cents)
   * @param metadata Additional metadata
   * @returns Payment intent
   */
  async createPaymentIntent(amount: number, metadata: any) {
    await this.waitForInitialization();
    
    if (!this.isInitialized || !this.client) {
      throw this.createServiceError(
        new Error('Service not initialized'),
        'Stripe service is not available'
      );
    }
    
    return this.executeWithRetry(async () => {
      const paymentIntent = await this.client!.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata
      });
      
      logger.info({
        message: `Created Stripe payment intent for $${amount}`,
        category: 'api',
        source: 'stripe',
        metadata: {
          amount,
          paymentIntentId: paymentIntent.id
        }
      });
      
      return paymentIntent;
    });
  }
  
  /**
   * Retrieve a payment intent
   * @param paymentIntentId Payment intent ID
   * @returns Payment intent
   */
  async retrievePaymentIntent(paymentIntentId: string) {
    await this.waitForInitialization();
    
    if (!this.isInitialized || !this.client) {
      throw this.createServiceError(
        new Error('Service not initialized'),
        'Stripe service is not available'
      );
    }
    
    return this.executeWithRetry(async () => {
      const paymentIntent = await this.client!.paymentIntents.retrieve(paymentIntentId);
      
      logger.info({
        message: `Retrieved Stripe payment intent ${paymentIntentId}`,
        category: 'api',
        source: 'stripe',
        metadata: {
          paymentIntentId,
          status: paymentIntent.status
        }
      });
      
      return paymentIntent;
    });
  }
}

export const stripeService = new StripeService();
```

### 4. Enhance Twilio Service

Apply similar patterns to the Twilio service:

```typescript
// server/services/enhanced/twilio.service.ts
import twilio from 'twilio';
import { ServiceBase } from '../base/ServiceBase';
import { logger } from '../logger';

export interface TwilioMessage {
  to: string;
  body: string;
  from?: string;
}

export class TwilioService extends ServiceBase {
  private client: twilio.Twilio | null = null;
  private twilioPhone: string | undefined;
  private otpCharset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  
  constructor() {
    super('Twilio');
  }
  
  protected async initialize(): Promise<boolean> {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
      const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
      this.twilioPhone = process.env.TWILIO_PHONE_NUMBER?.trim();
      
      if (!accountSid || !authToken || !this.twilioPhone) {
        logger.warn({
          message: 'Twilio service not initialized - missing credentials',
          category: 'system',
          source: 'twilio'
        });
        return false;
      }
      
      this.client = twilio(accountSid, authToken);
      
      // Validate credentials
      const accounts = await this.executeWithRetry(() => 
        this.client!.api.v2010.accounts.list({limit: 1})
      );
      
      const phoneNumbers = await this.executeWithRetry(() => 
        this.client!.incomingPhoneNumbers.list({limit: 10})
      );
      
      const isValid = accounts.length > 0 && 
        phoneNumbers.some(p => p.phoneNumber === this.twilioPhone);
      
      if (!isValid) {
        logger.error({
          message: 'Twilio validation failed - account exists but phone number not found',
          category: 'system',
          source: 'twilio',
          metadata: {
            configuredPhone: this.twilioPhone,
            hasAccounts: accounts.length > 0,
            hasPhone: phoneNumbers.length > 0
          }
        });
        return false;
      }
      
      this.isInitialized = true;
      
      logger.info({
        message: 'Twilio service initialized successfully',
        category: 'system',
        source: 'twilio',
        metadata: {
          fromNumber: this.twilioPhone
        }
      });
      
      return true;
    } catch (error) {
      logger.error({
        message: `Failed to initialize Twilio service: ${error instanceof Error ? error.message : String(error)}`,
        category: 'system',
        source: 'twilio',
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return false;
    }
  }
  
  /**
   * Send an SMS message
   * @param message Message to send
   * @returns Result of sending the message
   */
  async sendSMS(message: TwilioMessage): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    isSimulated?: boolean;
  }> {
    await this.waitForInitialization();
    
    // Validate phone number format
    const normalizedPhone = message.to.replace(/\D/g, '');
    if (normalizedPhone.length < 10) {
      logger.warn({
        message: `Invalid phone number format: ${message.to}`,
        category: 'api',
        source: 'twilio'
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
        category: 'api',
        source: 'twilio',
        metadata: {
          messageLength: message.body.length,
          limit: 1600
        }
      });
      
      // Truncate message if too long
      message.body = message.body.substring(0, 1590) + "...";
    }
    
    // If Twilio is not initialized, use simulation mode
    if (!this.isInitialized || !this.client) {
      logger.warn({
        message: `Twilio not initialized - Simulating SMS to ${message.to}`,
        category: 'api',
        source: 'twilio'
      });
      
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
          category: 'api',
          source: 'twilio'
        });
        
        return {
          success: false,
          error: "No 'from' phone number provided and TWILIO_PHONE_NUMBER is not set"
        };
      }
      
      // Format the phone number for Twilio
      let formattedTo = normalizedPhone;
      if (!formattedTo.startsWith('+')) {
        formattedTo = formattedTo.startsWith('1') ? 
          `+${formattedTo}` : `+1${formattedTo}`;
      }
      
      logger.info({
        message: `Sending SMS to ${formattedTo}`,
        category: 'api',
        source: 'twilio',
        metadata: {
          messageLength: message.body.length
        }
      });
      
      const result = await this.executeWithRetry(() => 
        this.client!.messages.create({
          body: message.body,
          to: formattedTo,
          from: fromNumber
        })
      );
      
      logger.info({
        message: `SMS sent successfully to ${formattedTo}, SID: ${result.sid}`,
        category: 'api',
        source: 'twilio',
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
        category: 'api',
        source: 'twilio',
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
          to: message.to
        }
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Generate a random OTP code
   * @param length Length of the OTP code
   * @returns Random OTP code
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
   * @param phoneNumber Phone number to send to
   * @param otpCode OTP code
   * @param purpose Purpose of the OTP
   * @returns Result of sending the message
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
    const messageText = `Your ShiFi verification code is: ${otpCode}. This code will expire in 15 minutes. Don't share this code with anyone.`;
    
    logger.info({
      message: `Sending OTP to ${phoneNumber} for ${purpose}`,
      category: 'auth',
      source: 'twilio',
      metadata: {
        phoneNumber,
        purpose,
        codeLength: otpCode.length,
        codeMasked: `${otpCode.charAt(0)}****${otpCode.charAt(otpCode.length - 1)}`
      }
    });
    
    return this.sendSMS({
      to: phoneNumber,
      body: messageText
    });
  }
}

export const twilioService = new TwilioService();
```

### 5. Implementation Strategy

We recommend implementing these service enhancements incrementally:

1. **Phase 1 - Base Class**: Implement the `ServiceBase` class that defines common patterns for all services.

2. **Phase 2 - Service-by-Service Migration**:
   - Start with one service (e.g., Plaid) and implement its enhanced version
   - Test thoroughly with isolation and integration tests
   - Move to the next service once stable

3. **Phase 3 - Controller Updates**:
   - Update controllers to use the new service methods and handle errors appropriately
   - Implement consistent error handling in controllers that use these services

4. **Phase 4 - Documentation and Monitoring**:
   - Add monitoring for service availability and API call success rates
   - Document patterns for future service implementations

## Benefits of Implementation

1. **Improved Reliability**: Retry logic for transient failures reduces error rates.

2. **Consistent Error Handling**: Standard patterns for error handling make debugging easier.

3. **Better Developer Experience**: Consistent patterns make adding new service methods simpler.

4. **Enhanced Monitoring**: Standardized logging enables better monitoring of service health.

5. **Graceful Degradation**: Services can handle missing configuration and fail gracefully.

## Conclusion

This implementation plan provides a comprehensive approach to enhancing our external service integrations. The modular, class-based approach ensures consistency across services while allowing each service to implement its specific functionality. The addition of retry logic and standardized error handling will significantly improve the reliability of our external integrations.