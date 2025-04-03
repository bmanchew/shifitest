/**
 * Test script for the updated current merchant endpoint
 * This script tests both the legacy and v1 endpoints
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for the test
const BASE_URL = 'http://localhost:5000';
const COOKIES_FILE = 'merchant-cookies.txt';
const TEST_EMAIL = 'test-merchant@example.com';
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
 * Login as a merchant
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
    return true;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test the current merchant endpoint on the legacy path
 */
async function testLegacyCurrentMerchantEndpoint() {
  try {
    const cookies = loadCookies();
    const response = await axios.get(`${BASE_URL}/api/current-merchant`, {
      headers: {
        Cookie: cookies,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    console.log('\n===== Legacy Current Merchant Endpoint =====');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('\n===== Legacy Current Merchant Endpoint Error =====');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test the current merchant endpoint on the v1 path
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
 * Main function to run all tests
 */
async function main() {
  console.log('Testing current merchant endpoints...');

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

  // Test the endpoints
  await testLegacyCurrentMerchantEndpoint();
  await testV1CurrentMerchantEndpoint();
  await testOldMerchantsCurrentEndpoint();

  console.log('\nTests completed');
}

// Run the tests
main().catch(console.error);