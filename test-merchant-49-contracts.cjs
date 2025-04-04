/**
 * Test script to diagnose why contracts for merchant ID 49 are not appearing in the UI dropdown
 */
const axios = require('axios');
const fs = require('fs');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const COOKIES_FILE = './brandon-cookies.txt';  // Brandon is merchant ID 49

// Merchant credentials (Brandon)
const MERCHANT_EMAIL = 'brandon@shilohfinance.com';
const MERCHANT_PASSWORD = 'Password123!';

// Helper function to save cookies
function saveCookies(cookieString) {
  fs.writeFileSync(COOKIES_FILE, cookieString);
  console.log('Cookies saved to', COOKIES_FILE);
}

// Helper function to load cookies
function loadCookies() {
  try {
    return fs.readFileSync(COOKIES_FILE, 'utf8');
  } catch (error) {
    console.log('No cookies file found, will create one after login');
    return '';
  }
}

// Login as a merchant
async function loginAsMerchant() {
  try {
    console.log('Logging in as merchant...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: MERCHANT_EMAIL,
      password: MERCHANT_PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Bypass': 'test-merchant-message-read' // Special header to bypass CSRF for testing
      }
    });

    // Save cookies for future requests
    if (response.headers['set-cookie']) {
      const cookieString = response.headers['set-cookie'].join('; ');
      saveCookies(cookieString);
      return cookieString;
    }

    console.error('No cookies received during login');
    return null;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    return null;
  }
}

// Function to test the contracts API endpoint directly
async function testContractsApiDirect(cookies) {
  try {
    console.log('Testing GET /api/contracts?merchantId=49 endpoint directly...');
    const response = await axios.get(`${BASE_URL}/contracts?merchantId=49`, {
      headers: {
        'Cookie': cookies
      }
    });
    
    console.log('API Response Status:', response.status);
    console.log('API Response Data:', JSON.stringify(response.data, null, 2));
    
    // Check if we get contracts array or contracts property
    if (Array.isArray(response.data)) {
      console.log(`Found ${response.data.length} contracts in array response`);
      return response.data;
    } else if (response.data.contracts && Array.isArray(response.data.contracts)) {
      console.log(`Found ${response.data.contracts.length} contracts in contracts property`);
      return response.data.contracts;
    } else {
      console.log('Unexpected response format - no contracts array found');
      return [];
    }
  } catch (error) {
    console.error('Error fetching contracts:', error.response?.data || error.message);
    return [];
  }
}

// Function to test the merchant endpoint for contracts
async function testMerchantContractsApi(cookies) {
  try {
    console.log('Testing GET /api/merchant/49/contracts endpoint...');
    const response = await axios.get(`${BASE_URL}/merchant/49/contracts`, {
      headers: {
        'Cookie': cookies
      }
    });
    
    console.log('API Response Status:', response.status);
    console.log('API Response Data:', JSON.stringify(response.data, null, 2));
    
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Error fetching merchant contracts:', error.response?.data || error.message);
    return [];
  }
}

// Function to filter non-archived active/pending contracts
function filterActiveContracts(contracts) {
  const activeContracts = contracts.filter(contract => 
    !contract.archived && 
    (contract.status === 'active' || contract.status === 'pending')
  );
  
  console.log(`Found ${activeContracts.length} active/pending non-archived contracts out of ${contracts.length} total`);
  return activeContracts;
}

// Main test function
async function runTest() {
  let cookies = loadCookies();
  
  if (!cookies) {
    cookies = await loginAsMerchant();
    if (!cookies) {
      console.error('Failed to login. Exiting test.');
      return;
    }
  }

  // Test contracts API endpoint directly
  const contractsFromApi = await testContractsApiDirect(cookies);
  
  // Test merchant endpoint for contracts
  const contractsFromMerchantApi = await testMerchantContractsApi(cookies);
  
  // Filter for active/pending non-archived contracts
  console.log('\nFiltering contracts API results:');
  const activeContractsFromApi = filterActiveContracts(contractsFromApi);
  
  console.log('\nFiltering merchant API results:');
  const activeContractsFromMerchantApi = filterActiveContracts(contractsFromMerchantApi);
  
  // Check if contract IDs exist in both endpoints
  console.log('\nComparing contract IDs between endpoints:');
  const apiContractIds = new Set(activeContractsFromApi.map(c => c.id));
  const merchantApiContractIds = new Set(activeContractsFromMerchantApi.map(c => c.id));
  
  console.log(`Contracts API has ${apiContractIds.size} unique contract IDs`);
  console.log(`Merchant API has ${merchantApiContractIds.size} unique contract IDs`);
  
  // Check for missing contracts
  const missingFromApi = [...merchantApiContractIds].filter(id => !apiContractIds.has(id));
  const missingFromMerchantApi = [...apiContractIds].filter(id => !merchantApiContractIds.has(id));
  
  if (missingFromApi.length > 0) {
    console.log(`Contracts missing from /api/contracts endpoint: ${missingFromApi.join(', ')}`);
  }
  
  if (missingFromMerchantApi.length > 0) {
    console.log(`Contracts missing from /api/merchant/49/contracts endpoint: ${missingFromMerchantApi.join(', ')}`);
  }
  
  // Log contract numbers for debugging
  console.log('\nContract numbers from API:');
  activeContractsFromApi.forEach(c => console.log(`ID: ${c.id}, Number: ${c.contractNumber}, Status: ${c.status}, Archived: ${c.archived}`));
  
  console.log('\nContract numbers from Merchant API:');
  activeContractsFromMerchantApi.forEach(c => console.log(`ID: ${c.id}, Number: ${c.contractNumber}, Status: ${c.status}, Archived: ${c.archived}`));
}

// Run the test
runTest().catch(error => {
  console.error('Test failed with error:', error);
});