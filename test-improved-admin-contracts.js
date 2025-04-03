/**
 * Improved test script for the contracts API endpoints using admin credentials
 * With better session handling
 */

import fs from 'fs';
import axios from 'axios';

// Admin credentials
const ADMIN_EMAIL = 'admin@shifi.com';
const ADMIN_PASSWORD = 'admin123';

// Base URL for API requests
const API_BASE_URL = 'http://localhost:5000/api';

// Create an axios instance with cookie support
const api = axios.create({ 
  withCredentials: true
});

// Store cookies
let cookies = [];

// Save cookies to a file
function saveCookies(response) {
  if (response && response.headers && response.headers['set-cookie']) {
    cookies = response.headers['set-cookie'];
    fs.writeFileSync('admin-cookies.txt', cookies.join('\n'));
    console.log('Cookies saved to admin-cookies.txt');
  }
}

// Load cookies from file
function loadCookies() {
  try {
    if (fs.existsSync('admin-cookies.txt')) {
      cookies = fs.readFileSync('admin-cookies.txt', 'utf8').split('\n');
      console.log('Cookies loaded from admin-cookies.txt');
      
      // Set up axios to use cookies
      api.defaults.headers.Cookie = cookies.join('; ');
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
    const response = await api.get(`${API_BASE_URL}/csrf-token`);
    
    saveCookies(response);
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Login as admin
async function loginAsAdmin() {
  // Get a CSRF token for login
  const csrfToken = await getCsrfToken();
  if (!csrfToken) {
    console.error('Failed to get CSRF token');
    return false;
  }
  
  console.log('Logging in as admin...');
  try {
    const response = await api.post(`${API_BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      userType: 'admin'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken
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

// Test contracts endpoint as admin
async function testContracts() {
  console.log('\nTesting contracts endpoint as admin...');
  
  try {
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      console.error('Failed to get CSRF token');
      return;
    }
    
    // Get all contracts (admin can see all)
    console.log('Getting all contracts as admin...');
    const contractsResponse = await api.get(`${API_BASE_URL}/contracts?admin=true`, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    console.log(`Retrieved ${contractsResponse.data.contracts.length} contracts`);
    
    // Test a specific contract by ID
    if (contractsResponse.data.contracts.length > 0) {
      const contractId = contractsResponse.data.contracts[0].id;
      console.log(`\nTesting specific contract endpoint for ID: ${contractId}`);
      
      const contractResponse = await api.get(`${API_BASE_URL}/contracts/${contractId}`, {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      });
      
      console.log('Contract details:', JSON.stringify(contractResponse.data.contract, null, 2));
      
      // Test underwriting data endpoint
      console.log(`\nTesting underwriting data endpoint for contract ID: ${contractId}`);
      const underwritingResponse = await api.get(`${API_BASE_URL}/contracts/${contractId}/underwriting`, {
        headers: {
          'X-CSRF-Token': csrfToken
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
  console.log('Starting contract API test as admin...\n');
  
  // Load existing cookies if available
  loadCookies();
  
  // Login as admin
  const loggedIn = await loginAsAdmin();
  
  if (loggedIn) {
    await testContracts();
  } else {
    console.error('Admin login failed. Cannot proceed with tests.');
  }
}

// Run the tests
main()
  .then(() => console.log('\nTest completed'))
  .catch(error => console.error('Test failed:', error));