/**
 * Test script for fetching contracts for merchant ID 49 (brandon@shilohfinance.com)
 * This script uses CommonJS syntax for better compatibility.
 */

const axios = require('axios');
const fs = require('fs');

// Cookies file
const COOKIES_FILE = './brandon-cookies.txt';

// Function to extract cookies from response
function extractCookies(response) {
  const setCookieHeaders = response.headers['set-cookie'];
  if (!setCookieHeaders) return '';
  
  return setCookieHeaders.join('; ');
}

// Function to save cookies to file
function saveCookies(cookies) {
  fs.writeFileSync(COOKIES_FILE, cookies);
  console.log('Cookies saved to', COOKIES_FILE);
}

// Function to load cookies from file
function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookies = fs.readFileSync(COOKIES_FILE, 'utf8');
      console.log('Loaded cookies from', COOKIES_FILE);
      return cookies;
    }
  } catch (error) {
    console.error('Error loading cookies:', error.message);
  }
  return '';
}

// Function to get CSRF token
async function getCsrfToken() {
  const response = await axios.get('http://localhost:5000/api/csrf-token');
  // Extract and save cookie
  const cookies = extractCookies(response);
  saveCookies(cookies);
  return response.data.csrfToken;
}

// Function to login as brandon@shilohfinance.com
async function loginAsBrandon(csrfToken) {
  const cookies = loadCookies();
  
  const response = await axios.post('http://localhost:5000/api/auth/login', {
    email: 'brandon@shilohfinance.com',
    password: 'Password123!'
  }, {
    headers: {
      'Cookie': cookies,
      'X-CSRF-Token': csrfToken
    }
  });
  
  // Update cookies
  const newCookies = extractCookies(response);
  if (newCookies) {
    saveCookies(newCookies);
  }
  
  return response.data;
}

// Function to get current merchant
async function getCurrentMerchant() {
  const cookies = loadCookies();
  
  const response = await axios.get('http://localhost:5000/api/current-merchant', {
    headers: {
      'Cookie': cookies
    }
  });
  
  console.log('Current merchant response:', JSON.stringify(response.data));
  
  // Handle various response formats
  if (response.data && response.data.merchant) {
    return response.data.merchant;
  } else if (response.data && response.data.id) {
    // Response is the merchant object directly
    return response.data;
  } else if (response.data && response.data.success && response.data.data) {
    // Response is {success: true, data: merchantObject}
    return response.data.data;
  } else {
    console.error('Unexpected merchant response format:', response.data);
    throw new Error('Invalid merchant response format');
  }
}

// Function to fetch contracts for merchant
async function getMerchantContracts(merchantId) {
  const cookies = loadCookies();
  
  const response = await axios.get(`http://localhost:5000/api/contracts?merchantId=${merchantId}`, {
    headers: {
      'Cookie': cookies
    }
  });
  
  console.log('Contracts API response:', JSON.stringify(response.data));
  
  // Check the format of the response
  let contracts = [];
  
  if (Array.isArray(response.data)) {
    console.log('API response is a direct array of contracts');
    contracts = response.data;
  } else if (response.data && response.data.success && Array.isArray(response.data.contracts)) {
    console.log('API response is an object with success and contracts properties');
    contracts = response.data.contracts;
  } else if (response.data && Array.isArray(response.data.data)) {
    console.log('API response has contracts in data property');
    contracts = response.data.data;
  } else {
    console.log('Unexpected API response format:', response.data);
  }
  
  return contracts;
}

// Function to create a test ticket
async function createTestTicket(merchantId, contractId, csrfToken) {
  const cookies = loadCookies();
  
  const ticketData = {
    subject: 'Test Ticket from API Script',
    category: 'technical_issue',
    priority: 'normal',
    description: 'This is a test ticket created by the API testing script',
    merchantId: merchantId,
    contractId: contractId,
    createdBy: 2, // Brandon's user ID
    userId: 2     // Also include userId for backward compatibility
  };
  
  const response = await axios.post('http://localhost:5000/api/communications/tickets', ticketData, {
    headers: {
      'Cookie': cookies,
      'X-CSRF-Token': csrfToken
    }
  });
  
  return response.data;
}

// Main function to run the test
async function runTest() {
  try {
    console.log('=== Testing Contracts and Ticket System for Merchant ID 49 ===');
    
    // 1. Get CSRF token
    console.log('\n--- Step 1: Get CSRF Token ---');
    const csrfToken = await getCsrfToken();
    console.log('CSRF Token:', csrfToken);
    
    // 2. Login as brandon@shilohfinance.com
    console.log('\n--- Step 2: Login as brandon@shilohfinance.com ---');
    const loginResult = await loginAsBrandon(csrfToken);
    console.log('Login result:', loginResult.success ? 'Success' : 'Failed');
    
    // 3. Get merchant profile
    console.log('\n--- Step 3: Get Merchant Profile ---');
    const merchant = await getCurrentMerchant();
    console.log('Merchant:', merchant.name, `(ID: ${merchant.id})`);
    
    if (merchant.id !== 49) {
      console.warn('⚠️ Expected merchant ID 49, but got:', merchant.id);
    }
    
    // 4. Get merchant contracts
    console.log('\n--- Step 4: Get Merchant Contracts ---');
    const contracts = await getMerchantContracts(merchant.id);
    console.log(`Found ${contracts.length} contracts for merchant ID ${merchant.id}`);
    
    if (contracts.length > 0) {
      console.log('✅ Successfully retrieved contracts');
      console.log('\nFirst contract:', contracts[0].id, contracts[0].contractNumber);
      
      // 5. Create a test ticket
      console.log('\n--- Step 5: Create Test Ticket ---');
      try {
        const ticket = await createTestTicket(merchant.id, contracts[0].id, csrfToken);
        console.log('✅ Successfully created ticket:', ticket.id, ticket.ticketNumber);
      } catch (error) {
        console.log('❌ Failed to create ticket');
        console.error('Error:', error.response?.data || error.message);
      }
    } else {
      console.log('❌ No contracts found for this merchant');
    }
    
    console.log('\n=== Test Completed ===');
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
runTest().catch(console.error);