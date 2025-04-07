/**
 * Schedule Plaid asset report generation for merchants
 * 
 * This script can be run on a schedule to automatically generate
 * asset reports for merchants with completed Plaid integrations.
 * 
 * Usage: npx tsx schedule-asset-reports.ts
 */

import { generateAssetReportsForAllMerchants } from './generate-asset-reports';
import { checkAssetReportStatus } from './check-asset-reports';

// Configuration
const SCHEDULE_INTERVAL_DAYS = 7; // Generate reports weekly

/**
 * Determine if we should generate reports for a merchant
 * based on their last report generation date
 */
async function shouldGenerateForMerchant(merchantId: number): Promise<boolean> {
  // This is a simplified version - in a production system, you would:
  // 1. Check the last time a report was generated for this merchant
  // 2. Only generate a new one if it's been longer than SCHEDULE_INTERVAL_DAYS
  
  // For now, we'll just simulate this decision
  // Replace this with actual database logic in production
  return true;
}

/**
 * Main scheduling function to periodically generate asset reports
 */
async function scheduleAssetReports() {
  try {
    console.log('Starting scheduled asset report generation...');
    console.log(`Scheduled interval: ${SCHEDULE_INTERVAL_DAYS} days`);
    
    // First, check current status
    console.log('\nChecking current asset report status...');
    const reportStatus = await checkAssetReportStatus();
    
    // Generate new reports
    console.log('\nGenerating scheduled asset reports...');
    const result = await generateAssetReportsForAllMerchants();
    
    // Log completion
    console.log('\nScheduled asset report generation completed.');
    console.log(`Generated ${result.success.length} new reports.`);
    console.log(`Failed to generate ${result.failed.length} reports.`);
    
    // Provide next steps info
    console.log('\nNext scheduled generation will be in approximately:');
    console.log(`${SCHEDULE_INTERVAL_DAYS} days`);
    
    return result;
  } catch (error) {
    console.error('Error in scheduled asset report generation:', error);
    throw error;
  }
}

// Run the scheduler if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scheduleAssetReports()
    .then(() => {
      console.log('Scheduled task completed successfully.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Scheduled task failed:', error);
      process.exit(1);
    });
}

export { scheduleAssetReports };