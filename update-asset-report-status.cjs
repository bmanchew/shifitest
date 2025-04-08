/**
 * This script checks the status of pending asset reports and updates them in the database
 * It retrieves the asset report from Plaid if it's available and marks it as completed
 */

require('dotenv').config();
const { createClient } = require('./server/db.cjs');
const { plaid } = require('./server/services/plaid');

// Connect to database
const db = createClient();

// Function to get all pending asset reports
async function getPendingAssetReports() {
  try {
    const result = await db.query(
      `SELECT 
        ar.id, 
        ar.merchant_id as "merchantId", 
        m.name as "merchantName",
        ar.asset_report_token as "assetReportToken", 
        ar.asset_report_id as "assetReportId", 
        ar.status, 
        ar.created_at as "createdAt", 
        ar.updated_at as "updatedAt"
      FROM asset_reports ar
      LEFT JOIN merchants m ON ar.merchant_id = m.id
      WHERE ar.status = 'pending'
      ORDER BY ar.created_at ASC`
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching pending asset reports:', error);
    throw error;
  }
}

// Function to get an asset report from Plaid
async function getAssetReport(assetReportToken) {
  try {
    const response = await plaid.getAssetReport(assetReportToken);
    return response;
  } catch (error) {
    // If the report is not ready yet, it will throw a PRODUCT_NOT_READY error
    if (error.error_code === 'PRODUCT_NOT_READY') {
      return { status: 'pending' };
    }
    throw error;
  }
}

// Function to update an asset report status in the database
async function updateAssetReportStatus(id, status, reportData = null) {
  try {
    // If report data is available, store it as JSON
    if (reportData) {
      await db.query(
        `UPDATE asset_reports 
        SET status = $1, 
            report_data = $2, 
            updated_at = NOW() 
        WHERE id = $3`,
        [status, JSON.stringify(reportData), id]
      );
    } else {
      await db.query(
        `UPDATE asset_reports 
        SET status = $1, 
            updated_at = NOW() 
        WHERE id = $2`,
        [status, id]
      );
    }
    
    console.log(`Updated asset report #${id} status to ${status}`);
  } catch (error) {
    console.error(`Error updating asset report #${id}:`, error);
    throw error;
  }
}

// Main function to run the script
async function main() {
  try {
    console.log('Starting asset report status update check...');
    
    // Get all pending asset reports
    const pendingReports = await getPendingAssetReports();
    console.log(`Found ${pendingReports.length} pending asset reports to check.`);
    
    // If no pending reports, exit
    if (pendingReports.length === 0) {
      console.log('No pending reports to check. Exiting.');
      process.exit(0);
    }
    
    // Check each pending report
    const results = {
      total: pendingReports.length,
      completed: 0,
      stillPending: 0,
      failed: 0
    };
    
    for (const report of pendingReports) {
      console.log(`Checking asset report #${report.id} for Merchant #${report.merchantId} (${report.merchantName || 'Unknown'})...`);
      
      try {
        const assetReport = await getAssetReport(report.assetReportToken);
        
        if (assetReport.status === 'pending') {
          console.log(`Asset report #${report.id} is still being processed by Plaid.`);
          results.stillPending++;
        } else {
          // Report is ready, update status to completed
          console.log(`Asset report #${report.id} is now available.`);
          await updateAssetReportStatus(report.id, 'completed', assetReport);
          results.completed++;
        }
      } catch (error) {
        console.error(`Error checking asset report #${report.id}:`, error);
        // If there was an error (other than PRODUCT_NOT_READY), mark as failed
        await updateAssetReportStatus(report.id, 'failed');
        results.failed++;
      }
    }
    
    // Output summary
    console.log('\n--- Asset Report Status Update Summary ---');
    console.log(`Total reports checked: ${results.total}`);
    console.log(`Completed reports: ${results.completed}`);
    console.log(`Still pending: ${results.stillPending}`);
    console.log(`Failed reports: ${results.failed}`);
    
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