/**
 * Example usage of the asset reports utilities
 * 
 * This script demonstrates how to use the asset report utilities
 * to generate and check asset reports for merchants.
 */

import { generateAssetReportsForAllMerchants } from './generate-asset-reports';
import { checkAssetReportStatus } from './check-asset-reports';

async function runAssetReportProcess() {
  try {
    console.log('=== ASSET REPORT PROCESS START ===');
    
    // Step 1: Check current status
    console.log('\n1. Checking current asset report status...');
    await checkAssetReportStatus();
    
    // Step 2: Generate new reports
    console.log('\n2. Generating new asset reports...');
    await generateAssetReportsForAllMerchants();
    
    // Step 3: Check updated status
    console.log('\n3. Checking updated asset report status...');
    await checkAssetReportStatus();
    
    console.log('\n=== ASSET REPORT PROCESS COMPLETE ===');
    
    console.log('\nNote: Asset reports are generated asynchronously by Plaid.');
    console.log('You can check their status later by running:');
    console.log('npx tsx check-asset-reports.ts');
  } catch (error) {
    console.error('Error running asset report process:', error);
  }
}

// Run the process
runAssetReportProcess()
  .then(() => {
    console.log('Script execution completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });