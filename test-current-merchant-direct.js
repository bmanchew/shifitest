/**
 * Test script for directly testing the /api/current-merchant endpoint
 * This bypasses any browser dependencies and tests the raw API
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Configuration
const API_BASE_URL = 'http://localhost:5000';
const COOKIES_FILE = './merchant-cookies.txt';

// Store for cookies
let cookies = [];

/**
 * Load cookies from file if available
 */
function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookieContent = fs.readFileSync(COOKIES_FILE, 'utf8');
      cookies = cookieContent.split('\n').filter(Boolean);
      console.log(`Loaded ${cookies.length} cookies`);
    }
  } catch (error) {
    console.error('Error loading cookies:', error.message);
  }
}

/**
 * Save cookies to file
 */
function saveCookies(cookieArray) {
  try {
    fs.writeFileSync(COOKIES_FILE, cookieArray.join('\n'), 'utf8');
    console.log('Cookies saved successfully');
  } catch (error) {
    console.error('Error saving cookies:', error.message);
  }
}

/**
 * Login as a merchant
 */
async function loginAsMerchant() {
  console.log('Logging in as merchant...');
  
  try {
    // Get CSRF token first
    const csrfResponse = await axios.get(`${API_BASE_URL}/api/csrf-token`);
    const csrfToken = csrfResponse.data.csrfToken;
    
    // Save cookies from the CSRF request
    const csrfCookies = csrfResponse.headers['set-cookie'];
    if (csrfCookies) {
      cookies = csrfCookies;
    }
    
    console.log(`Got CSRF token: ${csrfToken}`);
    
    // Login request
    const loginResponse = await axios.post(
      `${API_BASE_URL}/api/auth/login`,
      {
        email: 'test-merchant@example.com',
        password: 'Password123!',
        userType: 'merchant'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': cookies.join('; ')
        }
      }
    );
    
    console.log('Login response status:', loginResponse.status);
    
    // Save cookies from login response
    const authCookies = loginResponse.headers['set-cookie'];
    if (authCookies) {
      cookies = authCookies;
      saveCookies(cookies);
    }
    
    return true;
  } catch (error) {
    console.error('Login failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

/**
 * Make a direct HTTP request to the /api/current-merchant endpoint
 */
async function testDirectCurrentMerchantEndpoint() {
  console.log('\n=== DIRECT TEST: /api/current-merchant endpoint ===');
  
  try {
    console.log(`Using cookies: ${cookies.join('; ')}`);
    
    const response = await axios.get(`${API_BASE_URL}/api/current-merchant`, {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', JSON.stringify(response.headers, null, 2));
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.success) {
      console.log('Test result: SUCCESS');
      return true;
    } else {
      console.log('Test result: FAILED - Expected success: true');
      return false;
    }
  } catch (error) {
    console.error('Test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Response data:', error.response.data);
    }
    console.log('Test result: FAILED');
    return false;
  }
}

/**
 * Test if the /api/contracts endpoint works with a merchantId parameter
 */
async function testContractsEndpoint() {
  console.log('\n=== TEST: /api/contracts with merchantId endpoint ===');
  
  try {
    // First get the merchant ID from the current-merchant endpoint
    const merchantResponse = await axios.get(`${API_BASE_URL}/api/current-merchant`, {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    
    if (!merchantResponse.data.success || !merchantResponse.data.data) {
      console.error('Could not get merchant data');
      return false;
    }
    
    const merchantId = merchantResponse.data.data.id;
    console.log(`Using merchant ID: ${merchantId}`);
    
    // Now use that merchant ID to get contracts
    const response = await axios.get(`${API_BASE_URL}/api/contracts?merchantId=${merchantId}`, {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    
    console.log('Response status:', response.status);
    console.log(`Found ${response.data.contracts ? response.data.contracts.length : 0} contracts`);
    
    if (response.status === 200 && response.data.success) {
      console.log('Test result: SUCCESS');
      return true;
    } else {
      console.log('Test result: FAILED - Expected success: true');
      return false;
    }
  } catch (error) {
    console.error('Test failed with error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    console.log('Test result: FAILED');
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  loadCookies();
  
  // Login if needed
  if (cookies.length === 0) {
    const loggedIn = await loginAsMerchant();
    if (!loggedIn) {
      console.error('Could not proceed with tests as login failed');
      return;
    }
  }
  
  // Test the current-merchant endpoint
  await testDirectCurrentMerchantEndpoint();
  
  // Test the contracts endpoint
  await testContractsEndpoint();
  
  console.log('\nAll tests completed');
}

// Run the tests
main().catch(error => {
  console.error('Unhandled error:', error);
});