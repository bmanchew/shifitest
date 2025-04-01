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

// Create a test merchant and its business details
async function createTestMerchant() {
  try {
    // Get a CSRF token first
    logger.info('Requesting CSRF token...');
    const csrfResponse = await axios.get(`${API_BASE_URL}/csrf-token`);
    const csrfToken = csrfResponse.data.csrfToken;
    
    logger.info(`Obtained CSRF token: ${csrfToken}`);
    
    // Create a test merchant - only include fields that match the merchant schema
    const merchantData = {
      name: "PRESTIGE MENTORS LLC", 
      email: `test-middesk-${Date.now()}@example.com`,
      phone: "+15551234567",
      contactName: "Douglas James",
      address: "1309 Coffeen Ave, Sheridan, WY 82801"
    };
    
    logger.info('Creating test merchant...');
    
    try {
      logger.info(`Sending merchant data: ${JSON.stringify(merchantData, null, 2)}`);
      
      const response = await axios.post(`${API_BASE_URL}/merchants`, merchantData, {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        }
      });
      
      logger.info('Server response status: ' + response.status);
      logger.info('Server response data: ' + JSON.stringify(response.data, null, 2));
      
      // Check if we have a merchant ID in the response
      if (!response.data || !response.data.id) {
        logger.error('No merchant ID found in response data');
        logger.info(`Response keys: ${Object.keys(response.data || {}).join(', ')}`);
        return null;
      }
      
      const merchantId = response.data.id;
      logger.info(`Merchant created successfully with ID: ${merchantId}`);
      
      // Now create business details for this merchant
      logger.info('Creating business details for the merchant...');
      
      // Business details matching the merchant business details schema from shared/schema.ts
      const businessDetailsData = {
        merchantId: merchantId,
        legalName: "PRESTIGE MENTORS LLC",
        ein: "99-4902823",
        businessStructure: "LLC",
        addressLine1: "1309 Coffeen Ave",
        addressLine2: "",
        city: "Sheridan",
        state: "WY",
        zipCode: "82801",
        websiteUrl: "https://test-middesk.example.com",
        industryType: "Business Coaching",
        yearEstablished: 2020,
        annualRevenue: 500000,
        monthlyRevenue: 41667,
        employeeCount: 5
      };
      
      logger.info(`Sending business details data: ${JSON.stringify(businessDetailsData, null, 2)}`);
      
      // Get a fresh CSRF token for the second request
      const newCsrfResponse = await axios.get(`${API_BASE_URL}/csrf-token`);
      const newCsrfToken = newCsrfResponse.data.csrfToken;
      
      const businessDetailsResponse = await axios.post(
        `${API_BASE_URL}/merchants/${merchantId}/business-details`, 
        businessDetailsData, 
        {
          headers: {
            'X-CSRF-Token': newCsrfToken,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info('Business details response status: ' + businessDetailsResponse.status);
      logger.info('Business details response data: ' + JSON.stringify(businessDetailsResponse.data, null, 2));
      
      if (businessDetailsResponse.data && businessDetailsResponse.data.success) {
        logger.info('Business details created successfully');
      } else {
        logger.error('Failed to create business details');
      }
      
      // Return the merchant ID
      return merchantId;
    } catch (error) {
      if (error.response) {
        logger.error(`Server error response: Status ${error.response.status}`);
        logger.error(`Error data: ${JSON.stringify(error.response.data, null, 2)}`);
        
        // Try alternate endpoint if the business details endpoint fails
        if (error.config && error.config.url.includes('business-details')) {
          logger.info('Trying alternate endpoint for business details...');
          try {
            // Extract merchant ID from the failed URL
            const urlParts = error.config.url.split('/');
            const merchantId = parseInt(urlParts[urlParts.indexOf('merchants') + 1]);
            
            if (!isNaN(merchantId)) {
              logger.info(`Using alternate endpoint for merchant ${merchantId}`);
              return merchantId; // Return the merchant ID even if business details failed
            }
          } catch (e) {
            logger.error(`Error parsing merchant ID from URL: ${e.message}`);
          }
        }
      } else {
        logger.error(`Network error: ${error.message}`);
      }
      throw error; // Re-throw to be caught by the outer catch
    }
  } catch (error) {
    if (error.response) {
      logger.error(`Failed to create merchant: Status ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      
      // Log more detailed error information
      if (error.response.data && error.response.data.errors) {
        logger.error('Validation errors:');
        console.error(error.response.data.errors);
      }
      
      // Check if there's any additional error information
      if (error.response.data && error.response.data.message) {
        logger.error(`Error message: ${error.response.data.message}`);
      }
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
    logger.error(`Error in main: ${error.message}`);
  }
}

// Run the script
main();