/**
 * Test script for the contracts API endpoints
 * This script logs in as a merchant user and accesses contract data
 */

import fs from 'fs';
import axios from 'axios';

// Test merchant credentials
const TEST_EMAIL = 'brandon@shilohfinance.com';
const TEST_PASSWORD = 'shifitest123';

// Cookie storage
let cookies = [];

// Base URL for API requests
const API_BASE_URL = 'http://localhost:5000/api';

// Save cookies to a file
function saveCookies(response) {
  if (response.headers['set-cookie']) {
    cookies = response.headers['set-cookie'];
    fs.writeFileSync('cookies.txt', cookies.join('\n'));
    console.log('Cookies saved to cookies.txt');
  }
}

// Load cookies from file
function loadCookies() {
  try {
    if (fs.existsSync('cookies.txt')) {
      cookies = fs.readFileSync('cookies.txt', 'utf8').split('\n');
      console.log('Cookies loaded from cookies.txt');
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
}

// Get CSRF token from the server
async function getCsrfToken() {
  console.log('Getting CSRF token...');
  try {
    // Use the correct CSRF token endpoint
    const response = await axios.get(`${API_BASE_URL}/csrf-token`, {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    
    saveCookies(response);
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Login as merchant
async function loginAsMerchant() {
  // First load any existing cookies
  loadCookies();
  
  // Get a CSRF token for login
  const csrfToken = await getCsrfToken();
  if (!csrfToken) {
    console.error('Failed to get CSRF token');
    return false;
  }
  
  console.log('Logging in as merchant...');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    }, {
      headers: {
        'X-CSRF-Token': csrfToken,
        Cookie: cookies.join('; ')
      }
    });
    
    saveCookies(response);
    console.log('Login successful:', response.data);
    return true;
  } catch (error) {
    console.error('Login error:', error.response ? error.response.data : error.message);
    return false;
  }
}

// Test merchant contracts endpoint
async function testMerchantContracts() {
  console.log('\nTesting merchant contracts endpoint...');
  
  try {
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      console.error('Failed to get CSRF token');
      return;
    }
    
    // Get current merchant
    console.log('Getting current merchant info...');
    const merchantResponse = await axios.get(`${API_BASE_URL}/merchants/current`, {
      headers: {
        'X-CSRF-Token': csrfToken,
        Cookie: cookies.join('; ')
      }
    });
    
    const merchantId = merchantResponse.data.merchant.id;
    console.log(`Current merchant ID: ${merchantId}`);
    
    // Get merchant's contracts
    console.log('Getting merchant contracts...');
    const contractsResponse = await axios.get(`${API_BASE_URL}/contracts?merchantId=${merchantId}`, {
      headers: {
        'X-CSRF-Token': csrfToken,
        Cookie: cookies.join('; ')
      }
    });
    
    console.log(`Retrieved ${contractsResponse.data.contracts.length} contracts`);
    
    // Test a specific contract by ID
    if (contractsResponse.data.contracts.length > 0) {
      const contractId = contractsResponse.data.contracts[0].id;
      console.log(`\nTesting specific contract endpoint for ID: ${contractId}`);
      
      const contractResponse = await axios.get(`${API_BASE_URL}/contracts/${contractId}`, {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      });
      
      console.log('Contract details:', JSON.stringify(contractResponse.data.contract, null, 2));
      
      // Test underwriting data endpoint
      console.log(`\nTesting underwriting data endpoint for contract ID: ${contractId}`);
      const underwritingResponse = await axios.get(`${API_BASE_URL}/contracts/${contractId}/underwriting`, {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      });
      
      console.log('Underwriting data response:', JSON.stringify(underwritingResponse.data, null, 2));
    }
  } catch (error) {
    console.error('Error testing contracts:', error.response ? error.response.data : error.message);
  }
}

// Main function
async function main() {
  console.log('Starting contract API test...\n');
  
  // Login as a merchant
  const loggedIn = await loginAsMerchant();
  
  if (loggedIn) {
    await testMerchantContracts();
  } else {
    console.error('Login failed. Cannot proceed with tests.');
  }
}

// Run the tests
main()
  .then(() => console.log('\nTest completed'))
  .catch(error => console.error('Test failed:', error));