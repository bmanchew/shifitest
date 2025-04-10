/**
 * Test script to directly check the contract document endpoint
 * This script tests the /api/contracts/:id/document endpoint with authentication
 */

const axios = require('axios');
const { writeFileSync } = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:5000';
const TEST_CONTRACT_ID = process.argv[2] || null; // Pass contract ID as argument

// Axios instance with cookie jar support
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Store cookies between requests
let cookies = {};

// Save response cookies
function saveCookies(response) {
  const setCookieHeader = response.headers['set-cookie'];
  if (setCookieHeader) {
    setCookieHeader.forEach(cookie => {
      const [cookieStr] = cookie.split(';');
      const [name, value] = cookieStr.split('=');
      cookies[name] = value;
    });
  }
}

// Add cookies to request
function addCookiesToRequest(config) {
  const cookieStr = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
  
  if (cookieStr) {
    config.headers.Cookie = cookieStr;
  }
  
  return config;
}

// Intercept requests to add cookies
api.interceptors.request.use(addCookiesToRequest);

// Intercept responses to save cookies
api.interceptors.response.use(response => {
  saveCookies(response);
  return response;
});

// Login as admin
async function loginAsAdmin() {
  try {
    // First request to get CSRF token
    const csrfResponse = await api.get('/api/csrf-token');
    const csrfToken = csrfResponse.data.csrfToken;
    
    console.log('Obtained CSRF token:', csrfToken);
    
    // Login request
    const loginResponse = await api.post('/api/auth/login', {
      email: 'admin@shifi.com',
      password: 'admin123'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    console.log('Login successful:', loginResponse.status, loginResponse.statusText);
    return true;
  } catch (error) {
    console.error('Login failed:', error.response?.status, error.response?.data || error.message);
    return false;
  }
}

// Find recent contracts
async function findRecentContracts() {
  try {
    // Fetch most recent contracts
    const response = await api.get('/api/admin/contracts?limit=10');
    
    if (response.data.success && response.data.contracts) {
      console.log(`Found ${response.data.contracts.length} contracts`);
      return response.data.contracts;
    } else {
      console.error('Failed to get contracts:', response.data);
      return [];
    }
  } catch (error) {
    console.error('Error finding contracts:', error.response?.status, error.response?.data || error.message);
    return [];
  }
}

// Test document endpoint for a contract
async function testDocumentEndpoint(contractId) {
  try {
    console.log(`Testing document endpoint for contract ID: ${contractId}`);
    
    // Fetch document URL
    const response = await api.get(`/api/contracts/${contractId}/document`);
    
    console.log('Response status:', response.status, response.statusText);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.documentUrl) {
      console.log('\nDocument URL received:', response.data.documentUrl);
      return response.data;
    } else {
      console.error('Document URL not found in response');
      return null;
    }
  } catch (error) {
    console.error('Error fetching document:', error.response?.status, error.response?.data || error.message);
    return null;
  }
}

// Check if a URL is accessible
async function checkDocumentUrl(url) {
  try {
    console.log(`Checking document URL accessibility: ${url}`);
    
    // Make a HEAD request to check if the URL is accessible
    const response = await axios.head(url);
    
    console.log('URL is accessible:', response.status, response.statusText);
    console.log('Content type:', response.headers['content-type']);
    
    return {
      accessible: true,
      status: response.status,
      contentType: response.headers['content-type']
    };
  } catch (error) {
    console.error('URL is not accessible:', error.response?.status || error.message);
    return {
      accessible: false,
      error: error.message,
      status: error.response?.status
    };
  }
}

// Main function
async function main() {
  console.log('Starting contract document endpoint test...');
  
  // Login
  const loginSuccess = await loginAsAdmin();
  if (!loginSuccess) {
    console.error('Login failed. Exiting test.');
    return;
  }
  
  // If contract ID provided, test only that contract
  if (TEST_CONTRACT_ID) {
    const documentData = await testDocumentEndpoint(TEST_CONTRACT_ID);
    
    if (documentData && documentData.documentUrl) {
      await checkDocumentUrl(documentData.documentUrl);
    }
    return;
  }
  
  // Find contracts to test
  const contracts = await findRecentContracts();
  if (contracts.length === 0) {
    console.error('No contracts found. Exiting test.');
    return;
  }
  
  // Find contracts with 'signed' or 'active' status
  const signedContracts = contracts.filter(contract => 
    ['signed', 'active'].includes(contract.status));
  
  if (signedContracts.length === 0) {
    console.log('No signed contracts found. Testing first 3 contracts instead.');
    
    // Test first 3 contracts regardless of status
    for (let i = 0; i < Math.min(3, contracts.length); i++) {
      console.log('\n---------------------------------------');
      const documentData = await testDocumentEndpoint(contracts[i].id);
      
      if (documentData && documentData.documentUrl) {
        await checkDocumentUrl(documentData.documentUrl);
      }
    }
  } else {
    console.log(`Found ${signedContracts.length} signed contracts.`);
    
    // Test signed contracts
    for (let i = 0; i < Math.min(3, signedContracts.length); i++) {
      console.log('\n---------------------------------------');
      const documentData = await testDocumentEndpoint(signedContracts[i].id);
      
      if (documentData && documentData.documentUrl) {
        await checkDocumentUrl(documentData.documentUrl);
      }
    }
  }
  
  console.log('\nTest completed.');
}

// Run main function
main().catch(error => {
  console.error('Unhandled error:', error);
});