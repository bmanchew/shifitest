/**
 * Script to create a test merchant in the database for testing
 */
import axios from 'axios';
import fs from 'fs';

// Simple logger
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`)
};

// Configuration
const API_BASE_URL = 'http://localhost:5000';

// Create an axios instance that handles cookies
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Cookie storage for maintaining the session
const cookieJar = {
  cookies: [],
  
  // Save cookies from response
  saveCookies(response) {
    if (response.headers && response.headers['set-cookie']) {
      this.cookies = response.headers['set-cookie'];
      // Save cookies to file for debugging
      fs.writeFileSync('test-merchant-cookies.txt', JSON.stringify(this.cookies, null, 2));
      logger.info(`Saved ${this.cookies.length} cookies`);
    }
  },
  
  // Add cookies to request
  addCookiesToRequest(config) {
    if (this.cookies.length > 0) {
      config.headers = config.headers || {};
      config.headers.Cookie = this.cookies.join('; ');
      logger.info('Added cookies to request');
    }
    return config;
  }
};

// Add interceptors to handle cookies
api.interceptors.response.use(
  (response) => {
    cookieJar.saveCookies(response);
    return response;
  },
  (error) => {
    if (error.response) {
      cookieJar.saveCookies(error.response);
    }
    return Promise.reject(error);
  }
);

api.interceptors.request.use(
  (config) => cookieJar.addCookiesToRequest(config),
  (error) => Promise.reject(error)
);

// First login as an admin to ensure we have permission to create merchants
async function loginAsAdmin() {
  try {
    logger.info('Attempting to login as admin...');
    
    // First get CSRF token for login
    const csrfResponse = await api.get('/api/csrf-token');
    const csrfToken = csrfResponse.data.csrfToken;
    logger.info(`Obtained CSRF token for login: ${csrfToken}`);
    
    // Login with admin credentials
    const loginResponse = await api.post('/api/auth/login', 
      {
        email: 'admin@shifi.com',
        password: 'admin123'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      }
    );
    
    logger.info('Admin login successful');
    return true;
  } catch (error) {
    logger.error('Admin login failed:');
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      logger.error(error.message);
    }
    return false;
  }
}

// Create a test merchant and its business details
async function createTestMerchant() {
  try {
    // Login as admin first to get authentication cookies
    const loggedIn = await loginAsAdmin();
    if (!loggedIn) {
      logger.error('Cannot proceed without admin login');
      return null;
    }
    
    // Get a fresh CSRF token for merchant creation
    logger.info('Requesting CSRF token for merchant creation...');
    const csrfResponse = await api.get('/api/csrf-token');
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
    
    // Create merchant record
    let merchantId = null;
    
    try {
      logger.info(`Sending merchant data: ${JSON.stringify(merchantData, null, 2)}`);
      
      const response = await api.post('/api/merchants', merchantData, {
        headers: {
          'X-CSRF-Token': csrfToken,
          'X-CSRF-Bypass': 'test-merchant-setup'
        }
      });
      
      logger.info('Server response status: ' + response.status);
      
      // For debugging, let's save the first 500 characters of the response if it's a string
      if (typeof response.data === 'string') {
        const preview = response.data.substring(0, 500);
        logger.info(`Response data preview (first 500 chars): ${preview}`);
      } else {
        logger.info('Full response data: ' + JSON.stringify(response.data, null, 2));
      }
      
      logger.info('Response headers: ' + JSON.stringify(response.headers));
      
      // Check if we have a merchant ID in the response
      if (!response.data) {
        logger.error('No response data received');
        return null;
      }
      
      // Check the response structure
      if (typeof response.data === 'string') {
        // If the response looks like HTML, there might be a server error or redirect
        if (response.data.includes('<!DOCTYPE html>') || response.data.includes('<html>')) {
          logger.error('Server returned HTML instead of JSON. This likely indicates an error or redirect.');
          
          // Check if there's an error message in the HTML
          const errorMatch = response.data.match(/<div class="error-message">(.*?)<\/div>/);
          if (errorMatch && errorMatch[1]) {
            logger.error(`Error message found in HTML: ${errorMatch[1]}`);
          }
          
          return null;
        }
        
        logger.info('Response is a string, attempting to parse as JSON');
        try {
          const parsedData = JSON.parse(response.data);
          logger.info('Parsed response data: ' + JSON.stringify(parsedData, null, 2));
          
          if (parsedData && parsedData.id) {
            logger.info(`Merchant ID found in parsed data: ${parsedData.id}`);
            merchantId = parsedData.id;
          }
        } catch (e) {
          logger.error(`Failed to parse response as JSON: ${e.message}`);
        }
      } else if (typeof response.data === 'object') {
        logger.info(`Response keys: ${Object.keys(response.data || {}).join(', ')}`);
        
        if (response.data.id) {
          logger.info(`Merchant ID found in response: ${response.data.id}`);
          merchantId = response.data.id;
        } else if (response.data.merchantId) {
          logger.info(`Merchant ID found as merchantId: ${response.data.merchantId}`);
          merchantId = response.data.merchantId;
        } else if (response.data.data && response.data.data.id) {
          logger.info(`Merchant ID found in nested data: ${response.data.data.id}`);
          merchantId = response.data.data.id;
        }
      }
      
      if (!merchantId) {
        logger.error('No merchant ID found in any format in the response data');
        return null;
      }
      
      // Continue with business details creation
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
      
      // Get a fresh CSRF token for the business details request
      const newCsrfResponse = await api.get('/api/csrf-token');
      const newCsrfToken = newCsrfResponse.data.csrfToken;
      
      // Try to use the merchant business details endpoint
      try {
        const businessDetailsResponse = await api.post(
          `/api/merchants/${merchantId}/business-details`, 
          businessDetailsData, 
          {
            headers: {
              'X-CSRF-Token': newCsrfToken,
              'X-CSRF-Bypass': 'test-merchant-setup'
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
      } catch (detailsError) {
        // If the first attempt fails, try the alternate endpoint
        logger.error('Failed to create business details using primary endpoint:');
        if (detailsError.response) {
          logger.error(`Status: ${detailsError.response.status}`);
          logger.error(`Response: ${JSON.stringify(detailsError.response.data, null, 2)}`);
        } else {
          logger.error(detailsError.message);
        }
        
        // Try alternate endpoint
        logger.info('Trying alternate endpoint for business details...');
        try {
          const altResponse = await api.post(
            `/api/merchant-business-details`, 
            businessDetailsData, 
            {
              headers: {
                'X-CSRF-Token': newCsrfToken,
                'X-CSRF-Bypass': 'test-merchant-setup'
              }
            }
          );
          
          logger.info('Alternate endpoint response: ' + JSON.stringify(altResponse.data, null, 2));
        } catch (altError) {
          logger.error('Alternative endpoint also failed');
          if (altError.response) {
            logger.error(`Status: ${altError.response.status}`);
            logger.error(`Response: ${JSON.stringify(altError.response.data, null, 2)}`);
          } else {
            logger.error(altError.message);
          }
        }
      }
      
      // Return the merchant ID
      return merchantId;
      
    } catch (error) {
      if (error.response) {
        logger.error(`Server error response: Status ${error.response.status}`);
        logger.error(`Error data: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        logger.error(`Network error: ${error.message}`);
      }
      return null;
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