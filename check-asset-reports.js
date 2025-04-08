/**
 * This script checks the status of all recently generated asset reports
 * for merchants with Plaid integrations.
 * 
 * Usage: node check-asset-reports.js
 */

// Import required modules
const pg = require('pg');
const dotenv = require('dotenv');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

// Load environment variables
dotenv.config();

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
    basePath: PlaidEnvironments[environment] || PlaidEnvironments[process.env.PLAID_ENVIRONMENT] || PlaidEnvironments.sandbox,
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
 * Checks status of recently generated asset reports
 */
async function checkAssetReportStatus() {
  const client = new pg.Client(dbConfig);
  
  try {
    // Connect to the database
    await client.connect();
    
    // Get pending asset reports
    const pendingReportsResult = await client.query(
      `SELECT ar.*, m.name as merchant_name, pm.client_id, pm.access_token
       FROM asset_reports ar
       JOIN plaid_merchants pm ON ar.user_id = pm.merchant_id
       JOIN merchants m ON pm.merchant_id = m.id
       WHERE ar.status = 'pending'
       ORDER BY ar.created_at DESC`
    );
    
    console.log(`Found ${pendingReportsResult.rowCount} pending asset reports`);
    
    if (pendingReportsResult.rowCount === 0) {
      console.log('No pending asset reports to check.');
      return {
        checked: 0,
        updated: 0
      };
    }
    
    // Prepare statistics
    const stats = {
      checked: pendingReportsResult.rowCount,
      ready: 0,
      still_pending: 0,
      error: 0
    };
    
    // Process each pending report
    for (const report of pendingReportsResult.rows) {
      console.log(`\n========== Checking asset report ID ${report.id} for merchant ${report.merchant_name} ==========`);
      console.log(`Asset Report Token: ${report.asset_report_token.substring(0, 8)}...`);
      
      try {
        // Extract environment from access token (e.g., "sandbox" from "access-sandbox-...")
        const tokenParts = report.access_token.split('-');
        const environment = tokenParts.length > 1 ? tokenParts[1] : 'sandbox';
        
        console.log(`Access token environment: ${environment}`);
        
        // Determine which credentials to use
        let clientId = process.env.PLAID_CLIENT_ID;
        let secret = process.env.PLAID_SECRET;
        
        // If merchant has a specific client_id, use that with PLAID_MERCHANT_SECRET
        if (report.client_id) {
          console.log(`Using merchant-specific client ID: ${report.client_id.substring(0, 6)}...`);
          clientId = report.client_id;
          
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
        
        // Check asset report status
        console.log(`Checking status of asset report with token: ${report.asset_report_token.substring(0, 8)}...`);
        
        try {
          // Try to get the asset report - if successful, it's ready
          const assetReportResponse = await plaidClient.assetReportGet({
            asset_report_token: report.asset_report_token,
            include_insights: true
          });
          
          console.log(`Asset report is READY!`);
          
          // Update asset report status in database
          await client.query(
            `UPDATE asset_reports 
             SET status = 'ready', 
                 refreshed_at = NOW(),
                 analysis_data = $1 
             WHERE id = $2`,
            [
              JSON.stringify({
                report_date: new Date().toISOString(),
                assets: assetReportResponse.data.report.items
                  .map(item => item.accounts)
                  .flat()
                  .map(account => ({
                    name: account.name,
                    type: account.type,
                    subtype: account.subtype,
                    mask: account.mask,
                    balance_available: account.balances.available,
                    balance_current: account.balances.current,
                  }))
              }),
              report.id
            ]
          );
          
          stats.ready++;
          console.log(`Updated asset report status to 'ready' in database`);
        } catch (getError) {
          // If the error is PRODUCT_NOT_READY, the report is still pending
          if (getError.response && 
              getError.response.data && 
              getError.response.data.error_code === 'PRODUCT_NOT_READY') {
            console.log(`Asset report is still being generated by Plaid`);
            stats.still_pending++;
          } else {
            // Otherwise, there was an error
            console.error(`Error retrieving asset report:`, getError.message);
            
            if (getError.response && getError.response.data) {
              console.error('Plaid API Error Details:');
              console.error(JSON.stringify(getError.response.data, null, 2));
            }
            
            // Update asset report status to error in database
            await client.query(
              `UPDATE asset_reports 
               SET status = 'error', 
                   refreshed_at = NOW(),
                   analysis_data = $1 
               WHERE id = $2`,
              [
                JSON.stringify({
                  error: getError.message,
                  error_code: getError.response && getError.response.data ? 
                    getError.response.data.error_code : 'UNKNOWN',
                  error_type: getError.response && getError.response.data ? 
                    getError.response.data.error_type : 'UNKNOWN',
                  timestamp: new Date().toISOString()
                }),
                report.id
              ]
            );
            
            stats.error++;
            console.log(`Updated asset report status to 'error' in database`);
          }
        }
      } catch (outerError) {
        console.error(`Error processing asset report check:`, outerError.message);
        stats.error++;
      }
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Print summary
    console.log("\n========== Asset Report Check Summary ==========");
    console.log(`Total asset reports checked: ${stats.checked}`);
    console.log(`Ready: ${stats.ready}`);
    console.log(`Still pending: ${stats.still_pending}`);
    console.log(`Errors: ${stats.error}`);
    
    return stats;
  } catch (error) {
    console.error("General script error:", error.message);
    throw error;
  } finally {
    // Close the database connection
    await client.end();
  }
}

// Run the script
checkAssetReportStatus()
  .then(stats => {
    console.log('Asset report check completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });