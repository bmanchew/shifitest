/**
 * This script generates asset reports for all merchants with completed Plaid onboarding
 * 
 * Usage: node generate-asset-reports-for-completed-merchants.cjs
 * 
 * Requirements:
 * - Merchant must have status "completed" in plaid_merchants table
 * - Merchant must have a valid Plaid access token
 * - PLAID_CLIENT_ID and PLAID_SECRET environment variables must be set
 * - For specialized merchant credentials, use PLAID_MERCHANT_SECRET
 */

// Import required modules
const pg = require('pg');
const dotenv = require('dotenv');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

// Load environment variables
dotenv.config();

// Configure days requested for asset reports
const DAYS_REQUESTED = 90;

// Database connection setup
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

/**
 * Initialize Plaid client
 * @param {string} environment - Plaid environment (sandbox, development, production)
 * @param {string} clientId - Plaid client ID
 * @param {string} secret - Plaid secret
 * @returns {PlaidApi} Plaid API client
 */
function getPlaidClient(environment, clientId, secret) {
  console.log(`Initializing Plaid client for environment: ${environment}`);
  console.log(`Using client ID: ${clientId.substring(0, 6)}...`);
  
  const plaidConfig = new Configuration({
    basePath: PlaidEnvironments[environment] || PlaidEnvironments[process.env.PLAID_ENVIRONMENT] || PlaidEnvironments.production,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });
  
  return new PlaidApi(plaidConfig);
}

/**
 * Main function to generate asset reports for all completed merchants
 */
