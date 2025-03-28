import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { storage } from '../storage';
import { logger } from './logger';

// Configure Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENVIRONMENT as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

/**
 * Service for handling Plaid transfers
 */
export const plaidTransferService = {
  /**
   * Authorize a transfer (perform risk assessment and balance check)
   * @param params Authorization parameters
   * @returns The authorization ID if approved, or null if declined
   */
  async authorizeTransfer(params: {
    accessToken: string;
    accountId: string;
    amount: string;
    type: 'debit' | 'credit';
    description?: string;
    user: {
      legalName: string;
      email?: string;
      phone?: string;
    };
    originatorClientId?: string; // For platform payments
  }) {
    try {
      const { accessToken, accountId, amount, type, user, originatorClientId } = params;

      // Create authorization request
      const authRequest = {
        access_token: accessToken,
        account_id: accountId,
        type: type,
        network: "ach", // Could also be "same-day-ach" if enabled
        amount: amount,
        ach_class: "ppd", // PPD for personal payments, CCD for business
        user: {
          legal_name: user.legalName,
          email_address: user.email,
          phone_number: user.phone
        },
        originator_client_id: originatorClientId
      };

      logger.info({
        message: `Creating transfer authorization for ${type} transfer of $${amount}`,
        category: "payment",
        source: "plaid",
        metadata: {
          accountId,
          amount,
          type,
          originatorClientId
        }
      });

      // Call Plaid to authorize the transfer
      const authResponse = await plaidClient.transferAuthorizationCreate(authRequest);
      const authorization = authResponse.data.authorization;
      const decision = authorization.decision;

      // Log the authorization result
      logger.info({
        message: `Transfer authorization ${decision} for ${type} transfer of $${amount}`,
        category: "payment",
        source: "plaid",
        metadata: {
          authorizationId: authorization.id,
          decision,
          amount,
          type,
          originatorClientId,
          rationale: authorization.decision_rationale?.code
        }
      });

      // Handle authorization decision
      if (decision === 'approved') {
        return authorization.id;
      } else if (decision === 'declined') {
        logger.warn({
          message: `Transfer authorization declined: ${authorization.decision_rationale?.code} - ${authorization.decision_rationale?.description}`,
          category: "payment",
          source: "plaid",
          metadata: {
            authorizationId: authorization.id,
            rationalCode: authorization.decision_rationale?.code,
            rationaleDescription: authorization.decision_rationale?.description
          }
        });
        return null;
      } else if (decision === 'user_action_required') {
        // In production, implement a flow to create a new link token with authorization_id
        logger.warn({
          message: `Transfer requires user action: User needs to update their bank account link`,
          category: "payment",
          source: "plaid",
          metadata: {
            authorizationId: authorization.id
          }
        });
        return null;
      }

      return null;
    } catch (error) {
      logger.error({
        message: `Error creating transfer authorization: ${error instanceof Error ? error.message : String(error)}`,
        category: "payment",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          params
        }
      });
      
      throw error;
    }
  },

  /**
   * Create a transfer after authorization is approved
   * @param params Transfer parameters
   * @returns Transfer ID and status
   */
  async createTransfer(params: {
    accessToken: string;
    accountId: string;
    authorizationId: string;
    description: string;
    originatorClientId?: string; // For platform payments
    metadata?: Record<string, string>; // Optional metadata for the transfer
  }) {
    try {
      const { accessToken, accountId, authorizationId, description, originatorClientId, metadata } = params;

      // Create transfer request
      const transferRequest = {
        access_token: accessToken,
        account_id: accountId,
        authorization_id: authorizationId,
        description: description,
        originator_client_id: originatorClientId,
        metadata: metadata
      };

      // Call Plaid to create the transfer
      const transferResponse = await plaidClient.transferCreate(transferRequest);
      const transfer = transferResponse.data.transfer;

      logger.info({
        message: `Transfer created: ID ${transfer.id}, Status ${transfer.status}`,
        category: "payment",
        source: "plaid",
        metadata: {
          transferId: transfer.id,
          status: transfer.status,
          accountId,
          authorizationId,
          originatorClientId
        }
      });

      return {
        transferId: transfer.id,
        status: transfer.status,
        amount: transfer.amount,
        network: transfer.network,
        cancellable: transfer.cancellable
      };
    } catch (error) {
      logger.error({
        message: `Error creating transfer: ${error instanceof Error ? error.message : String(error)}`,
        category: "payment",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          params
        }
      });
      
      throw error;
    }
  },

  /**
   * Get transfer by ID
   * @param transferId The Plaid transfer ID
   * @returns Transfer details
   */
  async getTransfer(transferId: string) {
    try {
      const response = await plaidClient.transferGet({
        transfer_id: transferId
      });

      return response.data.transfer;
    } catch (error) {
      logger.error({
        message: `Error getting transfer: ${error instanceof Error ? error.message : String(error)}`,
        category: "payment",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          transferId
        }
      });
      
      throw error;
    }
  },

  /**
   * Cancel a transfer if it's still cancellable
   * @param transferId The Plaid transfer ID
   * @returns Cancellation result
   */
  async cancelTransfer(transferId: string) {
    try {
      const response = await plaidClient.transferCancel({
        transfer_id: transferId
      });

      logger.info({
        message: `Transfer cancelled: ${transferId}`,
        category: "payment",
        source: "plaid",
        metadata: {
          transferId
        }
      });

      return {
        cancelled: true,
        cancelledTransferId: response.data.cancelled_transfer_id
      };
    } catch (error) {
      logger.error({
        message: `Error cancelling transfer: ${error instanceof Error ? error.message : String(error)}`,
        category: "payment",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          transferId
        }
      });
      
      throw error;
    }
  },

  /**
   * Create a recurring transfer
   * @param params Recurring transfer parameters
   * @returns Recurring transfer ID
   */
  async createRecurringTransfer(params: {
    accessToken: string;
    accountId: string;
    amount: string;
    type: 'debit' | 'credit';
    scheduledTransfers: {
      startDate: string; // YYYY-MM-DD
      endDate?: string; // YYYY-MM-DD
      frequency: 'weekly' | 'biweekly' | 'monthly';
      dayOfMonth?: number; // For monthly frequency
      dayOfWeek?: number; // For weekly/biweekly frequency (0=Sunday, 6=Saturday)
      description: string;
    };
    user: {
      legalName: string;
      email?: string;
      phone?: string;
    };
    originatorClientId?: string;
  }) {
    try {
      const { accessToken, accountId, amount, type, scheduledTransfers, user, originatorClientId } = params;

      // First, create a transfer authorization
      const authRequest = {
        access_token: accessToken,
        account_id: accountId,
        type: type,
        network: "ach",
        amount: amount,
        ach_class: "ppd",
        user: {
          legal_name: user.legalName,
          email_address: user.email,
          phone_number: user.phone
        },
        originator_client_id: originatorClientId
      };

      // Call Plaid to authorize the transfer
      const authResponse = await plaidClient.transferAuthorizationCreate(authRequest);
      const authorization = authResponse.data.authorization;
      
      if (authorization.decision !== 'approved') {
        logger.warn({
          message: `Recurring transfer authorization not approved: ${authorization.decision}`,
          category: "payment",
          source: "plaid",
          metadata: {
            decision: authorization.decision,
            rationale: authorization.decision_rationale?.code
          }
        });
        return null;
      }

      // Create recurring transfer request
      const recurringRequest = {
        access_token: accessToken,
        account_id: accountId,
        authorization_id: authorization.id,
        type: type,
        network: "ach",
        amount: amount,
        ach_class: "ppd",
        user: {
          legal_name: user.legalName
        },
        schedule: {
          interval_unit: scheduledTransfers.frequency === 'weekly' ? 'week' : 
                          scheduledTransfers.frequency === 'biweekly' ? 'week' :
                          'month',
          interval_count: scheduledTransfers.frequency === 'biweekly' ? 2 : 1,
          interval_execution_day: scheduledTransfers.frequency === 'monthly' ? 
                                   scheduledTransfers.dayOfMonth : 
                                   scheduledTransfers.dayOfWeek,
          start_date: scheduledTransfers.startDate,
          end_date: scheduledTransfers.endDate
        },
        description: scheduledTransfers.description,
        originator_client_id: originatorClientId
      };

      // Call Plaid to create the recurring transfer
      const recurringResponse = await plaidClient.transferRecurringCreate(recurringRequest);
      const recurringTransfer = recurringResponse.data.recurring_transfer;

      logger.info({
        message: `Recurring transfer created: ID ${recurringTransfer.recurring_transfer_id}`,
        category: "payment",
        source: "plaid",
        metadata: {
          recurringTransferId: recurringTransfer.recurring_transfer_id,
          frequency: scheduledTransfers.frequency,
          startDate: scheduledTransfers.startDate,
          endDate: scheduledTransfers.endDate,
          amount,
          type
        }
      });

      return {
        recurringTransferId: recurringTransfer.recurring_transfer_id,
        status: recurringTransfer.status
      };
    } catch (error) {
      logger.error({
        message: `Error creating recurring transfer: ${error instanceof Error ? error.message : String(error)}`,
        category: "payment",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          params
        }
      });
      
      throw error;
    }
  },

  /**
   * Full implementation example: Process a complete payment from customer to merchant
   * Combines authorization and creation in a single method
   * 
   * @param params Payment parameters
   * @returns Transfer result
   */
  async processPayment(params: {
    accessToken: string;
    accountId: string;
    amount: string;
    description: string;
    user: {
      legalName: string;
      email?: string;
      phone?: string;
    };
    contractId: number;
    merchantId?: number; // If payment should go to merchant
    originatorClientId?: string; // If using platform payments
    metadata?: Record<string, string>;
  }) {
    try {
      const { 
        accessToken, accountId, amount, description, user, 
        contractId, merchantId, originatorClientId, metadata 
      } = params;

      // Step 1: Authorize the transfer
      const authorizationId = await this.authorizeTransfer({
        accessToken,
        accountId,
        amount,
        type: 'debit', // Debiting customer's account
        description,
        user,
        originatorClientId
      });

      if (!authorizationId) {
        logger.warn({
          message: 'Payment authorization failed',
          category: 'payment',
          source: 'plaid',
          metadata: {
            contractId,
            amount,
            merchantId
          }
        });

        return {
          success: false,
          message: 'Payment authorization failed. Please check your bank account details or try again later.'
        };
      }

      // Step 2: Create the transfer
      const transferResult = await this.createTransfer({
        accessToken,
        accountId,
        authorizationId,
        description,
        originatorClientId,
        metadata: {
          ...metadata,
          contractId: contractId.toString(),
          ...(merchantId ? { merchantId: merchantId.toString() } : {})
        }
      });

      // Step 3: Store the transfer information in our database
      if (merchantId) {
        await storage.createPlaidTransfer({
          contractId,
          merchantId,
          transferId: transferResult.transferId,
          originatorId: originatorClientId,
          amount: parseFloat(amount),
          description,
          type: 'debit',
          status: transferResult.status,
          routedToShifi: !originatorClientId, // If no originator ID, it's routed through ShiFi
          metadata: JSON.stringify(metadata)
        });
      } else {
        // Payment to ShiFi
        await storage.createPlaidTransfer({
          contractId,
          transferId: transferResult.transferId,
          amount: parseFloat(amount),
          description,
          type: 'debit',
          status: transferResult.status,
          routedToShifi: true,
          metadata: JSON.stringify(metadata)
        });
      }

      return {
        success: true,
        transferId: transferResult.transferId,
        status: transferResult.status
      };
    } catch (error) {
      logger.error({
        message: `Error processing payment: ${error instanceof Error ? error.message : String(error)}`,
        category: 'payment',
        source: 'plaid',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          params
        }
      });
      
      return {
        success: false,
        message: 'An error occurred while processing the payment. Please try again later.',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  /**
   * Process payment from ShiFi to merchant (crediting merchant's account)
   * Typically used when ShiFi finances a purchase
   * 
   * @param params Payment parameters
   * @returns Transfer result
   */
  async processMerchantPayout(params: {
    merchantId: number;
    amount: string;
    description: string;
    contractId: number;
    metadata?: Record<string, string>;
  }) {
    try {
      const { merchantId, amount, description, contractId, metadata } = params;

      // Get merchant's Plaid info
      const merchant = await storage.getMerchantPlaidInfo(merchantId);
      if (!merchant || !merchant.accessToken || !merchant.accountId) {
        logger.error({
          message: `Merchant ${merchantId} has no bank account connected`,
          category: 'payment',
          source: 'plaid',
          metadata: {
            merchantId,
            contractId
          }
        });

        return {
          success: false,
          message: 'Merchant has no bank account connected'
        };
      }

      // Get ShiFi's bank account (would be configured in environment or settings)
      const shifiAccessToken = process.env.SHIFI_PLAID_ACCESS_TOKEN;
      const shifiAccountId = process.env.SHIFI_PLAID_ACCOUNT_ID;

      if (!shifiAccessToken || !shifiAccountId) {
        logger.error({
          message: 'ShiFi bank account not configured',
          category: 'payment',
          source: 'plaid',
          metadata: {
            merchantId,
            contractId
          }
        });

        return {
          success: false,
          message: 'ShiFi payment system not configured properly'
        };
      }

      // Step 1: Authorize the transfer from ShiFi to merchant (credit)
      const authorizationId = await this.authorizeTransfer({
        accessToken: shifiAccessToken,
        accountId: shifiAccountId,
        amount,
        type: 'credit', // Crediting merchant's account
        description,
        user: {
          legalName: 'ShiFi Financial Services'
        }
      });

      if (!authorizationId) {
        logger.warn({
          message: 'Merchant payout authorization failed',
          category: 'payment',
          source: 'plaid',
          metadata: {
            contractId,
            amount,
            merchantId
          }
        });

        return {
          success: false,
          message: 'Payment authorization failed. Please try again later.'
        };
      }

      // Step 2: Create the transfer
      const transferResult = await this.createTransfer({
        accessToken: shifiAccessToken,
        accountId: shifiAccountId,
        authorizationId,
        description,
        metadata: {
          ...metadata,
          contractId: contractId.toString(),
          merchantId: merchantId.toString(),
          paymentType: 'merchant_payout'
        }
      });

      // Step 3: Store the transfer information
      await storage.createPlaidTransfer({
        contractId,
        merchantId,
        transferId: transferResult.transferId,
        amount: parseFloat(amount),
        description,
        type: 'credit',
        status: transferResult.status,
        routedToShifi: false, // This is from ShiFi to merchant
        metadata: JSON.stringify(metadata)
      });

      return {
        success: true,
        transferId: transferResult.transferId,
        status: transferResult.status
      };
    } catch (error) {
      logger.error({
        message: `Error processing merchant payout: ${error instanceof Error ? error.message : String(error)}`,
        category: 'payment',
        source: 'plaid',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          params
        }
      });
      
      return {
        success: false,
        message: 'An error occurred while processing the payout. Please try again later.',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  /**
   * Check platform payment status
   * @param transferId Transfer ID to check
   * @returns Current status of the transfer
   */
  async checkPlatformPaymentStatus(transferId: string) {
    try {
      const response = await plaidClient.transferGet({
        transfer_id: transferId
      });

      const transfer = response.data.transfer;

      // Update transfer status in database
      const dbTransfer = await storage.getPlaidTransferByTransferId(transferId);
      if (dbTransfer && dbTransfer.status !== transfer.status) {
        await storage.updatePlaidTransferStatus(transferId, transfer.status);
      }

      return {
        transferId: transfer.id,
        status: transfer.status,
        amount: transfer.amount,
        description: transfer.description,
        created: transfer.created,
        network: transfer.network,
        cancellable: transfer.cancellable,
        failureReason: transfer.failure_reason
      };
    } catch (error) {
      logger.error({
        message: `Error checking platform payment status: ${error instanceof Error ? error.message : String(error)}`,
        category: 'payment',
        source: 'plaid',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          transferId
        }
      });
      
      throw error;
    }
  },

  /**
   * Set up a merchant as a platform originator
   * @param merchantId Merchant ID
   * @returns Originator details
   */
  async setupMerchantAsOriginator(merchantId: number) {
    try {
      // Get merchant info
      const merchant = await storage.getMerchant(merchantId);
      if (!merchant) {
        throw new Error(`Merchant ${merchantId} not found`);
      }

      // Check if merchant already has Plaid platform setup
      const existingPlatform = await storage.getMerchantPlaidPlatform(merchantId);
      if (existingPlatform && existingPlatform.originatorId) {
        return {
          success: true,
          originatorId: existingPlatform.originatorId,
          message: 'Merchant already set up as originator'
        };
      }

      // In sandbox, we can directly create an originator
      // In production, this would involve creating a customer and sending a questionnaire
      const createRequest = {
        legal_name: merchant.businessName || `Merchant ${merchantId}`,
        address: {
          street: merchant.address?.street || '123 Main St',
          city: merchant.address?.city || 'San Francisco',
          region: merchant.address?.state || 'CA',
          postal_code: merchant.address?.zipCode || '94111',
          country: merchant.address?.country || 'US'
        },
        email: merchant.email || `merchant-${merchantId}@example.com`,
        website: merchant.website || `https://merchant-${merchantId}.example.com`
      };

      // Call Plaid to create the originator
      const originatorResponse = await plaidClient.transferOriginatorCreate(createRequest);
      const originator = originatorResponse.data.originator;

      // Store originator info in database
      await storage.createPlaidMerchantPlatform({
        merchantId,
        originatorId: originator.originator_id,
        onboardingStatus: 'completed', // In sandbox, onboarding is immediate
        plaidData: JSON.stringify(originator),
        createdAt: new Date()
      });

      logger.info({
        message: `Merchant ${merchantId} set up as Plaid originator: ${originator.originator_id}`,
        category: 'platform',
        source: 'plaid',
        metadata: {
          merchantId,
          originatorId: originator.originator_id
        }
      });

      return {
        success: true,
        originatorId: originator.originator_id,
        message: 'Merchant successfully set up as originator'
      };
    } catch (error) {
      logger.error({
        message: `Error setting up merchant as originator: ${error instanceof Error ? error.message : String(error)}`,
        category: 'platform',
        source: 'plaid',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          merchantId
        }
      });
      
      throw error;
    }
  }
};