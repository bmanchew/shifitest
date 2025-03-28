/**
 * Script to create a test merchant in the database for testing
 */
import axios from 'axios';

// Simple logger
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`)
};

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Create a test merchant
async function createTestMerchant() {
  try {
    // Get a CSRF token first
    logger.info('Requesting CSRF token...');
    const csrfResponse = await axios.get(`${API_BASE_URL}/csrf-token`);
    const csrfToken = csrfResponse.data.csrfToken;
    
    logger.info(`Obtained CSRF token: ${csrfToken}`);
    
    // Create a test merchant
    const merchantData = {
      name: "PRESTIGE MENTORS LLC",
      email: `test-middesk-${Date.now()}@example.com`,
      phone: "+15551234567",
      address: "1309 Coffeen Ave",
      city: "Sheridan",
      state: "WY",
      zipCode: "82801",
      website: "https://test-middesk.example.com",
      description: "Test merchant for MidDesk integration testing",
      contactName: "Douglas James",
      taxId: "99-4902823"
    };
    
    logger.info('Creating test merchant...');
    const response = await axios.post(`${API_BASE_URL}/merchants`, merchantData, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'X-CSRF-Bypass': 'test-merchant-setup'
      }
    });
    
    logger.info(`Merchant created successfully: ${JSON.stringify(response.data, null, 2)}`);
    // The API directly returns the merchant object, not nested under 'merchant'
    return response.data.id;
  } catch (error) {
    if (error.response) {
      logger.error(`Failed to create merchant: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      logger.error(`Error: ${error.message}`);
    }
    return null;
  }
}

// Main function
async function main() {
  try {
    const merchantId = await createTestMerchant();
    if (merchantId) {
      logger.info(`Successfully created test merchant with ID: ${merchantId}`);
      logger.info('You can use this merchant ID for your MidDesk integration tests');
    } else {
      logger.error('Failed to create test merchant');
    }
  } catch (error) {
    logger.error(`Error: ${error.message}`);
  }
}

// Run the script
main();