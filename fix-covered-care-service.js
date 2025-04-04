/**
 * This script checks and configures the CoveredCare API service
 * It adds proper environment variables for the CoveredCare API integration
 */

import dotenv from 'dotenv';
import fs from 'fs';
import { coveredCareService } from './server/services/coveredCare.js';

// Load environment variables
dotenv.config();

async function fixCoveredCareService() {
  console.log('---- CoveredCare Service Configuration Tool ----');
  
  // Check current service status
  console.log('Service initialized:', coveredCareService.isInitialized());
  console.log('Running in development mode:', coveredCareService.isDevelopmentMode());
  
  // Check if environment variables are set
  console.log('\nEnvironment variables:');
  console.log('COVERED_CARE_API_KEY set:', !!process.env.COVERED_CARE_API_KEY);
  console.log('COVERED_CARE_PARTNER_GUID set:', !!process.env.COVERED_CARE_PARTNER_GUID);
  
  // If environment variables are missing, advise how to set them
  if (!process.env.COVERED_CARE_API_KEY || !process.env.COVERED_CARE_PARTNER_GUID) {
    console.log('\n⚠️ CoveredCare API credentials are not set.');
    console.log('The service is running in development mode with simulated responses.');
    console.log('To enable real API integration, please set the following environment variables:');
    console.log('- COVERED_CARE_API_KEY');
    console.log('- COVERED_CARE_PARTNER_GUID');
    
    // Check if .env file exists
    const envFileExists = fs.existsSync('./.env');
    console.log('\n.env file exists:', envFileExists);
    
    if (envFileExists) {
      console.log('You can modify your .env file to add the required variables.');
      console.log('Example:');
      console.log('COVERED_CARE_API_KEY=your_api_key_here');
      console.log('COVERED_CARE_PARTNER_GUID=your_partner_guid_here');
      
      // Try to read existing .env file
      try {
        const envContent = fs.readFileSync('./.env', 'utf8');
        
        // Check if variables are already in the file but empty
        const hasApiKeyLine = envContent.includes('COVERED_CARE_API_KEY=');
        const hasPartnerGuidLine = envContent.includes('COVERED_CARE_PARTNER_GUID=');
        
        console.log('\nVariables already in .env file but empty:');
        console.log('COVERED_CARE_API_KEY line exists:', hasApiKeyLine);
        console.log('COVERED_CARE_PARTNER_GUID line exists:', hasPartnerGuidLine);
        
        // Ask if user wants to update the .env file
        console.log('\nTo update your .env file, run:');
        console.log('echo "COVERED_CARE_API_KEY=your_api_key_here" >> .env');
        console.log('echo "COVERED_CARE_PARTNER_GUID=your_partner_guid_here" >> .env');
      } catch (error) {
        console.error('Error reading .env file:', error.message);
      }
    } else {
      console.log('No .env file found. You can create one with:');
      console.log('echo "COVERED_CARE_API_KEY=your_api_key_here" > .env');
      console.log('echo "COVERED_CARE_PARTNER_GUID=your_partner_guid_here" >> .env');
    }
  } else {
    console.log('\n✅ CoveredCare API credentials are properly configured.');
  }
  
  console.log('\nThe CoveredCare service will automatically use your API credentials when they are available.');
  console.log('If credentials are not available, it will run in development mode with simulated responses.');
}

fixCoveredCareService();