/**
 * Test script to check the CoveredCare service configuration
 * This script verifies if the CoveredCare service is properly initialized
 * and whether it's running in development/sandbox mode
 */

import { coveredCareService } from './server/services/coveredCare.js';

async function testCoveredCareService() {
  console.log('---- CoveredCare Service Configuration Test ----');
  
  console.log('Service initialized:', coveredCareService.isInitialized());
  console.log('Running in development mode:', coveredCareService.isDevelopmentMode());

  // Check if environment variables are set
  console.log('\nEnvironment variables:');
  console.log('COVERED_CARE_API_KEY set:', !!process.env.COVERED_CARE_API_KEY);
  console.log('COVERED_CARE_PARTNER_GUID set:', !!process.env.COVERED_CARE_PARTNER_GUID);
  
  if (!process.env.COVERED_CARE_API_KEY || !process.env.COVERED_CARE_PARTNER_GUID) {
    console.log('\n⚠️ Warning: CoveredCare API credentials are not set.');
    console.log('The service will run in development mode with simulated responses.');
    console.log('To enable real API integration, please set the following environment variables:');
    console.log('- COVERED_CARE_API_KEY');
    console.log('- COVERED_CARE_PARTNER_GUID');
  } else {
    console.log('\n✅ CoveredCare API credentials are properly configured.');
  }
}

// Run the test
testCoveredCareService();