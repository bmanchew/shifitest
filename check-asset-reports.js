/**
 * This script checks the status of all recently generated asset reports
 * for merchants with Plaid integrations.
 * 
 * Usage: node check-asset-reports.js
 */

const { db } = require('./server/db');
const { plaidService } = require('./server/services/plaid');
const { storage } = require('./server/storage');

/**
 * Checks status of recently generated asset reports
 */
async function checkAssetReportStatus() {
  try {
    console.log('Checking status of merchant asset reports...');
    
    // Get list of merchants with completed Plaid integrations
    const completedMerchants = await storage.getPlaidMerchantsByStatus('completed');
    console.log(`Found ${completedMerchants.length} merchants with completed Plaid integration.`);
    
    // Collect all asset reports for these merchants
    const assetReports = [];
    
    for (const merchant of completedMerchants) {
      // Get asset reports for this merchant's user ID (matching the merchant ID)
      const merchantReports = await storage.getAssetReportsByUserId(merchant.merchantId);
      if (merchantReports && merchantReports.length > 0) {
        assetReports.push(...merchantReports);
      }
    }
    
    console.log(`Found ${assetReports.length} total asset reports for merchants.`);
    
    // Group reports by status
    const reportsByStatus = {
      pending: [],
      ready: [],
      error: []
    };
    
    // Process each report
    assetReports.forEach(report => {
      if (report.status === 'ready') {
        reportsByStatus.ready.push(report);
      } else if (report.status === 'error') {
        reportsByStatus.error.push(report);
      } else {
        reportsByStatus.pending.push(report);
      }
    });
    
    // Print summary
    console.log('\n--- ASSET REPORT STATUS SUMMARY ---');
    console.log(`Total reports: ${assetReports.length}`);
    console.log(`Pending reports: ${reportsByStatus.pending.length}`);
    console.log(`Ready reports: ${reportsByStatus.ready.length}`);
    console.log(`Error reports: ${reportsByStatus.error.length}`);
    
    if (reportsByStatus.pending.length > 0) {
      console.log('\nPending reports:');
      reportsByStatus.pending.forEach(report => {
        console.log(`  - Report ID: ${report.assetReportId}, Created: ${report.createdAt}`);
      });
    }
    
    if (reportsByStatus.ready.length > 0) {
      console.log('\nReady reports:');
      reportsByStatus.ready.forEach(report => {
        console.log(`  - Report ID: ${report.assetReportId}, Created: ${report.createdAt}`);
      });
    }
    
    if (reportsByStatus.error.length > 0) {
      console.log('\nError reports:');
      reportsByStatus.error.forEach(report => {
        console.log(`  - Report ID: ${report.assetReportId}, Error: ${report.error || 'Unknown error'}`);
      });
    }
    
    console.log('\nReport status check complete.');
    return reportsByStatus;
  } catch (error) {
    console.error('Error checking asset report status:', error);
    throw error;
  } finally {
    // Close the database connection
    console.log('Closing database connection...');
    await db.end();
  }
}

// Run the script if executed directly
if (require.main === module) {
  checkAssetReportStatus()
    .then(() => {
      console.log('Script execution completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { checkAssetReportStatus };