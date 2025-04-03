import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base URL for API requests
const API_URL = 'http://localhost:5000';

// File to store cookies
const COOKIES_FILE = path.join(__dirname, 'test-merchant-cookies.txt');

// Store cookies between requests
let cookies = [];

// Function to save cookies to file
function saveCookies() {
  fs.writeFileSync(COOKIES_FILE, cookies.join('\n'));
  console.log('Cookies saved to file:', cookies);
}

// Function to load cookies from file if it exists
function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookieContent = fs.readFileSync(COOKIES_FILE, 'utf8');
      // Split by newline, then filter out empty lines and extract cookie name=value part
      cookies = cookieContent.split('\n')
        .filter(line => line.trim() !== '')
        .map(cookie => {
          // Extract just the name=value part, ignoring Path, Expires, etc.
          const mainPart = cookie.split(';')[0].trim();
          return mainPart;
        });
      console.log('Cookies loaded from file');
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
}

// Function to get CSRF token
async function getCsrfToken() {
  try {
    console.log('Getting CSRF token...');
    
    const headers = {};
    if (cookies.length) {
      headers.Cookie = cookies.join('; ');
    }
    
    const response = await axios.get(
      `${API_URL}/api/csrf-token`,
      { headers }
    );
    
    if (response.data && response.data.csrfToken) {
      console.log('Got CSRF token');
      
      // Get cookies from response and update cookies array
      if (response.headers['set-cookie']) {
        cookies = response.headers['set-cookie'].map(cookie => cookie.split(';')[0]);
        saveCookies();
      }
      
      return response.data.csrfToken;
    } else {
      throw new Error('Failed to get CSRF token');
    }
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Function to login as merchant (Shiloh Finance)
async function loginAsMerchant() {
  try {
    // Load cookies first in case we already have a valid session
    loadCookies();
    
    // First, get a CSRF token
    const csrfToken = await getCsrfToken();
    
    // Define login credentials for Test Finance merchant
    const credentials = {
      email: 'test@shilohfinance.com',  // Test merchant email
      password: 'testPassword123'       // Known test password
    };
    
    console.log('Logging in as merchant...');
    
    // Create headers object
    const headers = {
      'X-CSRF-Token': csrfToken
    };
    
    // Only add cookies if we have them
    if (cookies.length) {
      headers.Cookie = cookies.join('; ');
    }
    
    // Make login request
    const response = await axios.post(
      `${API_URL}/api/auth/login`,
      credentials,
      { headers }
    );
    
    // Update cookies
    if (response.headers['set-cookie']) {
      // Properly handle all cookies from login response
      const newCookies = response.headers['set-cookie'].map(cookie => cookie.split(';')[0]);
      console.log('Login response cookies:', newCookies);
      
      // Merge with existing cookies or replace if same cookie name
      const cookieMap = {};
      
      // First add existing cookies to the map
      cookies.forEach(cookie => {
        const parts = cookie.split('=');
        if (parts.length >= 1) {
          cookieMap[parts[0]] = cookie;
        }
      });
      
      // Then add or replace with new cookies
      newCookies.forEach(cookie => {
        const parts = cookie.split('=');
        if (parts.length >= 1) {
          cookieMap[parts[0]] = cookie;
        }
      });
      
      // Convert back to array
      cookies = Object.values(cookieMap);
      console.log('All cookies after login:', cookies);
      saveCookies();
    }
    
    console.log('Logged in successfully as merchant');
    return response.data;
  } catch (error) {
    console.error('Error logging in as merchant:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Function to get merchant contracts
async function getMerchantContracts(merchantId = 63) {
  try {
    console.log(`Getting contracts for merchant ID ${merchantId}...`);
    
    const csrfToken = await getCsrfToken();
    
    // Create headers object
    const headers = {
      'X-CSRF-Token': csrfToken
    };
    
    // Only add cookies if we have them
    if (cookies.length) {
      headers.Cookie = cookies.join('; ');
    }
    
    const response = await axios.get(
      `${API_URL}/api/contracts?merchantId=${merchantId}`,
      { headers }
    );
    
    console.log(`Got ${response.data.contracts?.length || 0} contracts`);
    return response.data;
  } catch (error) {
    console.error('Error getting merchant contracts:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Get specific contract details
async function getContractDetails(contractId) {
  try {
    console.log(`Getting details for contract ID ${contractId}...`);
    
    const csrfToken = await getCsrfToken();
    
    // Create headers object
    const headers = {
      'X-CSRF-Token': csrfToken
    };
    
    // Only add cookies if we have them
    if (cookies.length) {
      headers.Cookie = cookies.join('; ');
    }
    
    const response = await axios.get(
      `${API_URL}/api/contracts/${contractId}`,
      { headers }
    );
    
    console.log('Got contract details');
    return response.data;
  } catch (error) {
    console.error('Error getting contract details:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Main function to run the script
async function main() {
  try {
    // Log in as merchant
    await loginAsMerchant();
    
    // Get merchant contracts
    const contractsResponse = await getMerchantContracts();
    console.log('Contracts response:', JSON.stringify(contractsResponse, null, 2));
    
    // If we have any contracts, get details for the first one
    if (contractsResponse.contracts && contractsResponse.contracts.length > 0) {
      const firstContractId = contractsResponse.contracts[0].id;
      const contractDetails = await getContractDetails(firstContractId);
      console.log('Contract details:', JSON.stringify(contractDetails, null, 2));
    }
    
    console.log('Script completed successfully');
  } catch (error) {
    console.error('Error in main function:', error.message);
  }
}

// Run the script as an IIFE (Immediately Invoked Function Expression)
(async () => {
  await main();
})();