/**
 * This script generates Plaid asset reports for merchants
 * using their individual Plaid API credentials
 * 
 * Usage: npx tsx generate-merchant-reports.ts
 */

import { db } from '../server/db.cjs';
import { plaidService } from '../server/services/plaid.ts';
import { storage } from '../server/storage.ts';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Define types for our script
interface PlaidMerchant {
  merchantId: number;
  clientId?: string;
  accessToken?: string;
  itemId?: string;
  onboardingStatus: string;
}

interface AssetReportResult {
  assetReportToken: string;
  assetReportId: string;
}

interface ResultItem {
  merchantId: number;
  assetReportId?: string;
  error?: string;
}

interface Results {
  success: ResultItem[];
  failed: ResultItem[];
}

// Configure Plaid days requested
const DAYS_REQUESTED = 90; // Default: 90 days

/**
 * Create a custom Plaid client for a specific merchant using their API keys
 * @param merchantId The merchant ID
 * @param plaidClientId The merchant's Plaid client ID
 * @returns PlaidApi instance configured for this merchant
 */
async function createMerchantPlaidClient(merchantId: number, plaidClientId: string): Promise<PlaidApi | null> {
  try {
    // In a production environment, we would need to securely retrieve the merchant's Plaid secret
    // For this implementation, we're assuming we can use our own secret with their client ID
    // This is a simplification and depends on your specific Plaid setup
    
    // You would need to implement a secure way to store and retrieve merchant-specific Plaid secrets
    // This might involve an encrypted storage solution or a vault service
    
    // For now, we'll use our system Plaid secret with their client ID
    const plaidSecret = process.env.PLAID_SECRET;
    
    if (!plaidSecret) {
      console.error(`No Plaid secret available in environment for merchant ${merchantId}`);
      return null;
    }
    
    // Create a custom configuration for this merchant
    const merchantConfiguration = new Configuration({
      basePath: PlaidEnvironments[process.env.PLAID_ENVIRONMENT as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': plaidClientId,
          'PLAID-SECRET': plaidSecret,
        },
      },
    });
    
    return new PlaidApi(merchantConfiguration);
  } catch (error) {
    console.error(`Error creating Plaid client for merchant ${merchantId}:`, error);
    return null;
  }
}

/**
 * Generate an asset report using merchant-specific Plaid client
 * @param merchantId The merchant ID
 * @param plaidClientId The merchant's Plaid client ID
 * @param accessToken Optional access token if available
 * @returns Asset report result or null if failed
 */
async function generateAssetReportForMerchant(
  merchantId: number, 
  plaidClientId: string,
  accessToken?: string
): Promise<AssetReportResult | null> {
  try {
    // Create a merchant-specific Plaid client
    const merchantPlaidClient = await createMerchantPlaidClient(merchantId, plaidClientId);
    
    if (!merchantPlaidClient) {
      throw new Error('Failed to create Plaid client for merchant');
    }
    
    // If we have an access token, use it (preferred approach)
    if (accessToken) {
      // Use the merchant's Plaid client to create an asset report
      const assetReportResponse = await merchantPlaidClient.assetReportCreate({
        access_tokens: [accessToken],
        days_requested: DAYS_REQUESTED,
        options: {
          client_report_id: `merchant-${merchantId}-${Date.now()}`,
          webhook: process.env.PUBLIC_URL || 'https://shilohfinance.com/api/plaid/webhook',
          user: {
            client_user_id: `merchant-${merchantId}`,
          }
        }
      });
      
      return {
        assetReportId: assetReportResponse.data.asset_report_id,
        assetReportToken: assetReportResponse.data.asset_report_token
      };
    } else {
      // If no access token is available, we need to get all accounts for this merchant
      // This is a simplified example - in a real implementation, you'd need to
      // retrieve the merchant's linked accounts and use their access tokens
      
      // For demonstration purposes only
      throw new Error('No access token available and direct API-based asset report generation not supported');
    }
  } catch (error: any) {
    console.error(`Error generating asset report for merchant ${merchantId}:`, error.message);
    return null;
  }
}

