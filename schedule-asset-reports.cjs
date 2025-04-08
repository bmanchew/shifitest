#!/usr/bin/env node
/**
 * This script is designed to be run as a scheduled job (e.g., via cron)
 * It generates asset reports for all "completed" merchants and logs the results
 * It's intended to be paired with a cron job like:
 * 0 0 * * * /usr/bin/node /path/to/schedule-asset-reports.cjs >> /path/to/asset-reports.log 2>&1
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('./server/db.cjs');
const { plaid } = require('./server/services/plaid');

// Configure log output
const LOG_DIR = path.join(__dirname, 'asset_reports');
const LOG_FILE = path.join(LOG_DIR, `asset-reports-${new Date().toISOString().split('T')[0]}.log`);

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Create a custom logger to both console and file
const logger = {
  log: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  },
  error: (message, error) => {
    const timestamp = new Date().toISOString();
    const errorMessage = error ? `${message}: ${error.message || error}` : message;
    const logMessage = `[${timestamp}] ERROR: ${errorMessage}`;
    console.error(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
    if (error && error.stack) {
      fs.appendFileSync(LOG_FILE, `[${timestamp}] STACK: ${error.stack}\n`);
    }
  },
  warn: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARN: ${message}`;
    console.warn(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  }
};

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
    logger.error('Error fetching completed Plaid merchants', error);
    throw error;
  }
}

// Function to check if a merchant already has a recent asset report
async function hasRecentAssetReport(merchantId, daysThreshold = 7) {
  try {
    const result = await db.query(
      `SELECT * FROM asset_reports 
       WHERE merchant_id = $1 
       AND created_at > NOW() - INTERVAL '${daysThreshold} days'
       ORDER BY created_at DESC
       LIMIT 1`,
      [merchantId]
    );
    
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Error checking recent asset reports for Merchant #${merchantId}`, error);
    return false;
  }
}

// Function to generate an asset report for a merchant
async function generateAssetReport(merchant) {
  if (!merchant.accessToken) {
    logger.warn(`Merchant #${merchant.merchantId} (${merchant.merchantName || 'Unknown'}) has completed status but no access token. Skipping.`);
    return null;
  }
  
  // Check if merchant already has a recent report
  const hasRecent = await hasRecentAssetReport(merchant.merchantId);
  if (hasRecent) {
    logger.log(`Merchant #${merchant.merchantId} (${merchant.merchantName || 'Unknown'}) already has a recent asset report. Skipping.`);
    return { skipped: true };
  }

  try {
    logger.log(`Generating asset report for Merchant #${merchant.merchantId} (${merchant.merchantName || 'Unknown'})...`);
    
    // Create the asset report with default days (30)
    const days = 30;
    const assetReport = await plaid.createAssetReport(merchant.accessToken, days);
    
    // Log success and return the asset report
    logger.log(`Successfully created asset report for Merchant #${merchant.merchantId} (${merchant.merchantName || 'Unknown'})`);
    logger.log(`Asset Report Token: ${assetReport.assetReportToken}`);
    
    // Store the asset report in the database
    await storeAssetReport(merchant.merchantId, assetReport.assetReportToken, assetReport.assetReportId);
    
    return assetReport;
  } catch (error) {
    logger.error(`Error generating asset report for Merchant #${merchant.merchantId} (${merchant.merchantName || 'Unknown'})`, error);
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
    
    logger.log(`Stored asset report in the database for Merchant #${merchantId}`);
  } catch (error) {
    logger.error(`Error storing asset report for Merchant #${merchantId}`, error);
    throw error;
  }
}

// Main function to run the script
async function main() {
  try {
    logger.log('==================================================');
    logger.log('Starting scheduled Plaid asset report generation...');
    logger.log('==================================================');
    
    // Get all completed Plaid merchants
    const merchants = await getCompletedPlaidMerchants();
    logger.log(`Found ${merchants.length} merchants with completed Plaid onboarding status.`);
    
    // If no merchants, exit
    if (merchants.length === 0) {
      logger.log('No merchants to process. Exiting.');
      return;
    }
    
    // Generate reports for each merchant
    const results = {
      total: merchants.length,
      success: 0,
      failed: 0,
      skipped: 0,
      details: []
    };
    
    for (const merchant of merchants) {
      const result = await generateAssetReport(merchant);
      
      const resultDetail = {
        merchantId: merchant.merchantId,
        merchantName: merchant.merchantName || 'Unknown',
        status: result ? (result.skipped ? 'skipped' : 'success') : 'failed',
        timestamp: new Date().toISOString()
      };
      
      if (result && !result.skipped) {
        resultDetail.assetReportId = result.assetReportId;
        resultDetail.assetReportToken = result.assetReportToken;
        results.success++;
      } else if (result && result.skipped) {
        results.skipped++;
      } else {
        results.failed++;
      }
      
      results.details.push(resultDetail);
    }
    
    // Output summary
    logger.log('\n===== Asset Report Generation Summary =====');
    logger.log(`Total merchants processed: ${results.total}`);
    logger.log(`Successfully generated reports: ${results.success}`);
    logger.log(`Failed to generate reports: ${results.failed}`);
    logger.log(`Skipped (recent report exists): ${results.skipped}`);
    
    // List successful and failed merchants
    if (results.success > 0) {
      logger.log('\nSuccessful Asset Reports:');
      results.details.filter(r => r.status === 'success').forEach(r => {
        logger.log(`- Merchant #${r.merchantId} (${r.merchantName}): Report ID ${r.assetReportId}`);
      });
    }
    
    if (results.failed > 0) {
      logger.log('\nFailed Asset Reports:');
      results.details.filter(r => r.status === 'failed').forEach(r => {
        logger.log(`- Merchant #${r.merchantId} (${r.merchantName})`);
      });
    }
    
    if (results.skipped > 0) {
      logger.log('\nSkipped Asset Reports (recent report exists):');
      results.details.filter(r => r.status === 'skipped').forEach(r => {
        logger.log(`- Merchant #${r.merchantId} (${r.merchantName})`);
      });
    }
    
    logger.log('\n==================================================');
    logger.log('Asset report generation completed successfully.');
    logger.log('==================================================');
    
  } catch (error) {
    logger.error('Error in main process', error);
  } finally {
    // Close database connection
    await db.end();
    logger.log('Database connection closed. Script complete.');
  }
}

// Run the script
main();