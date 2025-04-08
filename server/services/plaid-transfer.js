/**
 * Plaid Transfer Service
 * 
 * This service handles Plaid Transfers for merchants using both:
 * 1. Platform credentials (ShiFi's Plaid API keys)
 * 2. Merchant-specific credentials (when available)
 * 
 * It follows Plaid's documentation for payment transfers:
 * https://plaid.com/docs/api/products/transfer/
 */

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { db } from '../storage.js';

// Environment configuration
const DEFAULT_ENVIRONMENT = process.env.PLAID_ENVIRONMENT || 'production';

/**
 * Initialize Plaid client with appropriate credentials
 * @param {string} environment - Plaid environment (sandbox, development, production)
 * @param {string} clientId - Client ID to use
 * @param {string} secret - Secret to use
 * @returns {PlaidApi} Plaid API client
 */
function getPlaidClient(environment = DEFAULT_ENVIRONMENT, clientId = null, secret = null) {
  // Use platform credentials by default
  const plaidClientId = clientId || process.env.PLAID_CLIENT_ID;
  const plaidSecret = secret || process.env.PLAID_SECRET;
  
  if (!plaidClientId || !plaidSecret) {
    throw new Error('Plaid credentials are not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET.');
  }
  
  // Create Plaid configuration
  const config = new Configuration({
    basePath: PlaidEnvironments[environment] || PlaidEnvironments.production,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': plaidClientId,
        'PLAID-SECRET': plaidSecret,
      },
    },
  });
  
  return new PlaidApi(config);
}

/**
 * Get Plaid client for a specific merchant
 * @param {number} merchantId - ID of the merchant
 * @returns {Promise<{plaidClient: PlaidApi, merchantInfo: any}>} Plaid client and merchant info
 */
export async function getPlaidClientForMerchant(merchantId) {
  // Get the merchant's Plaid credentials from the database
  const plaidMerchant = await db.getPlaidMerchant(merchantId);
  
  if (!plaidMerchant) {
    throw new Error(`No Plaid credentials found for merchant ID ${merchantId}`);
  }
  
  // Determine which credentials to use
  let clientId = process.env.PLAID_CLIENT_ID;
  let secret = process.env.PLAID_SECRET;
  let environment = DEFAULT_ENVIRONMENT;
  
  // If the merchant has specific credentials, use those
  if (plaidMerchant.client_id) {
    clientId = plaidMerchant.client_id;
    secret = process.env.PLAID_MERCHANT_SECRET;
    
    if (!secret) {
      throw new Error('Merchant-specific secret not configured. Please set PLAID_MERCHANT_SECRET.');
    }
  }
  
  // If the merchant has an access token, extract the environment
  if (plaidMerchant.access_token && plaidMerchant.access_token.startsWith('access-')) {
    const tokenParts = plaidMerchant.access_token.split('-');
    if (tokenParts.length > 1) {
      environment = tokenParts[1]; // e.g., "sandbox" or "production"
    }
  }
  
  // Create and return the Plaid client
  const plaidClient = getPlaidClient(environment, clientId, secret);
  
  return { 
    plaidClient, 
    merchantInfo: plaidMerchant 
  };
}

/**
 * Create a transfer authorization
 * @param {number} merchantId - ID of the merchant
 * @param {string} accountId - Plaid account ID
 * @param {string} type - Transfer type (credit or debit)
 * @param {number} amount - Transfer amount in cents
 * @param {string} description - Transfer description
 * @returns {Promise<any>} Transfer authorization
 */
export async function createTransferAuthorization(merchantId, accountId, type, amount, description) {
  const { plaidClient, merchantInfo } = await getPlaidClientForMerchant(merchantId);
  
  if (!merchantInfo.access_token) {
    throw new Error(`Merchant ID ${merchantId} has no access token`);
  }
  
  // Create the transfer authorization
  const authorizationRequest = {
    access_token: merchantInfo.access_token,
    account_id: accountId,
    type,
    network: 'ach',
    amount: amount.toString(),
    ach_class: 'ppd',
    user: {
      legal_name: merchantInfo.merchant_name || `Merchant ${merchantId}`,
    },
    description,
  };
  
  const authorizationResponse = await plaidClient.transferAuthorizationCreate(authorizationRequest);
  return authorizationResponse.data;
}

