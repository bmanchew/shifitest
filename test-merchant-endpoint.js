/**
 * This script tests the merchants/current endpoint directly
 * to diagnose issues with retrieving the current merchant data
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Base URL for API requests
const baseUrl = 'http://localhost:5000';

// File path for storing cookies
const cookiesFile = 'merchant-cookies.txt';

/**
 * Load cookies from the cookies file
 */
function loadCookies() {
  try {
    if (fs.existsSync(cookiesFile)) {
      return fs.readFileSync(cookiesFile, 'utf8');
    }
    return '';
  } catch (error) {
    console.error('Error loading cookies:', error.message);
    return '';
  }
}

/**
 * Save cookies to the cookies file
 */
function saveCookies(cookieString) {
  try {
    fs.writeFileSync(cookiesFile, cookieString);
    console.log('Cookies saved successfully');
  } catch (error) {
    console.error('Error saving cookies:', error.message);
  }
}

/**
 * Get CSRF token required for authenticated requests
 */
async function getCsrfToken() {
  try {
    console.log('Fetching CSRF token...');
    
    const response = await axios.get(`${baseUrl}/api/csrf-token`, {
      withCredentials: true
    });
    
    console.log('CSRF token fetched successfully');
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Login as a merchant user
 */
async function loginAsMerchant() {
  try {
    console.log('Logging in as merchant...');
    
    // Fetch CSRF token first
    const csrfToken = await getCsrfToken();
    
    // Login credentials
    const credentials = {
      email: 'test-merchant@example.com',
      password: 'Password123!'
    };
    
    const response = await axios.post(
      `${baseUrl}/api/auth/login`,
      credentials,
      {
        headers: {
          'X-CSRF-Token': csrfToken
        },
        withCredentials: true
      }
    );
    
    // Extract Set-Cookie header
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      const cookieString = cookies.join('; ');
      saveCookies(cookieString);
    }
    
    console.log('Login successful');
    console.log('User data:', response.data.user);
    
    return { 
      csrfToken,
      userData: response.data.user
    };
  } catch (error) {
    console.error('Login error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Get the current merchant with full request/response debugging
 */
async function getCurrentMerchant(csrfToken) {
  try {
    console.log('Fetching current merchant data...');
    
    const cookies = loadCookies();
    console.log('Using cookies:', cookies);
    
    // Log some debugging data about our request
    console.log('Request URL:', `${baseUrl}/api/merchants/current`);
    console.log('CSRF Token:', csrfToken);
    
    // Debug headers
    const headers = {
      'Cookie': cookies,
      'X-CSRF-Token': csrfToken
    };
    console.log('Request headers:', headers);
    
    // Make the request with detailed debugging
    const response = await axios.get(
      `${baseUrl}/api/merchants/current`,
      {
        headers,
        withCredentials: true
      }
    );
    
    console.log('Merchant response status:', response.status);
    console.log('Merchant response data:', JSON.stringify(response.data, null, 2));
    
    // Check the format of the response
    console.log('Response format check:');
    console.log('- Has success property:', 'success' in response.data);
    console.log('- Success value:', response.data.success);
    console.log('- Has data property:', 'data' in response.data);
    console.log('- Has merchant property:', 'merchant' in response.data);
    
    if (response.data.data) {
      console.log('- Data has ID:', 'id' in response.data.data);
      if ('id' in response.data.data) {
        console.log('- Data ID value:', response.data.data.id);
      }
    }
    
    if (response.data.merchant) {
      console.log('- Merchant has ID:', 'id' in response.data.merchant);
      if ('id' in response.data.merchant) {
        console.log('- Merchant ID value:', response.data.merchant.id); 
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching current merchant:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      
      // Log request details for debugging
      console.error('Request details:', {
        baseURL: error.config?.baseURL,
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        withCredentials: error.config?.withCredentials
      });
    } else {
      console.error('No response object available');
    }
    throw error;
  }
}

/**
 * Test alternative endpoints for getting merchant data
 */
async function testAlternativeEndpoints(csrfToken) {
  try {
    console.log('\nTesting alternative endpoints for merchant data...');
    
    const cookies = loadCookies();
    const headers = {
      'Cookie': cookies,
      'X-CSRF-Token': csrfToken
    };
    
    // Test direct merchant router's current endpoint
    console.log('\nTesting /api/merchant/current endpoint...');
    try {
      const merchantResponse = await axios.get(
        `${baseUrl}/api/merchant/current`,
        {
          headers,
          withCredentials: true
        }
      );
      console.log('Response status:', merchantResponse.status);
      console.log('Response data:', JSON.stringify(merchantResponse.data, null, 2));
    } catch (error) {
      console.error('Error with /api/merchant/current:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    // Test merchant dashboard current endpoint
    console.log('\nTesting /api/merchant-dashboard/current endpoint...');
    try {
      const dashboardResponse = await axios.get(
        `${baseUrl}/api/merchant-dashboard/current`,
        {
          headers,
          withCredentials: true
        }
      );
      console.log('Response status:', dashboardResponse.status);
      console.log('Response data:', JSON.stringify(dashboardResponse.data, null, 2));
    } catch (error) {
      console.error('Error with /api/merchant-dashboard/current:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
    }
  } catch (error) {
    console.error('Error testing alternative endpoints:', error.message);
  }
}

/**
 * Run the main test
 */
async function main() {
  try {
    // Login as merchant
    const { csrfToken } = await loginAsMerchant();
    
    // Try to get current merchant
    await getCurrentMerchant(csrfToken);
    
    // Test alternative endpoints if the main one fails
    await testAlternativeEndpoints(csrfToken);
    
    console.log('\nTest completed successfully');
  } catch (error) {
    console.error('\nTest failed:', error.message);
  }
}

// Run the test
main();