/**
 * Test script for the merchant business details endpoints
 * This script creates a new merchant business details record and then retrieves it
 */
import axios from 'axios';

// Simple logger
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`)
};

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
const MERCHANT_ID = 1; // Use a known merchant ID for testing

// Test creating merchant business details
async function testCreateMerchantBusinessDetails() {
  try {
    const mockData = {
      merchantId: MERCHANT_ID,
      legalName: "PRESTIGE MENTORS LLC",
      ein: "99-4902823",
      businessStructure: "LLC",
      streetAddress: "1309 Coffeen Ave",
      streetAddress2: "Suite 1200",
      city: "Sheridan",
      state: "WY",
      zipCode: "82801",
      verificationStatus: "not_started"
    };

    logger.info(`Creating business details for merchant ${MERCHANT_ID}...`);
    const response = await axios.post(`${API_BASE_URL}/merchant-business-details`, mockData, {
      headers: {
        'X-CSRF-Bypass': 'test-middesk-integration'
      }
    });
    
    logger.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
    logger.info('Business details created successfully!');
    
    return response.data.businessDetails.id;
  } catch (error) {
    if (error.response) {
      logger.error(`Failed to create business details: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      logger.error(`Error: ${error.message}`);
    }
    return null;
  }
}

// Test retrieving merchant business details by merchant ID
async function testGetMerchantBusinessDetails(merchantId) {
  try {
    logger.info(`Retrieving business details for merchant ${merchantId}...`);
    const response = await axios.get(`${API_BASE_URL}/merchant-business-details?merchantId=${merchantId}`, {
      headers: {
        'X-CSRF-Bypass': 'test-middesk-integration'
      }
    });
    
    logger.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
    logger.info(`Found ${response.data.length} business details record(s)`);
    
    return response.data;
  } catch (error) {
    if (error.response) {
      logger.error(`Failed to retrieve business details: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      logger.error(`Error: ${error.message}`);
    }
    return null;
  }
}

// Main function to run all tests
async function main() {
  try {
    // First, let's try to get existing records
    await testGetMerchantBusinessDetails(MERCHANT_ID);
    
    // Then, create a new record
    const newBusinessDetailsId = await testCreateMerchantBusinessDetails();
    
    if (newBusinessDetailsId) {
      // Finally, verify we can retrieve the newly created record
      await testGetMerchantBusinessDetails(MERCHANT_ID);
    }
    
    logger.info('All tests completed!');
  } catch (error) {
    logger.error(`Error running tests: ${error.message}`);
  }
}

// Run the tests
main();