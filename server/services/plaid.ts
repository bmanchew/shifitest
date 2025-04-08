import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { storage } from '../storage';
import { logger } from './logger';
import { plaidTransferService } from './plaid.transfers';

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
 * Service for interacting with the Plaid API
 */
export const plaidService = {
  /**
   * Create a link token for initializing Plaid Link
   * @param options Options for creating link token including userId, clientUserId, and products
   * @returns The link token object from Plaid
   */
  async createLinkToken(options: { userId?: string | number, clientUserId: string, products: string[], redirect_uri?: string }) {
    try {
      const { userId, clientUserId, products, redirect_uri } = options;
      
      // Create link token configuration - using any type to avoid TypeScript errors since we're adding dynamic properties
      const config: any = {
        user: {
          client_user_id: clientUserId.toString(),
        },
        client_name: process.env.PLAID_CLIENT_NAME || 'ShiFi Merchant Portal',
        products: products as any[],
        country_codes: ['US'] as any[],
        language: 'en',
        webhook: process.env.PLAID_WEBHOOK_URL,
      };
      
      // Add redirect URI if provided
      if (redirect_uri) {
        config.redirect_uri = redirect_uri;
      }
      
      const response = await plaidClient.linkTokenCreate(config);
      
      logger.info({
        message: `Created Plaid link token for client user ID ${clientUserId}`,
        category: 'plaid',
        userId: typeof userId === 'string' ? undefined : userId,
        source: 'plaid',
        metadata: {
          clientUserId,
          products
        }
      });
      
      return {
        linkToken: response.data.link_token,
        expiration: response.data.expiration
      };
    } catch (error) {
      logger.error({
        message: `Error creating Plaid link token: ${error instanceof Error ? error.message : String(error)}`,
        category: 'plaid',
        source: 'plaid',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          clientUserId: options.clientUserId
        }
      });
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
    try {
      const response = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken
      });
      
      return {
        accessToken: response.data.access_token,
        itemId: response.data.item_id
      };
    } catch (error) {
      logger.error({
        message: `Error exchanging public token: ${error instanceof Error ? error.message : String(error)}`,
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
   * Check if Plaid service is initialized
   * @returns Boolean indicating if Plaid is ready
   */
  isInitialized() {
    return !!plaidClient && !!process.env.PLAID_CLIENT_ID && !!process.env.PLAID_SECRET;
  },

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