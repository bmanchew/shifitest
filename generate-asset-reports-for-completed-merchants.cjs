/**
 * This script generates Plaid asset reports for all merchants with completed onboarding status
 * It uses the Plaid API to create asset reports for merchants that have a valid accessToken
 */

require('dotenv').config();
const { createClient } = require('./server/db.cjs');
const { plaid } = require('./server/services/plaid');

// Connect to database
const db = createClient();

// Function to get all merchants with completed Plaid onboarding
async function getCompletedPlaidMerchants() {
  try {
    const result = await db.query(
      `SELECT 
        pm.id, 
        pm.merchant_id as "merchantId", 
        m.name as "merchantName",
        pm.client_id as "clientId", 
        pm.access_token as "accessToken", 
        pm.onboarding_status as "onboardingStatus", 
        pm.created_at as "createdAt", 
        pm.updated_at as "updatedAt"
      FROM plaid_merchants pm
      LEFT JOIN merchants m ON pm.merchant_id = m.id
      WHERE pm.onboarding_status = 'completed'
      ORDER BY pm.updated_at DESC`
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching completed Plaid merchants:', error);
    throw error;
  }
}

// Function to generate an asset report for a merchant
async function generateAssetReport(merchant) {
  if (!merchant.accessToken) {
    console.warn(`Merchant #${merchant.merchantId} (${merchant.merchantName || 'Unknown'}) has completed status but no access token. Skipping.`);
    return null;
  }

  try {
    console.log(`Generating asset report for Merchant #${merchant.merchantId} (${merchant.merchantName || 'Unknown'})...`);
    
    // Create the asset report with default days (30)
    const days = 30;
    const assetReport = await plaid.createAssetReport(merchant.accessToken, days);
    
    // Log success and return the asset report
    console.log(`Successfully created asset report for Merchant #${merchant.merchantId} (${merchant.merchantName || 'Unknown'})`);
    console.log(`Asset Report Token: ${assetReport.assetReportToken}`);
    
    // Store the asset report in the database
    await storeAssetReport(merchant.merchantId, assetReport.assetReportToken, assetReport.assetReportId);
    
    return assetReport;
  } catch (error) {
    console.error(`Error generating asset report for Merchant #${merchant.merchantId} (${merchant.merchantName || 'Unknown'}):`, error);
    return null;
  }
}

// Function to store the asset report in the database
async function storeAssetReport(merchantId, assetReportToken, assetReportId) {
  try {
    await db.query(
      `INSERT INTO asset_reports (
        merchant_id, 
        asset_report_token, 
        asset_report_id, 
        status, 
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [merchantId, assetReportToken, assetReportId, 'pending']
    );
    
    console.log(`Stored asset report in the database for Merchant #${merchantId}`);
  } catch (error) {
    console.error(`Error storing asset report for Merchant #${merchantId}:`, error);
    throw error;
  }
}

// Main function to run the script
async function main() {
  try {
    console.log('Starting Plaid asset report generation for completed merchants...');
    
    // Get all completed Plaid merchants
    const merchants = await getCompletedPlaidMerchants();
    console.log(`Found ${merchants.length} merchants with completed Plaid onboarding status.`);
    
    // If no merchants, exit
    if (merchants.length === 0) {
      console.log('No merchants to process. Exiting.');
      process.exit(0);
    }
    
    // Generate reports for each merchant
    const results = [];
    for (const merchant of merchants) {
      const result = await generateAssetReport(merchant);
      results.push({
        merchantId: merchant.merchantId,
        merchantName: merchant.merchantName,
        success: !!result,
        assetReportId: result ? result.assetReportId : null,
        assetReportToken: result ? result.assetReportToken : null
      });
    }
    
    // Output summary
    console.log('\n--- Asset Report Generation Summary ---');
    console.log(`Total merchants processed: ${results.length}`);
    console.log(`Successfully generated reports: ${results.filter(r => r.success).length}`);
    console.log(`Failed to generate reports: ${results.filter(r => !r.success).length}`);
    
    // List successful and failed merchants
    console.log('\nSuccessful Asset Reports:');
    results.filter(r => r.success).forEach(r => {
      console.log(`- Merchant #${r.merchantId} (${r.merchantName || 'Unknown'}): Report ID ${r.assetReportId}`);
    });
    
    console.log('\nFailed Asset Reports:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`- Merchant #${r.merchantId} (${r.merchantName || 'Unknown'})`);
    });
    
  } catch (error) {
    console.error('Error in main process:', error);
  } finally {
    // Close database connection
    await db.end();
    console.log('Database connection closed. Script complete.');
  }
}

// Run the script
main();