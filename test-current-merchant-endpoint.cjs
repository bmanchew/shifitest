/**
 * Test script for testing the new /api/merchants/current-merchant endpoint
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configure axios
const API_BASE_URL = 'http://localhost:5000';
let cookies = [];

function loadCookies() {
  try {
    const cookieContent = fs.readFileSync(path.join(__dirname, 'merchant-cookies.txt'), 'utf8');
    cookies = cookieContent.split(';').map(cookie => cookie.trim());
    console.log(`Loaded ${cookies.length} cookies`);
  } catch (error) {
    console.log('No cookies file found or error reading cookies:', error.message);
  }
}

function saveCookies(cookieString) {
  if (!cookieString) return;
  
  const cookieArray = cookieString.split(';').map(cookie => cookie.trim());
  cookies = cookieArray;
  fs.writeFileSync(path.join(__dirname, 'merchant-cookies.txt'), cookieArray.join('; '), 'utf8');
  console.log('Cookies saved successfully');
}

async function getCsrfToken() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/csrf-token`, {
      headers: { Cookie: cookies.join('; ') }
    });
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    return null;
  }
}

async function loginAsMerchant() {
  console.log('Attempting to login as merchant...');
  
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: 'brandon@shilohfinance.com',
      password: 'Password123!',
      userType: 'merchant'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
        Cookie: cookies.join('; ')
      }
    });
    
    if (response.headers['set-cookie']) {
      saveCookies(response.headers['set-cookie'].join('; '));
    }
    
    console.log('Login successful!');
    return true;
  } catch (error) {
    console.error('Login failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

async function testCurrentMerchantEndpoint() {
  console.log('=== TEST: /api/merchants/current-merchant endpoint ===');
  
  try {
    console.log(`Using cookies: ${cookies.join('; ')}`);
    
    const response = await axios.get(`${API_BASE_URL}/api/current-merchant`, {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    
    console.log('Response status:', response.status);
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
      console.error('Response data:', error.response.data);
    }
    console.log('Test result: FAILED');
    return false;
  }
}

async function testDashboardEndpoint() {
  console.log('=== TEST: /api/merchant-dashboard/current endpoint ===');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/merchant-dashboard/current`, {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.merchant) {
      console.log('Test result: SUCCESS');
      return true;
    } else {
      console.log('Test result: FAILED - Expected merchant data in response');
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

async function testContractsEndpoint() {
  console.log('=== TEST: /api/contracts with merchantId endpoint ===');
  
  try {
    const merchant = await axios.get(`${API_BASE_URL}/api/current-merchant`, {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    
    const merchantId = merchant.data.data.id;
    console.log(`Using merchant ID: ${merchantId}`);
    
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
  await testCurrentMerchantEndpoint();
  
  // Test the merchant dashboard endpoint
  await testDashboardEndpoint();
  
  // Test the contracts endpoint
  await testContractsEndpoint();
  
  console.log('All tests completed');
}

main().catch(error => {
  console.error('Unhandled error:', error);
});