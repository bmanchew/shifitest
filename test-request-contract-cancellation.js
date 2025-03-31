/**
 * Test script for the contract cancellation request endpoint
 * This script tests the merchant's ability to request contract cancellation
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5000';

// Store cookies in a file for reuse
const COOKIES_FILE = path.join(__dirname, 'merchant_cookies.txt');
let cookies = [];

/**
 * Load cookies from cookies.txt if it exists
 */
function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookiesText = fs.readFileSync(COOKIES_FILE, 'utf8');
      cookies = cookiesText.split('\n')
        .filter(cookie => cookie.trim().length > 0);
      console.log(`Loaded ${cookies.length} cookies from file`);
    }
  } catch (error) {
    console.error('Error loading cookies:', error.message);
  }
}

/**
 * Save cookies to cookies.txt
 */
function saveCookies() {
  try {
    fs.writeFileSync(COOKIES_FILE, cookies.join('\n'), 'utf8');
    console.log(`Saved ${cookies.length} cookies to file`);
  } catch (error) {
    console.error('Error saving cookies:', error.message);
  }
}

/**
 * Get a CSRF token from the server
 */
async function getCsrfToken() {
  try {
    const response = await axios.get(`${API_URL}/api/csrf-token`, {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    
    // Save any cookies that were set
    if (response.headers['set-cookie']) {
      cookies = cookies.concat(response.headers['set-cookie']);
      saveCookies();
    }
    
    return response.data.token;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Login as a merchant
 */
async function loginAsMerchant() {
  try {
    console.log('Logging in as merchant...');
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(
      `${API_URL}/api/auth/login`,
      {
        email: 'merchant@example.com',
        password: 'password123'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    // Save any cookies that were set
    if (response.headers['set-cookie']) {
      cookies = cookies.concat(response.headers['set-cookie']);
      saveCookies();
    }
    
    console.log('Merchant login successful!');
    return response.data;
  } catch (error) {
    console.error('Error logging in:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Get merchant's contracts
 */
async function getMerchantContracts() {
  try {
    console.log('Getting merchant contracts...');
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.get(
      `${API_URL}/api/merchant/contracts`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    console.log(`Found ${response.data.contracts.length} contracts`);
    return response.data.contracts;
  } catch (error) {
    console.error('Error getting contracts:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Request cancellation for a contract
 */
async function requestContractCancellation(contractId, reason, notes = '') {
  try {
    console.log(`Requesting cancellation for contract ${contractId}...`);
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(
      `${API_URL}/api/merchant/contracts/${contractId}/request-cancellation`,
      {
        reason,
        notes
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    console.log('Cancellation request submitted successfully!');
    return response.data;
  } catch (error) {
    console.error('Error requesting cancellation:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Check cancellation requests for a contract
 */
async function getContractCancellationRequests(contractId) {
  try {
    console.log(`Getting cancellation requests for contract ${contractId}...`);
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.get(
      `${API_URL}/api/merchant/contracts/${contractId}/cancellation-requests`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    console.log(`Found ${response.data.requests.length} cancellation requests`);
    return response.data.requests;
  } catch (error) {
    console.error('Error getting cancellation requests:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    // Load any saved cookies
    loadCookies();
    
    // Login as a merchant
    await loginAsMerchant();
    
    // Get merchant's contracts
    const contracts = await getMerchantContracts();
    
    if (contracts.length === 0) {
      console.log('No contracts found for merchant. Please create a contract first.');
      return;
    }
    
    // Get the first active or pending contract
    const contract = contracts.find(c => c.status === 'active' || c.status === 'pending');
    
    if (!contract) {
      console.log('No active or pending contracts found. Need an active contract to test cancellation.');
      return;
    }
    
    console.log('Using contract for testing:', {
      id: contract.id,
      contractNumber: contract.contractNumber,
      status: contract.status
    });
    
    // Request cancellation for the contract
    const cancellationReason = 'Testing cancellation request functionality';
    const cancellationNotes = 'These are test notes for the cancellation request';
    
    await requestContractCancellation(contract.id, cancellationReason, cancellationNotes);
    
    // Check if the cancellation request was created
    const requests = await getContractCancellationRequests(contract.id);
    
    if (requests.length === 0) {
      console.log('No cancellation requests found. The request may not have been created properly.');
      return;
    }
    
    const latestRequest = requests[0];
    
    console.log('Cancellation request details:', {
      id: latestRequest.id,
      status: latestRequest.status,
      reason: latestRequest.requestReason
    });
    
    // Test result summary
    console.log('\n======= TEST RESULTS =======');
    console.log('✅ Merchant login successful');
    console.log('✅ Retrieved merchant contracts');
    console.log('✅ Submitted cancellation request');
    console.log('✅ Verified request was created');
    console.log('=============================\n');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the tests
runTests();