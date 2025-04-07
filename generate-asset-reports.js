/**
 * This script generates Plaid asset reports for all merchants 
 * that have completed Plaid integrations.
 * 
 * Usage: node generate-asset-reports.js
 */

const { db } = require('./server/db');
const { plaidService } = require('./server/services/plaid');
const { storage } = require('./server/storage');
const { plaidMerchants } = require('./shared/schema');
const { eq } = require('drizzle-orm');

// Configure Plaid days requested
const DAYS_REQUESTED = 90; // Default: 90 days

/**
 * Main function to generate asset reports for all completed merchants
 */
async function generateAssetReportsForAllMerchants() {
  try {
    console.log('Starting asset report generation for all completed merchants...');
    
    // Get all merchants with 'completed' Plaid onboarding status
    const completedMerchants = await storage.getPlaidMerchantsByStatus('completed');
    
    console.log(`Found ${completedMerchants.length} merchants with completed Plaid integration.`);
    
    // Keep track of success and failures
    const results = {
      success: [],
      failed: []
    };
    
    // Process each merchant
    for (const merchant of completedMerchants) {
      try {
        // Ensure the merchant has an access token
        if (!merchant.accessToken) {
          console.log(`Merchant ID ${merchant.merchantId} has no access token, skipping...`);
          results.failed.push({
            merchantId: merchant.merchantId,
            error: 'No access token available'
          });
          continue;
        }
        
        console.log(`Generating asset report for merchant ID ${merchant.merchantId}...`);
        
        // Create asset report
        const assetReportResult = await plaidService.createAssetReport(
          merchant.accessToken, 
          DAYS_REQUESTED, 
          {
            client_report_id: `merchant-${merchant.merchantId}-${Date.now()}`,
            webhook: process.env.PUBLIC_URL || 'https://shilohfinance.com/api/plaid/webhook',
            user: {
              client_user_id: `merchant-${merchant.merchantId}`,
            }
          }
        );
        
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
              generatedBy: 'bulk-generation-script',
              timestamp: new Date().toISOString()
            })
          }
        );
        
        console.log(`Asset report token stored for merchant ID ${merchant.merchantId}`);
        
        results.success.push({
          merchantId: merchant.merchantId,
          assetReportId: assetReportResult.assetReportId
        });
        
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error generating asset report for merchant ID ${merchant.merchantId}:`, error.message);
        results.failed.push({
          merchantId: merchant.merchantId,
          error: error.message
        });
      }
    }
    
    // Print summary
    console.log('\n--- ASSET REPORT GENERATION SUMMARY ---');
    console.log(`Total merchants processed: ${completedMerchants.length}`);
    console.log(`Successful reports: ${results.success.length}`);
    console.log(`Failed reports: ${results.failed.length}`);
    
    if (results.success.length > 0) {
      console.log('\nSuccessful asset reports:');
      results.success.forEach(item => {
        console.log(`  - Merchant ID: ${item.merchantId}, Asset Report ID: ${item.assetReportId}`);
      });
    }
    
    if (results.failed.length > 0) {
      console.log('\nFailed asset reports:');
      results.failed.forEach(item => {
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
    await db.end();
  }
}

// Run the script if executed directly
if (require.main === module) {
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

module.exports = { generateAssetReportsForAllMerchants };