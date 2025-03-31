/**
 * Test script to request a contract cancellation from the merchant side
 * 
 * This script:
 * 1. Logs in as a merchant
 * 2. Finds an active contract
 * 3. Submits a cancellation request for that contract
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = 'http://localhost:5000/api';
const COOKIES_FILE = path.join(__dirname, 'cookies.txt');

// Use local cookies for authentication if available
function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookieContent = fs.readFileSync(COOKIES_FILE, 'utf8');
      try {
        // Try to parse as JSON (new format)
        return JSON.parse(cookieContent);
      } catch (jsonError) {
        // Fall back to string format (old format)
        // Process cookie string to extract individual cookies
        const cookieParts = cookieContent.split(';').filter(Boolean);
        const cookieObj = {};
        
        // Extract key-value pairs
        for (const part of cookieParts) {
          const [key, value] = part.trim().split('=');
          if (key && value) {
            cookieObj[key.trim()] = value.trim();
          }
        }
        
        return cookieObj;
      }
    }
  } catch (error) {
    console.error('Error reading cookies file:', error);
  }
  return {};
}

// Save cookies for future requests
function saveCookies(cookies) {
  if (cookies) {
    // Parse cookies into an object for easier handling
    const cookieObj = {};
    cookies.forEach(cookie => {
      const parts = cookie.split(';')[0].split('=');
      if (parts.length === 2) {
        cookieObj[parts[0].trim()] = parts[1].trim();
      }
    });
    
    // Save cookies as JSON
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookieObj));
  }
}

// Get CSRF token
async function getCsrfToken() {
  try {
    const cookies = loadCookies();
    const config = {
      headers: {}
    };
    
    // Only add Cookie header if we have cookies
    if (cookies && Object.keys(cookies).length > 0) {
      // Convert cookie object to string
      const cookieStr = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      if (cookieStr) {
        config.headers.Cookie = cookieStr;
      }
    }
    
    const response = await axios.get(`${API_BASE_URL}/csrf-token`, config);
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.response?.data || error.message);
    throw error;
  }
}

// Login as a merchant
async function loginAsMerchant() {
  try {
    const csrfToken = await getCsrfToken();
    console.log('Got CSRF token for login:', csrfToken);
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'merchant@example.com', // Adjust to a valid merchant email
      password: 'password123'       // Adjust to the correct password
    }, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    // Save cookies for future requests
    if (response.headers['set-cookie']) {
      saveCookies(response.headers['set-cookie']);
      console.log('Login successful, cookies saved.');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error logging in:', error.response?.data || error.message);
    throw error;
  }
}

// Get active contracts for the merchant
async function getActiveContracts() {
  try {
    const csrfToken = await getCsrfToken();
    const cookies = loadCookies();
    const config = {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    };
    
    // Only add Cookie header if we have cookies
    if (cookies && Object.keys(cookies).length > 0) {
      // Convert cookie object to string
      const cookieStr = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      if (cookieStr) {
        config.headers.Cookie = cookieStr;
      }
    }
    
    const response = await axios.get(`${API_BASE_URL}/merchant/contracts?status=active`, config);
    
    if (!response.data.contracts || response.data.contracts.length === 0) {
      console.error('No active contracts found');
      return [];
    }
    
    console.log(`Found ${response.data.contracts.length} active contracts`);
    return response.data.contracts;
  } catch (error) {
    console.error('Error getting active contracts:', error.response?.data || error.message);
    throw error;
  }
}

// Request cancellation for a contract
async function requestContractCancellation(contractId) {
  try {
    const csrfToken = await getCsrfToken();
    console.log(`Requesting cancellation for contract ${contractId}`);
    
    const cookies = loadCookies();
    const config = {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      }
    };
    
    // Only add Cookie header if we have cookies
    if (cookies && Object.keys(cookies).length > 0) {
      // Convert cookie object to string
      const cookieStr = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      if (cookieStr) {
        config.headers.Cookie = cookieStr;
      }
    }
    
    const payload = {
      reason: 'Business circumstances have changed',
      notes: 'We need to cancel this contract due to changes in our business model and cash flow.'
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/contracts/${contractId}/request-cancellation`,
      payload,
      config
    );
    
    console.log('Cancellation request submitted:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error requesting cancellation:', error.response?.data || error.message);
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Login
    await loginAsMerchant();
    
    // Get active contracts
    const contracts = await getActiveContracts();
    
    if (contracts.length === 0) {
      console.log('No active contracts found for cancellation testing');
      return;
    }
    
    // Request cancellation for the first active contract
    const contractId = contracts[0].id;
    await requestContractCancellation(contractId);
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the main function when this script is executed directly 
main();

// Export functions for use in other modules
export {
  requestContractCancellation,
  getActiveContracts,
  loginAsMerchant
};