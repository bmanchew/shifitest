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
 * Service for interacting with the Plaid API
 */
export const plaidService = {
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
  }
};