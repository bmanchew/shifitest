/**
 * Test script to verify that the contracts API endpoint is working properly
 * with the fixes for term vs termMonths
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'brandon@shilohfinance.com';
const TEST_PASSWORD = 'shifitest123';
const TEST_MERCHANT_ID = 49;

// Create axios instance with credentials handling
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Cookie handling
const COOKIES_FILE = 'test-cookies.json';
let authCookie = null;

// Load cookies if they exist
function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
      if (cookies.authToken) {
        authCookie = cookies.authToken;
      }
      return cookies;
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
  return {};
}

// Save cookies to file
function saveCookies(cookies) {
  try {
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  } catch (error) {
    console.error('Error saving cookies:', error);
  }
}

// Create a cookie jar for axios
// Setup axios to handle cookies properly
const cookieJar = {
  authToken: null
};

// Handle response to save cookies
api.interceptors.response.use(
  (response) => {
    // Check if there are cookies in the response
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      console.log('Received cookies:', setCookie);
      // Extract auth token
      const authTokenCookie = setCookie.find(cookie => cookie.startsWith('auth_token='));
      if (authTokenCookie) {
        const authToken = authTokenCookie.split(';')[0].split('=')[1];
        cookieJar.authToken = authToken;
        authCookie = authToken;
        console.log('Saved auth token:', authToken);
        
        // Also save to file for persistence
        const cookies = loadCookies();
        cookies.authToken = authToken;
        saveCookies(cookies);
      }
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add cookies to each request
api.interceptors.request.use(
  (config) => {
    if (authCookie) {
      console.log('Using auth cookie for request to:', config.url);
      config.headers = {
        ...config.headers,
        Cookie: `auth_token=${authCookie}`
      };
    } else {
      console.log('No auth cookie available for request to:', config.url);
    }
    return config;
  }, 
  (error) => {
    return Promise.reject(error);
  }
);

// Get CSRF token for authenticated requests
async function getCsrfToken() {
  try {
    const response = await api.get('/csrf-token');
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    throw error;
  }
}

// Login as a merchant
async function login() {
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await api.post('/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    }, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });

    console.log('Login successful');
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
}

// Get contracts for merchant
async function getContracts() {
  try {
    console.log(`Getting contracts for merchant ID ${TEST_MERCHANT_ID}`);
    const response = await api.get(`/contracts?merchantId=${TEST_MERCHANT_ID}`);
    return response.data;
  } catch (error) {
    console.error('Error getting contracts:', error.response?.data || error.message);
    throw error;
  }
}

// Get a specific contract
async function getContract(contractId) {
  try {
    const response = await api.get(`/contracts/${contractId}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting contract ${contractId}:`, error.response?.data || error.message);
    throw error;
  }
}

// Inspect term field in contracts to verify consistent mapping
function inspectTermFields(contracts) {
  console.log('\nInspecting term fields in contracts:');
  let hasErrors = false;
  
  contracts.forEach(contract => {
    console.log(`Contract #${contract.contractNumber} (ID: ${contract.id}):`);
    console.log(`  term: ${contract.term}`);
    console.log(`  termMonths: ${contract.termMonths}`);
    console.log(`  Status: ${contract.status}`);
    console.log(`  Amount: $${contract.amount}`);
    
    // Validate data types
    if (typeof contract.term !== 'number') {
      console.error(`  ERROR: term field is not a number, got ${typeof contract.term}`);
      hasErrors = true;
    }
    
    if (typeof contract.termMonths !== 'number') {
      console.error(`  ERROR: termMonths field is not a number, got ${typeof contract.termMonths}`);
      hasErrors = true;
    }
    
    // Validate equivalence (both should have the same value)
    if (contract.term !== contract.termMonths) {
      console.error(`  ERROR: term (${contract.term}) and termMonths (${contract.termMonths}) don't match`);
      hasErrors = true;
    } else {
      console.log(`  ✓ term and termMonths match: ${contract.term}`);
    }
    
    console.log('');
  });
  
  if (hasErrors) {
    console.error("⚠️ Term field mapping issues detected!");
  } else {
    console.log("✅ All contracts have consistent term and termMonths values");
  }
}

// Run the test
async function runTest() {
  try {
    // Login
    await login();
    
    // Get all contracts
    const contractsData = await getContracts();
    
    if (!contractsData.success || !Array.isArray(contractsData.contracts)) {
      console.error('Error: Expected {success: true, contracts: [...]} in response but got:', contractsData);
      return;
    }
    
    console.log(`Retrieved ${contractsData.contracts.length} contracts`);
    
    // Inspect term fields
    inspectTermFields(contractsData.contracts);
    
    // Get details of first contract for additional testing
    if (contractsData.contracts.length > 0) {
      const firstContractId = contractsData.contracts[0].id;
      console.log(`Getting details for contract ID ${firstContractId}`);
      
      const contractDetails = await getContract(firstContractId);
      console.log('Contract details retrieved successfully:');
      console.log('Term field:', contractDetails.term);
      console.log('TermMonths field:', contractDetails.termMonths);
    }
    
    console.log('\nTest completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Execute test
runTest();