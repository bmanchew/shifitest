/**
 * This script generates an asset report for a specific merchant ID
 * 
 * Usage: node generate-merchant-asset-report.cjs <merchant_id>
 * 
 * Example: node generate-merchant-asset-report.cjs 46
 */

// Import required modules
const pg = require('pg');
const dotenv = require('dotenv');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

// Load environment variables
dotenv.config();

// Get merchant ID from command line argument
const merchantId = process.argv[2];

if (!merchantId) {
  console.error('Error: Merchant ID is required');
  console.error('Usage: node generate-merchant-asset-report.cjs <merchant_id>');
  process.exit(1);
}

// Database connection config
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Configure Plaid
console.log('Raw environment variable PLAID_ENVIRONMENT:', process.env.PLAID_ENVIRONMENT);

// Force the environment to match the access token prefix - 'sandbox' for testing 
const plaidEnvironment = 'sandbox';
console.log('Forced Plaid environment to:', plaidEnvironment);

// We'll retrieve and use the merchant-specific client ID when we get the merchant data
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[plaidEnvironment] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

// Configure Plaid days requested
const DAYS_REQUESTED = 90; // Default: 90 days

async function generateAssetReportForMerchant() {
  const client = new pg.Client(dbConfig);
  
  try {
    console.log(`Generating asset report for merchant ID ${merchantId}...`);
    
    // Connect to the database
    await client.connect();
    
    // Check if the merchant exists
    const merchantCheck = await client.query(
      'SELECT id FROM merchants WHERE id = $1',
      [merchantId]
    );
    
    if (merchantCheck.rowCount === 0) {
      throw new Error(`Merchant with ID ${merchantId} not found`);
    }
    
    // Get the merchant's Plaid access token
    const plaidMerchantResult = await client.query(
      'SELECT * FROM plaid_merchants WHERE merchant_id = $1',
      [merchantId]
    );
    
    if (plaidMerchantResult.rowCount === 0) {
      throw new Error(`No Plaid credentials found for merchant ID ${merchantId}`);
    }
    
    const plaidMerchant = plaidMerchantResult.rows[0];
    
    if (!plaidMerchant.access_token) {
      throw new Error(`Merchant ID ${merchantId} has no access token`);
    }
    
    console.log(`Found Plaid credentials for merchant ID ${merchantId}`);
    console.log(`Onboarding Status: ${plaidMerchant.onboarding_status}`);
    console.log(`Merchant client_id: ${plaidMerchant.client_id}`);
    
    // Use merchant-specific client ID and secret if available
    if (plaidMerchant.client_id) {
      // Update the Plaid API configuration with merchant's client_id and secret
      plaidClient.configuration.baseOptions.headers['PLAID-CLIENT-ID'] = plaidMerchant.client_id;
      plaidClient.configuration.baseOptions.headers['PLAID-SECRET'] = process.env.PLAID_MERCHANT_SECRET;
      console.log(`Using merchant's client_id: ${plaidMerchant.client_id.substring(0, 6)}...`);
      console.log(`Using merchant's secret: ${process.env.PLAID_MERCHANT_SECRET ? process.env.PLAID_MERCHANT_SECRET.substring(0, 6) + '...' : 'undefined'}`);
    }
    
    // Create the asset report
    console.log(`Creating asset report using access token: ${plaidMerchant.access_token.substring(0, 4)}...${plaidMerchant.access_token.substring(plaidMerchant.access_token.length - 4)}`);
    console.log(`Using Plaid environment: ${process.env.PLAID_ENVIRONMENT || 'sandbox'}`);
    console.log(`Using Plaid client ID: ${plaidClient.configuration.baseOptions.headers['PLAID-CLIENT-ID'].substring(0, 6)}...`);
    console.log(`Using Plaid secret: ${process.env.PLAID_SECRET ? process.env.PLAID_SECRET.substring(0, 6) + '...' : 'undefined'}`);
    
    const requestParams = {
      access_tokens: [plaidMerchant.access_token],
      days_requested: DAYS_REQUESTED,
      options: {
        client_report_id: `merchant-${merchantId}-${Date.now()}`,
        webhook: process.env.PLAID_WEBHOOK_URL || 'https://shilohfinance.com/api/plaid/webhook',
        user: {
          client_user_id: `merchant-${merchantId}`,
        }
      }
    };
    
    console.log('Request params:', JSON.stringify(requestParams, null, 2));
    
    // Direct call to Plaid API
    const assetReportResponse = await plaidClient.assetReportCreate(requestParams);
    
    const assetReportResult = {
      assetReportId: assetReportResponse.data.asset_report_id,
      assetReportToken: assetReportResponse.data.asset_report_token
    };
    
    console.log(`Asset report created successfully!`);
    console.log(`Asset Report ID: ${assetReportResult.assetReportId}`);
    console.log(`Asset Report Token: ${assetReportResult.assetReportToken.substring(0, 4)}...${assetReportResult.assetReportToken.substring(assetReportResult.assetReportToken.length - 4)}`);
    
    // Store the asset report in the database
    const storeResult = await client.query(
      `INSERT INTO asset_reports 
       (contract_id, user_id, asset_report_id, asset_report_token, days_requested, status, analysis_data, created_at)
       VALUES (0, $1, $2, $3, $4, 'pending', $5, NOW())
       RETURNING id`,
      [
        merchantId,
        assetReportResult.assetReportId,
        assetReportResult.assetReportToken,
        DAYS_REQUESTED,
        JSON.stringify({
          generatedBy: 'merchant-asset-report-script',
          timestamp: new Date().toISOString()
        })
      ]
    );
    
    console.log(`Asset report stored in database with ID: ${storeResult.rows[0].id}`);
    
    console.log('\n✅ Asset report generation complete.');
    console.log('Note: Asset reports are generated asynchronously by Plaid.');
    console.log('You will receive webhooks when the report is ready for viewing.');
    
    return assetReportResult;
  } catch (error) {
    console.error('Error generating asset report:', error.message);
    
    // Log more detailed error information if available
    if (error.response && error.response.data) {
      console.error('Plaid API Error Details:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    throw error;
  } finally {
    // Close the database connection
    await client.end();
  }
}

// Run the script
generateAssetReportForMerchant()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
