import { Configuration, PlaidApi, PlaidEnvironments, LinkTokenCreateRequest } from 'plaid';
import { storage } from '../storage';
import { logger } from './logger';
import { plaidTransferService } from './plaid.transfers';

// Check if Plaid credentials are available
const hasPlaidCredentials = !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
let initialized = false;

// Configure Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENVIRONMENT as keyof typeof PlaidEnvironments] || 
            PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || 
            PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Log Plaid initialization status
if (hasPlaidCredentials) {
  initialized = true;
  logger.info({
    message: "Plaid service initialized successfully",
    category: "system",
    source: "plaid",
    metadata: {
      environment: process.env.PLAID_ENVIRONMENT || process.env.PLAID_ENV || "sandbox",
      clientId: process.env.PLAID_CLIENT_ID ? "Present" : "Missing",
      secret: process.env.PLAID_SECRET ? "Present" : "Missing"
    }
  });
} else {
  logger.error({
    message: "Failed to initialize Plaid service - missing credentials",
    category: "system",
    source: "plaid",
    metadata: {
      clientId: process.env.PLAID_CLIENT_ID ? "Present" : "Missing",
      secret: process.env.PLAID_SECRET ? "Present" : "Missing"
    }
  });
}

/**
 * Service for interacting with the Plaid API
 */
