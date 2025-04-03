/**
 * Test script for the updated auth.ts functionality for merchant fetching
 * This script simulates the frontend auth flow for merchant users
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for the test
const BASE_URL = 'http://localhost:5000';
const COOKIES_FILE = 'test-merchant-auth-cookies.txt';
const TEST_EMAIL = 'brandon@shilohfinance.com';
const TEST_PASSWORD = 'Password123!';

// Helper functions
/**
 * Load cookies from file
 */
function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookies = fs.readFileSync(COOKIES_FILE, 'utf8').trim();
      console.log('Loaded cookies:', cookies);
      return cookies;
    }
  } catch (error) {
    console.error('Error loading cookies:', error.message);
  }
  return '';
}

/**
 * Save cookies to file
 */
function saveCookies(cookieString) {
  try {
    fs.writeFileSync(COOKIES_FILE, cookieString);
    console.log('Saved cookies to file');
  } catch (error) {
    console.error('Error saving cookies:', error.message);
  }
}

/**
 * Get a CSRF token from the server
 */
async function getCsrfToken() {
  try {
    const response = await axios.get(`${BASE_URL}/api/csrf-token`);
    console.log('CSRF Token:', response.data.csrfToken);
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    return null;
  }
}

/**
 * Login as a merchant to simulate frontend auth
 */
async function loginAsMerchant() {
  try {
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }

    const response = await axios.post(
      `${BASE_URL}/api/auth/login`,
      {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      }
    );

    // Save cookies for future requests
    if (response.headers['set-cookie']) {
      const cookieString = response.headers['set-cookie'].join('; ');
      saveCookies(cookieString);
    }

    console.log('Login successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get current user data (simulates getCurrentUser() in auth.ts)
 */
async function getCurrentUser() {
  try {
    const cookies = loadCookies();
    const response = await axios.get(`${BASE_URL}/api/auth/current`, {
      headers: {
        Cookie: cookies
      },
      withCredentials: true
    });

    console.log('Current user data:', response.data);
    return response.data.user;
  } catch (error) {
    console.error('Error getting current user:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test the primary current-merchant endpoint
 */
async function testCurrentMerchantEndpoint() {
  try {
    const cookies = loadCookies();
    const response = await axios.get(`${BASE_URL}/api/current-merchant`, {
      headers: {
        Cookie: cookies,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    console.log('\n===== Current Merchant Endpoint =====');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('\n===== Current Merchant Endpoint Error =====');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test the v1 current-merchant endpoint
 */
async function testV1CurrentMerchantEndpoint() {
  try {
    const cookies = loadCookies();
    const response = await axios.get(`${BASE_URL}/api/v1/current-merchant`, {
      headers: {
        Cookie: cookies,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    console.log('\n===== V1 Current Merchant Endpoint =====');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('\n===== V1 Current Merchant Endpoint Error =====');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test the old merchants/current endpoint for comparison
 */
async function testOldMerchantsCurrentEndpoint() {
  try {
    const cookies = loadCookies();
    const response = await axios.get(`${BASE_URL}/api/merchants/current`, {
      headers: {
        Cookie: cookies,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    console.log('\n===== Old Merchants/Current Endpoint =====');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('\n===== Old Merchants/Current Endpoint Error =====');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    if (error.response?.headers['content-type']?.includes('text/html')) {
      console.error('Received HTML instead of JSON - this confirms the route interception issue');
    }
    return null;
  }
}

/**
 * Test dashboard endpoint, which is used as a fallback in the client code
 */
async function testDashboardEndpoint() {
  try {
    const cookies = loadCookies();
    const response = await axios.get(`${BASE_URL}/api/merchant-dashboard/current`, {
      headers: {
        Cookie: cookies,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    console.log('\n===== Dashboard Endpoint =====');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('\n===== Dashboard Endpoint Error =====');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    if (error.response?.headers['content-type']?.includes('text/html')) {
      console.error('Received HTML instead of JSON - suggests route interception issue');
    }
    return null;
  }
}

/**
 * Simulate the client-side auth.ts getCurrentUser logic
 * This replicates what we just implemented in the client code
 */
async function simulateClientGetCurrentUser() {
  const user = await getCurrentUser();
  
  if (user?.role === 'merchant' && !user.merchantId) {
    console.log('Need to fetch merchant ID for authenticated merchant user');
    
    try {
      // Try the primary endpoint first
      console.log('\nTrying primary endpoint...');
      const merchantResponse = await testCurrentMerchantEndpoint();
      
      if (merchantResponse?.success && merchantResponse.data?.id) {
        console.log(`Primary endpoint succeeded with merchant ID: ${merchantResponse.data.id}`);
        user.merchantId = merchantResponse.data.id;
        return user;
      }
      
      // Try V1 endpoint as fallback
      console.log('\nTrying V1 endpoint...');
      const v1Response = await testV1CurrentMerchantEndpoint();
      
      if (v1Response?.success && v1Response.data?.id) {
        console.log(`V1 endpoint succeeded with merchant ID: ${v1Response.data.id}`);
        user.merchantId = v1Response.data.id;
        return user;
      }
      
      // Try dashboard endpoint as final fallback
      console.log('\nTrying dashboard endpoint...');
      const dashboardResponse = await testDashboardEndpoint();
      
      if (dashboardResponse?.success && dashboardResponse.merchant?.id) {
        console.log(`Dashboard endpoint succeeded with merchant ID: ${dashboardResponse.merchant.id}`);
        user.merchantId = dashboardResponse.merchant.id;
        return user;
      }
      
      console.warn('All endpoints failed to retrieve merchant ID');
    } catch (error) {
      console.error('Error in merchant ID fetch process:', error);
    }
  } else if (user?.merchantId) {
    console.log(`User already has merchantId: ${user.merchantId}`);
  }
  
  return user;
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log('Testing merchant auth integration...');

  // Login if we don't have cookies
  const cookies = loadCookies();
  if (!cookies) {
    console.log('No cookies found, logging in...');
    const loginSuccess = await loginAsMerchant();
    if (!loginSuccess) {
      console.error('Failed to login, cannot proceed with tests');
      return;
    }
  }

  // Test each endpoint directly
  console.log('\n===== Testing Each Endpoint Directly =====');
  
  // Test current-merchant endpoint
  const primaryResult = await testCurrentMerchantEndpoint();
  
  // Test v1/current-merchant endpoint
  const v1Result = await testV1CurrentMerchantEndpoint();
  
  // Test old merchants/current endpoint (should fail)
  const oldResult = await testOldMerchantsCurrentEndpoint();
  
  // Test dashboard endpoint
  const dashboardResult = await testDashboardEndpoint();
  
  // Determine if we can get a merchant ID from any endpoint
  let merchantId = null;
  let source = null;
  
  if (primaryResult?.success && primaryResult.data?.id) {
    merchantId = primaryResult.data.id;
    source = "primary endpoint";
  } else if (v1Result?.success && v1Result.data?.id) {
    merchantId = v1Result.data.id;
    source = "v1 endpoint";
  } else if (dashboardResult?.success && dashboardResult.merchant?.id) {
    merchantId = dashboardResult.merchant.id;
    source = "dashboard endpoint";
  }
  
  // Report the results
  if (merchantId) {
    console.log(`\n✅ SUCCESS: Merchant ID ${merchantId} found from ${source}`);
  } else {
    console.log('\n❌ FAILURE: Could not retrieve merchant ID from any endpoint');
  }

  console.log('\nTests completed');
}

// Run the tests
main().catch(console.error);