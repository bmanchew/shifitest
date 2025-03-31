/**
 * Plaid API Service
 * 
 * This service handles interactions with the Plaid API for investor bank account connections,
 * enabling secure linking of bank accounts for investments and distributions.
 */

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { logger } from './logger';

// Configure Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox, // Use 'development' or 'production' for non-sandbox environments
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
      'PLAID-SECRET': process.env.PLAID_SECRET || '',
    },
  },
});

// Initialize Plaid client
const plaidClient = new PlaidApi(configuration);

/**
 * Create a link token for initializing Plaid Link
 * @param userId The ID of the user for whom we're creating the link token
 * @param clientName The name of the client app
 * @returns The link token object from Plaid
 */
export async function createLinkToken(userId: number, clientName: string = 'ShiFi Investments') {
  try {
    const request = {
      user: {
        client_user_id: userId.toString(),
      },
      client_name: clientName,
      products: ['auth', 'transactions'] as Products[],
      country_codes: ['US'] as CountryCode[],
      language: 'en',
    };

    const response = await plaidClient.linkTokenCreate(request);
    logger.info(`Created Plaid link token for user ${userId}`, {
      category: 'plaid',
      action: 'create_link_token',
      userId
    });
    
    return response.data;
  } catch (error) {
    logger.error(`Error creating Plaid link token for user ${userId}`, {
      error: error instanceof Error ? error.message : String(error),
      category: 'plaid',
      action: 'create_link_token_error',
      userId
    });
    throw error;
  }
}

/**
 * Exchange a public token for access token and item ID
 * @param publicToken The public token received from Plaid Link
 * @returns The access token and item ID
 */
export async function exchangePublicToken(publicToken: string) {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    
    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    
    logger.info(`Exchanged Plaid public token for access token`, {
      category: 'plaid',
      action: 'exchange_public_token',
      itemId
    });
    
    return { accessToken, itemId };
  } catch (error) {
    logger.error(`Error exchanging Plaid public token`, {
      error: error instanceof Error ? error.message : String(error),
      category: 'plaid',
      action: 'exchange_public_token_error'
    });
    throw error;
  }
}

/**
 * Get account information using an access token
 * @param accessToken The Plaid access token
 * @returns Account information
 */
export async function getAccountInfo(accessToken: string) {
  try {
    const response = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    
    logger.info(`Retrieved account information from Plaid`, {
      category: 'plaid',
      action: 'get_accounts',
      accountCount: response.data.accounts.length
    });
    
    return response.data;
  } catch (error) {
    logger.error(`Error getting account information from Plaid`, {
      error: error instanceof Error ? error.message : String(error),
      category: 'plaid',
      action: 'get_accounts_error'
    });
    throw error;
  }
}

/**
 * Initialize a transfer to facilitate investment funding
 * @param accessToken The Plaid access token 
 * @param accountId The account ID from which to transfer funds
 * @param amount The amount to transfer
 * @param description The description of the transfer
 * @returns Transfer information
 */
export async function initiateTransfer(
  accessToken: string,
  accountId: string,
  amount: number,
  description: string
) {
  try {
    // This is a simplified version, actual implementation would require additional setup
    // and potentially the use of Plaid's payment_initiation API or a third-party processor
    
    logger.info(`Initiated transfer of $${amount} from account ${accountId}`, {
      category: 'plaid',
      action: 'initiate_transfer',
      amount,
      accountId
    });
    
    // Return mock transfer ID for now, this should be replaced with actual implementation
    return {
      transferId: `tr_${Date.now()}`,
      amount,
      status: 'pending'
    };
  } catch (error) {
    logger.error(`Error initiating transfer`, {
      error: error instanceof Error ? error.message : String(error),
      category: 'plaid',
      action: 'initiate_transfer_error',
      amount,
      accountId
    });
    throw error;
  }
}

// Export the Plaid service
export const plaidService = {
  createLinkToken,
  exchangePublicToken,
  getAccountInfo,
  initiateTransfer
};