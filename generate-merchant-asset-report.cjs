/**
 * This script generates a Plaid asset report for a specific merchant
 * 
 * Usage: node generate-merchant-asset-report.cjs <merchantId>
 */

// Import required modules
const { db } = require('./server/db.cjs');
const pg = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get command line arguments
const merchantId = process.argv[2];

// Validate input
if (!merchantId) {
  console.error(`
Usage: node generate-merchant-asset-report.cjs <merchantId>

Required:
  - merchantId: The merchant ID to generate an asset report for
  `);
  process.exit(1);
}

// Database connection setup
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

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
    
    // Load Plaid service
    const { default: PlaidService } = require('./server/services/plaid');
    
    // Initialize Plaid service with environment variables
    const plaidService = new PlaidService({
      clientId: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      environment: process.env.PLAID_ENV || 'sandbox'
    });
    
    // Create the asset report
    console.log(`Creating asset report using access token: ${plaidMerchant.access_token.substring(0, 4)}...${plaidMerchant.access_token.substring(plaidMerchant.access_token.length - 4)}`);
    
    // Create asset report
    const assetReportResult = await plaidService.createAssetReport(
      plaidMerchant.access_token, 
      DAYS_REQUESTED, 
      {
        client_report_id: `merchant-${merchantId}-${Date.now()}`,
        webhook: process.env.PLAID_WEBHOOK_URL || 'https://shilohfinance.com/api/plaid/webhook',
        user: {
          client_user_id: `merchant-${merchantId}`,
        }
      }
    );
    
    console.log(`Asset report created successfully!`);
    console.log(`Asset Report ID: ${assetReportResult.assetReportId}`);
    console.log(`Asset Report Token: ${assetReportResult.assetReportToken.substring(0, 4)}...${assetReportResult.assetReportToken.substring(assetReportResult.assetReportToken.length - 4)}`);
    
    // Store the asset report in the database
    const storeResult = await client.query(
      `INSERT INTO asset_reports 
       (contract_id, user_id, asset_report_id, asset_report_token, days_requested, status, metadata, created_at)
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