export const plaidService = {
  /**
   * Check if the Plaid service is properly initialized
   * @returns boolean indicating if the service is ready to use
   */
  isInitialized() {
    return initialized;
  },
  /**
   * Analyze an asset report for underwriting purposes
   * @param assetReportToken The asset report token
   * @returns Analysis of income, transactions, and employment history
   */
  async analyzeAssetReportForUnderwriting(assetReportToken: string) {
    try {
      const reportResponse = await plaidClient.assetReportGet({
        asset_report_token: assetReportToken
      });
      
      const report = reportResponse.data.report;
      
      // Basic analysis framework
      const analysis = {
        income: {
          monthlyIncome: 0,
          annualIncome: 0,
          incomeStability: 0
        },
        employment: {
          employmentMonths: 0,
          employmentStability: 0
        },
        transactions: {
          averageMonthlyExpenses: 0,
          largeDeposits: [],
          largeWithdrawals: []
        }
      };
      
      // This is a simplified analysis - in a real implementation,
      // this would be much more sophisticated
      if (report && report.items && report.items.length > 0) {
        // Calculate estimated monthly income based on deposits
        const accounts = report.items.flatMap(item => item.accounts || []);
        
        // Simple income estimation based on regular deposits
        // This is very simplified - real income detection would be more complex
        const monthlyDeposits = accounts.reduce((sum, account) => {
          // Only use checking accounts for income analysis
          if (account.type === 'depository' && account.subtype === 'checking') {
            return sum + (account.balances?.current || 0) * 0.2; // Very rough income estimate
          }
          return sum;
        }, 0);
        
        analysis.income.monthlyIncome = monthlyDeposits;
        analysis.income.annualIncome = monthlyDeposits * 12;
        
        // Simplified employment tenure estimate - just using account age
        // In reality, this would use employment verification or transaction patterns
        const oldestAccountMonths = Math.max(...accounts.map(account => {
          const days = account.days_available || 0;
          return Math.floor(days / 30);
        }));
        
        analysis.employment.employmentMonths = oldestAccountMonths;
      }
      
      logger.info({
        message: 'Analyzed asset report for underwriting',
        category: 'api',
        source: 'plaid',
        metadata: {
          assetReportToken,
          analysisResult: JSON.stringify(analysis)
        }
      });
      
      return analysis;
    } catch (error) {
      logger.error({
        message: `Error analyzing asset report: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'plaid',
        metadata: {
          assetReportToken,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      throw error;
    }
  },
  /**
   * Create a link token for initializing Plaid Link
   * @param options Options for creating link token including userId, clientUserId, and products
   * @returns The link token object from Plaid
   */
  async createLinkToken(options: { userId?: string | number, clientUserId: string, products: string[], redirect_uri?: string }) {
    // Generate a request ID for tracing across logs
    const requestId = `plaid-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    try {
      // Verify Plaid service is properly initialized
      if (!this.isInitialized()) {
        logger.error({
          message: "Plaid service not initialized when attempting to create link token",
          category: "api",
          source: "plaid",
          metadata: {
            requestId,
            clientUserId: options.clientUserId,
            plaidClientId: process.env.PLAID_CLIENT_ID ? "Present" : "Missing",
            plaidSecret: process.env.PLAID_SECRET ? "Present" : "Missing",
            plaidEnvironment: process.env.PLAID_ENVIRONMENT || process.env.PLAID_ENV || "undefined"
          }
        });
        
        throw new Error("Plaid service not initialized - environment variables may be missing");
      }
      
      const { userId, clientUserId, products, redirect_uri } = options;
      
      // Log pre-request details 
      logger.debug({
        message: "Preparing Plaid link token request",
        category: "api",
        source: "plaid",
        metadata: {
          requestId,
          clientUserId,
          products,
          hasRedirectUri: !!redirect_uri,
          environment: process.env.PLAID_ENVIRONMENT || process.env.PLAID_ENV || "undefined"
        }
      });
      
      // Create link token configuration - using any type to avoid TypeScript errors since we're adding dynamic properties
      const config: any = {
        user: {
          client_user_id: clientUserId.toString(),
        },
        client_name: process.env.PLAID_CLIENT_NAME || 'ShiFi Merchant Portal',
        products: products as any[],
        country_codes: ['US'] as any[],
        language: 'en',
      };
      
      // Add webhook URL if configured in environment
      if (process.env.PLAID_WEBHOOK_URL) {
        config.webhook = process.env.PLAID_WEBHOOK_URL;
        
        logger.debug({
          message: "Adding webhook URL to link token configuration",
          category: "api",
          source: "plaid",
          metadata: {
            requestId,
            webhookUrl: process.env.PLAID_WEBHOOK_URL
          }
        });
      }
      
      // Add redirect URI if provided
      if (redirect_uri) {
        config.redirect_uri = redirect_uri;
        
        logger.debug({
          message: "Adding redirect URI to link token configuration",
          category: "api",
          source: "plaid",
          metadata: {
            requestId,
            redirectUri: redirect_uri
          }
        });
      }
      
      // Measure API response time for performance monitoring
      const startTime = Date.now();
      
      // Make request to Plaid API 
      const response = await plaidClient.linkTokenCreate(config);
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Log successful response with performance metrics
      logger.info({
        message: `Created Plaid link token for client user ID ${clientUserId}`,
        category: 'api',
        userId: typeof userId === 'string' ? undefined : userId,
        source: 'plaid',
        metadata: {
          requestId,
          clientUserId,
          products,
          responseTime: `${responseTime}ms`,
          linkTokenLength: response.data.link_token?.length || 0,
          expirationTime: response.data.expiration,
          timestamp: new Date().toISOString()
        }
      });
      
      return {
        linkToken: response.data.link_token,
        expiration: response.data.expiration,
        requestId // Include the request ID in the response for client-side logging
      };
    } catch (error) {
      // Enhanced error handling with structured information
      let errorCode = "UNKNOWN";
      let errorType = "INTERNAL_ERROR";
      let errorDetails = "Unknown error";
      
      // Extract detailed error information from Plaid response
      if (error.response?.data) {
        try {
          const plaidError = error.response.data;
          errorDetails = JSON.stringify(plaidError);
          errorCode = plaidError.error_code || "UNKNOWN";
          errorType = plaidError.error_type || "API_ERROR";
          
          // Record detailed error info from Plaid
          logger.error({
            message: `Plaid API error when creating link token: ${plaidError.error_message || 'Unknown Plaid error'}`,
            category: 'api',
            source: 'plaid',
            metadata: {
              requestId,
              errorCode,
              errorType,
              errorMessage: plaidError.error_message,
              displayMessage: plaidError.display_message,
              suggestedAction: plaidError.suggested_action,
              requestId: plaidError.request_id,
              clientUserId: options.clientUserId
            }
          });
        } catch (parseError) {
          // Handle errors when parsing the Plaid error response
          logger.error({
            message: "Error parsing Plaid error response during link token creation",
            category: "api",
            source: "plaid",
            metadata: {
              requestId,
              originalError: String(error),
              parseError: String(parseError),
              responseData: error.response?.data
            }
          });
        }
      } else if (error instanceof Error) {
        // Handle standard JavaScript errors
        errorDetails = error.message;
        
        // Classify network/connection errors
        if (error.message.includes("ETIMEDOUT") || error.message.includes("timeout")) {
          errorCode = "REQUEST_TIMEOUT";
          errorType = "NETWORK_ERROR";
        } else if (error.message.includes("ECONNREFUSED")) {
          errorCode = "CONNECTION_ERROR";
          errorType = "NETWORK_ERROR";
        }
      }
      
      // Log comprehensive error information
      logger.error({
        message: `Error creating Plaid link token: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'plaid',
        metadata: {
          requestId,
          errorType,
          errorCode,
          errorDetails,
          requestInfo: {
            clientUserId: options.clientUserId,
            products: options.products,
            hasRedirectUri: !!options.redirect_uri
          },
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        }
      });
      
      // Enhance error message with request ID for easier correlation with logs
      if (error instanceof Error) {
        error.message = `Plaid link token creation failed: ${error.message} (Request ID: ${requestId})`;
      }
      
      throw error;
    }
  },
  
  /**
   * Get accounts for a user from Plaid
   * @param accessToken Plaid access token
   * @returns Array of accounts
   */
  async getAccounts(accessToken: string) {
    try {
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken
      });
      
      return accountsResponse.data.accounts;
    } catch (error) {
      logger.error({
        message: `Error getting accounts from Plaid: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      throw error;
    }
  },
  
  /**
   * Process a webhook from Plaid
   * @param webhookData Webhook data from Plaid
   */
  async processWebhook(webhookData: any) {
    try {
      const { webhook_type, webhook_code, item_id } = webhookData;
      
      // Get Plaid item from database
      const item = await storage.getPlaidItemByItemId(item_id);
      
      if (!item) {
        logger.warn({
          message: `Received webhook for unknown Plaid item: ${item_id}`,
          category: "webhook",
          source: "plaid",
          metadata: {
            webhookType: webhook_type,
            webhookCode: webhook_code,
            itemId: item_id
          }
        });
        return;
      }
      
      // Process different webhook types
      switch (webhook_type) {
        case 'ITEM':
          await this.processItemWebhook(webhook_code, item_id, webhookData);
          break;
        case 'TRANSACTIONS':
          await this.processTransactionsWebhook(webhook_code, item_id, webhookData);
          break;
        case 'ASSETS':
          await this.processAssetsWebhook(webhook_code, item_id, webhookData);
          break;
        case 'PAYMENT_INITIATION':
          await this.processPaymentWebhook(webhook_code, item_id, webhookData);
          break;
        default:
          logger.info({
            message: `Unhandled webhook type: ${webhook_type}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              webhookType: webhook_type,
              webhookCode: webhook_code,
              itemId: item_id
            }
          });
      }
    } catch (error) {
      logger.error({
        message: `Error processing Plaid webhook: ${error instanceof Error ? error.message : String(error)}`,
        category: "webhook",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          webhookData
        }
      });
      
      throw error;
    }
  },
  
  /**
   * Process Item webhooks
   * @param webhookCode Webhook code
   * @param itemId Plaid item ID
   * @param webhookData Full webhook data
   */
  async processItemWebhook(webhookCode: string, itemId: string, webhookData: any) {
    try {
      switch (webhookCode) {
        case 'ERROR':
          // Handle item error
          await storage.updatePlaidItemError(itemId, {
            errorCode: webhookData.error.error_code,
            errorMessage: webhookData.error.error_message,
            errorType: webhookData.error.error_type,
            updatedAt: new Date()
          });
          
          logger.error({
            message: `Plaid item error: ${webhookData.error.error_message}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              itemId,
              errorCode: webhookData.error.error_code,
              errorType: webhookData.error.error_type,
              errorMessage: webhookData.error.error_message
            }
          });
          break;
          
        case 'PENDING_EXPIRATION':
          // Handle pending expiration
          await storage.updatePlaidItemStatus(itemId, 'pending_expiration');
          
          logger.warn({
            message: `Plaid item pending expiration: ${itemId}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              itemId,
              daysUntilExpiration: webhookData.consent_expiration_time
            }
          });
          break;
          
        case 'USER_PERMISSION_REVOKED':
          // Handle user permission revoked
          await storage.updatePlaidItemStatus(itemId, 'revoked');
          
          logger.warn({
            message: `Plaid item permission revoked: ${itemId}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              itemId
            }
          });
          break;
          
        default:
          logger.info({
            message: `Unhandled item webhook code: ${webhookCode}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              webhookCode,
              itemId
            }
          });
      }
    } catch (error) {
      logger.error({
        message: `Error processing item webhook: ${error instanceof Error ? error.message : String(error)}`,
        category: "webhook",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          webhookCode,
          itemId
        }
      });
      
      throw error;
    }
  },
  
  /**
   * Process Assets webhooks
   * @param webhookCode Webhook code
   * @param itemId Plaid item ID
   * @param webhookData Full webhook data
   */
  async processAssetsWebhook(webhookCode: string, itemId: string, webhookData: any) {
    try {
      switch (webhookCode) {
        case 'PRODUCT_READY':
          // Asset report is ready
          const assetReportId = webhookData.asset_report_id;
          
          // Update asset report status
          await storage.updateAssetReport(assetReportId, {
            status: 'ready',
            updatedAt: new Date()
          });
          
          logger.info({
            message: `Asset report ready: ${assetReportId}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              itemId,
              assetReportId
            }
          });
          break;
          
        case 'ERROR':
          // Asset report error
          const errorAssetReportId = webhookData.asset_report_id;
          
          // Update asset report with error
          await storage.updateAssetReportError(errorAssetReportId, {
            errorCode: webhookData.error.error_code,
            errorMessage: webhookData.error.error_message,
            errorType: webhookData.error.error_type,
            status: 'error',
            updatedAt: new Date()
          });
          
          logger.error({
            message: `Asset report error: ${webhookData.error.error_message}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              itemId,
              assetReportId: errorAssetReportId,
              errorCode: webhookData.error.error_code,
              errorType: webhookData.error.error_type,
              errorMessage: webhookData.error.error_message
            }
          });
          break;
          
        default:
          logger.info({
            message: `Unhandled assets webhook code: ${webhookCode}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              webhookCode,
              itemId
            }
          });
      }
    } catch (error) {
      logger.error({
        message: `Error processing assets webhook: ${error instanceof Error ? error.message : String(error)}`,
        category: "webhook",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          webhookCode,
          itemId
        }
      });
      
      throw error;
    }
  },
  
  /**
   * Process Payment webhooks
   * @param webhookCode Webhook code
   * @param itemId Plaid item ID
   * @param webhookData Full webhook data
   */
  async processPaymentWebhook(webhookCode: string, itemId: string, webhookData: any) {
    try {
      switch (webhookCode) {
        case 'PAYMENT_STATUS_UPDATE':
          // Payment status update
          const paymentId = webhookData.payment_id;
          const newStatus = webhookData.new_payment_status;
          
          // Update payment status
          await storage.updatePaymentStatus(paymentId, newStatus);
          
          logger.info({
            message: `Payment status updated: ${paymentId} -> ${newStatus}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              itemId,
              paymentId,
              newStatus,
              oldStatus: webhookData.old_payment_status
            }
          });
          break;
          
        default:
          logger.info({
            message: `Unhandled payment webhook code: ${webhookCode}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              webhookCode,
              itemId
            }
          });
      }
    } catch (error) {
      logger.error({
        message: `Error processing payment webhook: ${error instanceof Error ? error.message : String(error)}`,
        category: "webhook",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          webhookCode,
          itemId
        }
      });
      
      throw error;
    }
  },
  
  /**
   * Process Transactions webhooks
   * @param webhookCode Webhook code
   * @param itemId Plaid item ID
   * @param webhookData Full webhook data
   */
  async processTransactionsWebhook(webhookCode: string, itemId: string, webhookData: any) {
    try {
      switch (webhookCode) {
        case 'INITIAL_UPDATE':
        case 'HISTORICAL_UPDATE':
        case 'DEFAULT_UPDATE':
          // Transactions have been updated
          // Fetch the new transactions in the background
          setImmediate(async () => {
            try {
              const { access_token } = await storage.getPlaidItemByItemId(itemId);
              await this.syncTransactions(access_token, itemId);
            } catch (syncError) {
              logger.error({
                message: `Error syncing transactions after webhook: ${syncError instanceof Error ? syncError.message : String(syncError)}`,
                category: "webhook",
                source: "plaid",
                metadata: {
                  error: syncError instanceof Error ? syncError.message : String(syncError),
                  stack: syncError instanceof Error ? syncError.stack : undefined,
                  itemId
                }
              });
            }
          });
          
          logger.info({
            message: `Transactions update webhook received: ${webhookCode}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              itemId,
              webhookCode,
              newTransactions: webhookData.new_transactions
            }
          });
          break;
          
        case 'TRANSACTIONS_REMOVED':
          // Transactions have been removed
          // Remove the specified transactions
          await storage.removeTransactions(itemId, webhookData.removed_transactions);
          
          logger.info({
            message: `Transactions removed webhook received`,
            category: "webhook",
            source: "plaid",
            metadata: {
              itemId,
              removedTransactions: webhookData.removed_transactions
            }
          });
          break;
          
        default:
          logger.info({
            message: `Unhandled transactions webhook code: ${webhookCode}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              webhookCode,
              itemId
            }
          });
      }
    } catch (error) {
      logger.error({
        message: `Error processing transactions webhook: ${error instanceof Error ? error.message : String(error)}`,
        category: "webhook",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          webhookCode,
          itemId
        }
      });
      
      throw error;
    }
  },
  
  /**
   * Sync transactions for an item
   * @param accessToken Plaid access token
   * @param itemId Plaid item ID
   */
  async syncTransactions(accessToken: string, itemId: string) {
    try {
      // This is a simplified version - in production this would implement
      // cursor-based pagination as described in Plaid's documentation
      const transactionsResponse = await plaidClient.transactionsSync({
        access_token: accessToken,
        options: {
          include_personal_finance_category: true
        }
      });
      
      const { added, modified, removed, has_more } = transactionsResponse.data;
      
      // Process transactions
      // In a real implementation, we would handle batch processing and pagination
      
      // Process added transactions
      if (added.length > 0) {
        await storage.addTransactions(itemId, added);
        
        logger.info({
          message: `Added ${added.length} transactions for item ${itemId}`,
          category: "api",
          source: "plaid",
          metadata: {
            itemId,
            count: added.length
          }
        });
      }
      
      // Process modified transactions
      if (modified.length > 0) {
        await storage.updateTransactions(itemId, modified);
        
        logger.info({
          message: `Updated ${modified.length} transactions for item ${itemId}`,
          category: "api",
          source: "plaid",
          metadata: {
            itemId,
            count: modified.length
          }
        });
      }
      
      // Process removed transactions
      if (removed.length > 0) {
        await storage.removeTransactions(itemId, removed.map(t => t.transaction_id));
        
        logger.info({
          message: `Removed ${removed.length} transactions for item ${itemId}`,
          category: "api",
          source: "plaid",
          metadata: {
            itemId,
            count: removed.length
          }
        });
      }
      
      // If there are more transactions to fetch, we would recursively call this function
      if (has_more) {
        logger.info({
          message: `More transactions available for item ${itemId}, continuing sync`,
          category: "api",
          source: "plaid"
        });
        
        // In a real implementation, we would continue fetching with the cursor
      }
      
      return {
        added: added.length,
        modified: modified.length,
        removed: removed.length,
        has_more
      };
    } catch (error) {
      logger.error({
        message: `Error syncing transactions: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          itemId
        }
      });
      
      throw error;
    }
  },
  
  /**
   * Get bank connection for a contract
   * @param contractId Contract ID
   * @returns Bank connection or null if not found
   */
  async getBankConnectionForContract(contractId: number) {
    try {
      const connection = await storage.getPlaidConnectionForContract(contractId);
      
      if (!connection) {
        return null;
      }
      
      return connection;
    } catch (error) {
      logger.error({
        message: `Error getting bank connection for contract: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          contractId
        }
      });
      
      throw error;
    }
  },

  /**
   * Authorize a transfer (perform risk assessment and balance check)
   * Uses the transferred service for implementation
   * @param params Authorization parameters
   * @returns The authorization ID if approved, or null if declined
   */
  async authorizeTransfer(params: any) {
    return plaidTransferService.authorizeTransfer(params);
  },

  /**
   * Create a transfer after authorization is approved
   * Uses the transferred service for implementation
   * @param params Transfer parameters
   * @returns Transfer ID and status
   */
  async createTransfer(params: any) {
    return plaidTransferService.createTransfer(params);
  },

  /**
   * Get transfer by ID
   * Uses the transferred service for implementation
   * @param transferId The Plaid transfer ID
   * @returns Transfer details
   */
  async getTransfer(transferId: string) {
    return plaidTransferService.getTransfer(transferId);
  },

  /**
   * Cancel a transfer if it's still cancellable
   * Uses the transferred service for implementation
   * @param transferId The Plaid transfer ID
   * @returns Cancellation result
   */
  async cancelTransfer(transferId: string) {
    return plaidTransferService.cancelTransfer(transferId);
  },

  /**
   * Process a complete payment from customer to merchant
   * Uses the transferred service for implementation
   * @param params Payment parameters
   * @returns Transfer result
   */
  async processPayment(params: any) {
    return plaidTransferService.processPayment(params);
  },

  /**
   * Check platform payment status
   * Uses the transferred service for implementation
   * @param transferId Transfer ID to check
   * @returns Current status of the transfer
   */
  async checkPlatformPaymentStatus(transferId: string) {
    return plaidTransferService.checkPlatformPaymentStatus(transferId);
  },

  /**
   * Exchange a public token for an access token
   * @param publicToken Public token from Plaid Link
   * @returns Object with access token and item ID
   */
  async exchangePublicToken(publicToken: string) {
    // Generate a request ID for tracing across logs
    const requestId = `plaid-exchange-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    try {
      // Verify Plaid service is properly initialized
      if (!this.isInitialized()) {
        logger.error({
          message: "Plaid service not initialized when attempting to exchange public token",
          category: "api",
          source: "plaid",
          metadata: {
            requestId,
            publicTokenLength: publicToken?.length || 0,
            plaidClientId: process.env.PLAID_CLIENT_ID ? "Present" : "Missing",
            plaidSecret: process.env.PLAID_SECRET ? "Present" : "Missing",
            plaidEnvironment: process.env.PLAID_ENVIRONMENT || process.env.PLAID_ENV || "undefined"
          }
        });
        
        throw new Error("Plaid service not initialized when attempting to exchange public token");
      }
      
      // Validate input
      if (!publicToken || typeof publicToken !== 'string' || publicToken.trim() === '') {
        logger.error({
          message: "Invalid public token provided to exchangePublicToken",
          category: "api",
          source: "plaid",
          metadata: {
            requestId,
            publicTokenValid: !!publicToken,
            publicTokenType: typeof publicToken
          }
        });
        
        throw new Error("Invalid public token: token is empty or invalid");
      }
      
      // Log pre-request details
      logger.debug({
        message: "Preparing to exchange Plaid public token",
        category: "api",
        source: "plaid",
        metadata: {
          requestId,
          publicTokenLength: publicToken.length,
          timestamp: new Date().toISOString()
        }
      });

      // Measure API response time for performance monitoring
      const startTime = Date.now();
      
      // Make the request to Plaid
      const response = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken
      });
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Log successful response
      logger.info({
        message: "Successfully exchanged Plaid public token",
        category: "api",
        source: "plaid",
        metadata: {
          requestId,
          responseTime: `${responseTime}ms`,
          itemId: response.data.item_id,
          accessTokenReceived: !!response.data.access_token,
          accessTokenLength: response.data.access_token?.length || 0,
          timestamp: new Date().toISOString()
        }
      });
      
      return {
        accessToken: response.data.access_token,
        itemId: response.data.item_id,
        requestId // Include request ID for client-side tracing
      };
    } catch (error) {
      // Enhanced error handling with structured categorization
      let errorCode = "UNKNOWN";
      let errorType = "INTERNAL_ERROR";
      let errorDetails = "Unknown error";
      
      // Extract detailed error information from Plaid response
      if (error.response?.data) {
        try {
          const plaidError = error.response.data;
          errorDetails = JSON.stringify(plaidError);
          errorCode = plaidError.error_code || "UNKNOWN";
          errorType = plaidError.error_type || "API_ERROR";
          
          // Record detailed error info from Plaid
          logger.error({
            message: `Plaid API error when exchanging public token: ${plaidError.error_message || 'Unknown Plaid error'}`,
            category: 'api',
            source: 'plaid',
            metadata: {
              requestId,
              errorCode,
              errorType,
              errorMessage: plaidError.error_message,
              displayMessage: plaidError.display_message,
              suggestedAction: plaidError.suggested_action,
              plaidRequestId: plaidError.request_id,
              publicTokenLength: publicToken?.length || 0
            }
          });
        } catch (parseError) {
          // Handle errors when parsing the Plaid error response
          logger.error({
            message: "Error parsing Plaid error response during public token exchange",
            category: "api",
            source: "plaid",
            metadata: {
              requestId,
              originalError: String(error),
              parseError: String(parseError),
              responseData: error.response?.data
            }
          });
        }
      } else if (error instanceof Error) {
        // Handle standard JavaScript errors
        errorDetails = error.message;
        
        // Classify network/connection errors
        if (error.message.includes("ETIMEDOUT") || error.message.includes("timeout")) {
          errorCode = "REQUEST_TIMEOUT";
          errorType = "NETWORK_ERROR";
        } else if (error.message.includes("ECONNREFUSED")) {
          errorCode = "CONNECTION_ERROR";
          errorType = "NETWORK_ERROR";
        }
      }
      
      // Log comprehensive error details
      logger.error({
        message: `Error exchanging public token: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          requestId,
          errorType,
          errorCode,
          errorDetails,
          publicTokenLength: publicToken?.length || 0,
          publicTokenFirstChars: publicToken ? `${publicToken.substring(0, 5)}...` : 'null',
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        }
      });
      
      // Enhance error message with request ID and context
      if (error instanceof Error) {
        error.message = `Plaid public token exchange failed: ${error.message} (Request ID: ${requestId})`;
      }
      
      throw error;
    }
  },
  
  /**
   * Get auth data (account and routing numbers)
   * @param accessToken Plaid access token
   * @returns Object with accounts and account numbers
   */
  async getAuth(accessToken: string) {
    try {
      const authResponse = await plaidClient.authGet({
        access_token: accessToken
      });
      
      return {
        accounts: authResponse.data.accounts,
        numbers: authResponse.data.numbers
      };
    } catch (error) {
      logger.error({
        message: `Error getting auth data: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      throw error;
    }
  },
  
  /**
   * Create an asset report for analyzing financial data
   * @param accessToken Plaid access token
   * @param daysRequested Number of days of data to request
   * @param options Additional options for the asset report
   * @returns Object with asset report ID and token
   */
  async createAssetReport(accessToken: string, daysRequested: number, options: any = {}) {
    try {
      const assetReportResponse = await plaidClient.assetReportCreate({
        access_tokens: [accessToken],
        days_requested: daysRequested,
        options: options
      });
      
      return {
        assetReportId: assetReportResponse.data.asset_report_id,
        assetReportToken: assetReportResponse.data.asset_report_token
      };
    } catch (error) {
      logger.error({
        message: `Error creating asset report: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          daysRequested
        }
      });
      
      throw error;
    }
  },

  /**
   * Get an asset report to analyze merchant financial data
   * @param assetReportToken Asset report token
   * @returns Asset report data
   */
  async getAssetReport(assetReportToken: string) {
    try {
      const assetReportResponse = await plaidClient.assetReportGet({
        asset_report_token: assetReportToken,
        include_insights: true
      });
      
      return assetReportResponse.data.report;
    } catch (error) {
      logger.error({
        message: `Error getting asset report: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      throw error;
    }
  },

  /**
   * Analyze financial data from asset report for merchant verification
   * @param assetReportToken Asset report token
   * @returns Analyzed financial data
   */
  async analyzeMerchantFinancials(assetReportToken: string) {
    try {
      // Get the asset report
      const assetReport = await this.getAssetReport(assetReportToken);
      
      // Extract reports for each item
      const items = assetReport.items || [];
      let totalMonthlyRevenue = 0;
      let monthsWithSufficientRevenue = 0;
      let totalMonths = 0;
      const requiredMonthlyRevenue = 100000; // $100k/month minimum
      
      // Process each item (bank connection)
      for (const item of items) {
        // Process accounts for this item
        const accounts = item.accounts || [];
        
        // Find deposit accounts (checking, savings)
        const depositAccounts = accounts.filter(account => 
          account.type === 'depository' && 
          (account.subtype === 'checking' || account.subtype === 'savings')
        );
        
        // Process transactions for each deposit account
        for (const account of depositAccounts) {
          const transactions = account.transactions || [];
          
          // Group transactions by month
          const transactionsByMonth: Record<string, Array<any>> = {};
          
          for (const transaction of transactions) {
            const date = new Date(transaction.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!transactionsByMonth[monthKey]) {
              transactionsByMonth[monthKey] = [];
            }
            
            transactionsByMonth[monthKey].push(transaction);
          }
          
          // Calculate income/revenue for each month
          for (const [month, monthTransactions] of Object.entries(transactionsByMonth)) {
            totalMonths++;
            
            // Sum deposits (credits)
            const monthlyDeposits = monthTransactions
              .filter(t => t.amount < 0) // In Plaid, negative amounts are deposits
              .reduce((sum, t) => sum + Math.abs(t.amount), 0);
            
            // Track months with sufficient revenue
            if (monthlyDeposits >= requiredMonthlyRevenue) {
              monthsWithSufficientRevenue++;
            }
            
            // Add to total (for average)
            totalMonthlyRevenue += monthlyDeposits;
          }
        }
      }
      
      // Calculate average monthly revenue
      const avgMonthlyRevenue = totalMonths > 0 ? totalMonthlyRevenue / totalMonths : 0;
      
      // Determine eligibility based on criteria
      const hasRequiredHistory = totalMonths >= 24; // 2 years minimum
      const hasRequiredRevenue = avgMonthlyRevenue >= requiredMonthlyRevenue;
      const consistentRevenue = hasRequiredHistory && (monthsWithSufficientRevenue / totalMonths) >= 0.75; // At least 75% of months meet criteria
      
      return {
        avgMonthlyRevenue,
        totalMonthlyRevenue,
        monthsWithData: totalMonths,
        monthsWithSufficientRevenue,
        hasRequiredHistory,
        hasRequiredRevenue,
        consistentRevenue,
        eligible: hasRequiredHistory && hasRequiredRevenue && consistentRevenue,
        accounts: items.flatMap(item => item.accounts || [])
      };
    } catch (error) {
      logger.error({
        message: `Error analyzing merchant financials: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      throw error;
    }
  },

  /**
   * This method is already defined at the top of the service
   */

  /**
   * Create an asset report based on customer phone number
   * @param accessToken Plaid access token  
   * @param phoneNumber Customer phone number
   * @param daysRequested Number of days of data to request
   * @param options Additional options for the asset report
   * @returns Object with asset report ID and token
   */
  async createAssetReportByPhone(accessToken: string, phoneNumber: string, daysRequested: number, options: any = {}) {
    try {
      // First create a regular asset report
      const assetReport = await this.createAssetReport(accessToken, daysRequested, options);
      
      // Log the creation with the phone reference
      logger.info({
        message: `Created asset report for customer with phone: ${phoneNumber}`,
        category: "api",
        source: "plaid",
        metadata: {
          phoneNumber,
          assetReportId: assetReport.assetReportId,
          daysRequested
        }
      });
      
      return assetReport;
    } catch (error) {
      logger.error({
        message: `Error creating asset report by phone: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          phoneNumber,
          daysRequested
        }
      });
      
      throw error;
    }
  }
};