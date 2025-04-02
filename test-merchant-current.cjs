/**
 * Test script to verify the new /api/merchants/current endpoint
 * This script logs in as a merchant and then calls the current merchant endpoint
 * to retrieve the merchant's information.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Axios client
const api = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true
});

// Cookie handling
function saveCookies(response) {
  if (response.headers['set-cookie']) {
    fs.writeFileSync(
      path.join(__dirname, 'test-merchant-cookies.txt'), 
      response.headers['set-cookie'].join('; ')
    );
    console.log('Cookies saved.');
  }
}

function loadCookies() {
  try {
    const cookiesPath = path.join(__dirname, 'test-merchant-cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      return fs.readFileSync(cookiesPath, 'utf8');
    }
  } catch (err) {
    console.error('Error loading cookies:', err);
  }
  return '';
}

// Add cookies to request
api.interceptors.request.use(config => {
  const cookies = loadCookies();
  if (cookies) {
    // Make sure we don't add invalid characters in the cookie header
    // Convert cookies to a valid format
    const sanitizedCookies = cookies.split(';')
      .map(cookie => cookie.trim())
      .filter(cookie => cookie && !cookie.includes(','))
      .join('; ');
    
    if (sanitizedCookies) {
      config.headers.Cookie = sanitizedCookies;
    }
  }
  return config;
});

// Add cookie saving to responses
api.interceptors.response.use(response => {
  saveCookies(response);
  return response;
});

/**
 * Get a CSRF token for API calls
 */
async function getCsrfToken() {
  try {
    const response = await api.get('/api/csrf-token');
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    throw error;
  }
}

/**
 * Login as a merchant
 */
async function loginAsMerchant() {
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await api.post('/api/auth/login', {
      email: 'brandon@shilohfinance.com',
      password: 'Password123!'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    console.log('Login successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Test the /api/merchants/current endpoint
 */
async function testCurrentMerchantEndpoint() {
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await api.get('/api/merchants/current', {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    console.log('Current merchant data:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting current merchant:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Login as merchant
    await loginAsMerchant();
    
    // Test the current merchant endpoint
    const merchantData = await testCurrentMerchantEndpoint();
    
    console.log('Success! Current merchant endpoint is working correctly.');
    console.log('Merchant data:', JSON.stringify(merchantData, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
main();