async function generateAssetReportsForCompletedMerchants() {
  const client = new pg.Client(dbConfig);
  
  try {
    // Connect to the database
    await client.connect();
    
    // Get all completed merchants with Plaid access tokens
    const merchantResult = await client.query(
      `SELECT m.id as merchant_id, m.name as merchant_name, pm.* 
       FROM plaid_merchants pm
       JOIN merchants m ON pm.merchant_id = m.id
       WHERE pm.onboarding_status = 'completed'
       AND pm.access_token IS NOT NULL
       ORDER BY pm.merchant_id ASC`
    );
    
    console.log(`Found ${merchantResult.rowCount} completed merchants with Plaid access tokens`);
    
    // Prepare statistics
    const stats = {
      total: merchantResult.rowCount,
      successful: 0,
      failed: 0,
      skipped: 0,
    };
    
    const processedMerchants = [];
    
    // Process each merchant
    for (const merchant of merchantResult.rows) {
      console.log(`\n========== Processing merchant ID ${merchant.merchant_id}: ${merchant.merchant_name} ==========`);
      
      try {
        // Check if access token format seems valid
        if (!merchant.access_token.startsWith('access-')) {
          console.log(`Invalid access token format for merchant ID ${merchant.merchant_id}. Expected format: access-<environment>-<identifier>`);
          console.log(`Current value: ${merchant.access_token.substring(0, 10)}...`);
          console.log(`Skipping this merchant.`);
          stats.skipped++;
          processedMerchants.push({
            merchant_id: merchant.merchant_id,
            name: merchant.merchant_name,
            status: 'skipped',
            reason: 'Invalid access token format'
          });
          continue;
        }
        
        // Extract environment from access token (e.g., "sandbox" from "access-sandbox-...")
        const tokenParts = merchant.access_token.split('-');
        const environment = tokenParts.length > 1 ? tokenParts[1] : 'sandbox';
        
        console.log(`Access token environment: ${environment}`);
        
        // Determine which credentials to use
        let clientId = process.env.PLAID_CLIENT_ID;
        let secret = process.env.PLAID_SECRET;
        
        // If merchant has a specific client_id, use that with PLAID_MERCHANT_SECRET
        if (merchant.client_id) {
          console.log(`Using merchant-specific client ID: ${merchant.client_id.substring(0, 6)}...`);
          clientId = merchant.client_id;
          
          // Check if merchant-specific secret is available
          if (process.env.PLAID_MERCHANT_SECRET) {
            console.log(`Using merchant-specific secret key`);
            secret = process.env.PLAID_MERCHANT_SECRET;
          } else {
            console.log(`Warning: Missing PLAID_MERCHANT_SECRET environment variable for merchant-specific client ID`);
            console.log(`This might cause authentication errors with Plaid API`);
          }
        }
        
        // Initialize Plaid client with appropriate credentials
        const plaidClient = getPlaidClient(environment, clientId, secret);
        
        // Create asset report
        console.log(`Creating asset report for merchant ID ${merchant.merchant_id} using access token: ${merchant.access_token.substring(0, 8)}...`);
        
        const assetReportResponse = await plaidClient.assetReportCreate({
          access_tokens: [merchant.access_token],
          days_requested: DAYS_REQUESTED,
          options: {
            client_report_id: `merchant-${merchant.merchant_id}-${Date.now()}`,
            webhook: process.env.PLAID_WEBHOOK_URL || 'https://shilohfinance.com/api/plaid/webhook',
            user: {
              client_user_id: `merchant-${merchant.merchant_id}`,
            }
          }
        });
        
        const assetReportResult = {
          assetReportId: assetReportResponse.data.asset_report_id,
          assetReportToken: assetReportResponse.data.asset_report_token
        };
        
        console.log(`Asset report created successfully!`);
        console.log(`Asset Report ID: ${assetReportResult.assetReportId}`);
        console.log(`Asset Report Token: ${assetReportResult.assetReportToken.substring(0, 8)}...`);
        
        // Store the asset report in the database
        const storeResult = await client.query(
          `INSERT INTO asset_reports 
           (contract_id, user_id, asset_report_id, asset_report_token, days_requested, status, analysis_data, created_at)
           VALUES (0, $1, $2, $3, $4, 'pending', $5, NOW())
           RETURNING id`,
          [
            merchant.merchant_id,
            assetReportResult.assetReportId,
            assetReportResult.assetReportToken,
            DAYS_REQUESTED,
            JSON.stringify({
              generatedBy: 'batch-asset-report-script',
              timestamp: new Date().toISOString()
            })
          ]
        );
        
        console.log(`Asset report stored in database with ID: ${storeResult.rows[0].id}`);
        
        stats.successful++;
        processedMerchants.push({
          merchant_id: merchant.merchant_id,
          name: merchant.merchant_name,
          status: 'success',
          asset_report_id: assetReportResult.assetReportId
        });
      } catch (error) {
        console.error(`Error generating asset report for merchant ID ${merchant.merchant_id}:`, error.message);
        
        // Log more detailed error information if available
        if (error.response && error.response.data) {
          console.error('Plaid API Error Details:');
          console.error(JSON.stringify(error.response.data, null, 2));
        }
        
        stats.failed++;
        processedMerchants.push({
          merchant_id: merchant.merchant_id,
          name: merchant.merchant_name,
          status: 'failed',
          error: error.message,
          error_details: error.response && error.response.data ? error.response.data : null
        });
      }
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Print summary
    console.log("\n========== Asset Report Generation Summary ==========");
    console.log(`Total merchants processed: ${stats.total}`);
    console.log(`Successful: ${stats.successful}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log("\nProcessed merchants:");
    console.table(processedMerchants.map(m => ({
      merchant_id: m.merchant_id,
      name: m.name,
      status: m.status
    })));
    
    console.log("\nNote: Asset reports are generated asynchronously by Plaid.");
    console.log("You will receive webhooks when each report is ready for viewing.");
    
    return {
      stats,
      processedMerchants
    };
  } catch (error) {
    console.error("General script error:", error.message);
    throw error;
  } finally {
    // Close the database connection
    await client.end();
  }
}

/**
 * Handle script execution
 */
generateAssetReportsForCompletedMerchants()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });