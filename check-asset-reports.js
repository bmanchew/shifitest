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
    console.log('Checking status of recent asset reports...');
    
    // Get all pending asset reports from the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1); 
    
    const pendingReports = await storage.getAssetReportsByStatus('pending', oneDayAgo);
    
    console.log(`Found ${pendingReports.length} pending asset reports from the last 24 hours.`);
    
    if (pendingReports.length === 0) {
      console.log('No pending reports to check.');
      return;
    }
    
    // Keep track of results
    const results = {
      ready: [],
      pending: [],
      failed: []
    };
    
    // Check each report
    for (const report of pendingReports) {
      try {
        console.log(`Checking asset report with ID: ${report.assetReportId}`);
        
        // Get the report from Plaid
        const reportStatus = await plaidService.getAssetReportStatus(report.assetReportToken);
        
        if (reportStatus.status === 'READY') {
          console.log(`Asset report ${report.assetReportId} is ready!`);
          
          // Update the status in our database
          await storage.updateAssetReportStatus(report.id, 'ready');
          
          results.ready.push({
            id: report.id,
            assetReportId: report.assetReportId
          });
        } else if (reportStatus.status === 'FAILED' || reportStatus.status === 'ERROR') {
          console.log(`Asset report ${report.assetReportId} failed: ${reportStatus.error || 'Unknown error'}`);
          
          // Update the status in our database
          await storage.updateAssetReportStatus(report.id, 'failed', reportStatus.error);
          
          results.failed.push({
            id: report.id,
            assetReportId: report.assetReportId,
            error: reportStatus.error
          });
        } else {
          console.log(`Asset report ${report.assetReportId} is still pending.`);
          results.pending.push({
            id: report.id,
            assetReportId: report.assetReportId
          });
        }
        
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error checking asset report ${report.assetReportId}:`, error.message);
        results.failed.push({
          id: report.id,
          assetReportId: report.assetReportId,
          error: error.message
        });
      }
    }
    
    // Print summary
    console.log('\n--- ASSET REPORT STATUS SUMMARY ---');
    console.log(`Total reports checked: ${pendingReports.length}`);
    console.log(`Ready reports: ${results.ready.length}`);
    console.log(`Still pending: ${results.pending.length}`);
    console.log(`Failed reports: ${results.failed.length}`);
    
    if (results.ready.length > 0) {
      console.log('\nReady asset reports:');
      results.ready.forEach(item => {
        console.log(`  - ID: ${item.id}, Asset Report ID: ${item.assetReportId}`);
      });
    }
    
    if (results.failed.length > 0) {
      console.log('\nFailed asset reports:');
      results.failed.forEach(item => {
        console.log(`  - ID: ${item.id}, Asset Report ID: ${item.assetReportId}, Error: ${item.error}`);
      });
    }
    
    return results;
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
      console.log('Asset report status check completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { checkAssetReportStatus };