/**
 * Main function to generate asset reports for all completed merchants
 */
async function generateAssetReportsForAllMerchants() {
  try {
    console.log('Starting asset report generation for all completed merchants using merchant-specific API keys...');
    
    // Get all merchants with 'completed' Plaid onboarding status
    const completedMerchants = await storage.getPlaidMerchantsByStatus('completed');
    
    console.log(`Found ${completedMerchants.length} merchants with completed Plaid integration.`);
    
    // Keep track of success and failures
    const results: Results = {
      success: [],
      failed: []
    };
    
    // Process each merchant
    for (const merchant of completedMerchants as PlaidMerchant[]) {
      try {
        // Check if merchant has a client ID
        if (!merchant.clientId) {
          console.log(`Merchant ID ${merchant.merchantId} has no Plaid client ID, skipping...`);
          results.failed.push({
            merchantId: merchant.merchantId,
            error: 'No Plaid client ID available'
          } as ResultItem);
          continue;
        }
        
        console.log(`Generating asset report for merchant ID ${merchant.merchantId}...`);
        
        // Generate asset report using merchant-specific Plaid client
        const assetReportResult = await generateAssetReportForMerchant(
          merchant.merchantId,
          merchant.clientId,
          merchant.accessToken
        );
        
        if (!assetReportResult) {
          throw new Error('Failed to generate asset report');
        }
        
        console.log(`Asset report created with ID: ${assetReportResult.assetReportId}`);
        
        // Store the asset report token in the database
        await storage.storeAssetReportToken(
          0, // No contract ID, we're just generating reports for merchants
          assetReportResult.assetReportToken,
          assetReportResult.assetReportId,
          {
            userId: merchant.merchantId,
            daysRequested: DAYS_REQUESTED,
            metadata: JSON.stringify({
              generatedBy: 'merchant-specific-credentials-script',
              timestamp: new Date().toISOString()
            })
          }
        );
        
        console.log(`Asset report token stored for merchant ID ${merchant.merchantId}`);
        
        results.success.push({
          merchantId: merchant.merchantId,
          assetReportId: assetReportResult.assetReportId
        } as ResultItem);
        
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`Error generating asset report for merchant ID ${merchant.merchantId}:`, error.message);
        results.failed.push({
          merchantId: merchant.merchantId,
          error: error.message
        } as ResultItem);
      }
    }
    
    // Print summary
    console.log('\n--- ASSET REPORT GENERATION SUMMARY ---');
    console.log(`Total merchants processed: ${completedMerchants.length}`);
    console.log(`Successful reports: ${results.success.length}`);
    console.log(`Failed reports: ${results.failed.length}`);
    
    if (results.success.length > 0) {
      console.log('\nSuccessful asset reports:');
      results.success.forEach((item: ResultItem) => {
        console.log(`  - Merchant ID: ${item.merchantId}, Asset Report ID: ${item.assetReportId}`);
      });
    }
    
    if (results.failed.length > 0) {
      console.log('\nFailed asset reports:');
      results.failed.forEach((item: ResultItem) => {
        console.log(`  - Merchant ID: ${item.merchantId}, Error: ${item.error}`);
      });
    }
    
    console.log('\nAsset report generation complete.');
    console.log('Note: Asset reports are generated asynchronously by Plaid.');
    console.log('You will receive webhooks when each report is ready for viewing.');
    
    // Return the results
    return results;
  } catch (error) {
    console.error('Error in asset report generation:', error);
    throw error;
  } finally {
    // Close the database connection
    console.log('Closing database connection...');
    // db.end() not available in this context, the database will close when the script exits
  }
}

// Run the script if it's the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAssetReportsForAllMerchants()
    .then(() => {
      console.log('Script execution completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
}

export { generateAssetReportsForAllMerchants };