/**
 * Create a transfer
 * @param {number} merchantId - ID of the merchant
 * @param {string} authorizationId - Transfer authorization ID
 * @param {string} description - Transfer description
 * @param {string} metadata - Additional metadata
 * @returns {Promise<any>} Transfer
 */
export async function createTransfer(merchantId, authorizationId, description, metadata = {}) {
  const { plaidClient } = await getPlaidClientForMerchant(merchantId);
  
  // Create the transfer
  const transferRequest = {
    authorization_id: authorizationId,
    description,
    metadata,
  };
  
  const transferResponse = await plaidClient.transferCreate(transferRequest);
  return transferResponse.data;
}

/**
 * Get transfer by ID
 * @param {number} merchantId - ID of the merchant
 * @param {string} transferId - Transfer ID
 * @returns {Promise<any>} Transfer
 */
export async function getTransfer(merchantId, transferId) {
  const { plaidClient } = await getPlaidClientForMerchant(merchantId);
  
  // Get the transfer
  const transferResponse = await plaidClient.transferGet({
    transfer_id: transferId,
  });
  
  return transferResponse.data;
}

/**
 * Get transfers for a merchant
 * @param {number} merchantId - ID of the merchant
 * @param {number} count - Number of transfers to retrieve
 * @param {number} offset - Offset for pagination
 * @returns {Promise<any>} Transfers
 */
export async function getTransfersForMerchant(merchantId, count = 25, offset = 0) {
  const { plaidClient, merchantInfo } = await getPlaidClientForMerchant(merchantId);
  
  // Get the transfers
  const transfersResponse = await plaidClient.transferList({
    count,
    offset,
    origination_account_id: merchantInfo.originator_id,
  });
  
  return transfersResponse.data;
}

/**
 * Create a payment recipient
 * @param {number} merchantId - ID of the merchant
 * @param {string} name - Recipient name
 * @param {string} type - Recipient type (individual or business)
 * @param {object} address - Recipient address
 * @returns {Promise<any>} Recipient
 */
export async function createRecipient(merchantId, name, type, address) {
  const { plaidClient } = await getPlaidClientForMerchant(merchantId);
  
  // Create the recipient
  const recipientResponse = await plaidClient.transferRecipientCreate({
    name,
    type,
    address,
  });
  
  return recipientResponse.data;
}

/**
 * Create funding account for a merchant
 * @param {number} merchantId - ID of the merchant
 * @param {string} accountName - Account name
 * @returns {Promise<any>} Funding account
 */
export async function createFundingAccount(merchantId, accountName) {
  const { plaidClient, merchantInfo } = await getPlaidClientForMerchant(merchantId);
  
  if (!merchantInfo.access_token) {
    throw new Error(`Merchant ID ${merchantId} has no access token`);
  }
  
  // Create the funding account
  const fundingAccountResponse = await plaidClient.transferFundingAccountCreate({
    access_token: merchantInfo.access_token,
    account_id: merchantInfo.account_id,
    account_name: accountName,
  });
  
  return fundingAccountResponse.data;
}

/**
 * Cancel a transfer
 * @param {number} merchantId - ID of the merchant
 * @param {string} transferId - Transfer ID
 * @returns {Promise<any>} Cancelled transfer
 */
export async function cancelTransfer(merchantId, transferId) {
  const { plaidClient } = await getPlaidClientForMerchant(merchantId);
  
  // Cancel the transfer
  const cancelResponse = await plaidClient.transferCancel({
    transfer_id: transferId,
  });
  
  return cancelResponse.data;
}

// Export the default client for general platform use
export const platformPlaidClient = getPlaidClient();