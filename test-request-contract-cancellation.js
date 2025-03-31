/**
 * Test script to request a contract cancellation from the merchant side
 * 
 * This script:
 * 1. Logs in as a merchant
 * 2. Finds an active contract (or uses specified contract ID)
 * 3. Submits a cancellation request for that contract
 * 4. Provides detailed output for testing and debugging
 * 
 * Usage:
 *   node test-request-contract-cancellation.js
 *   
 * Optional environment variables:
 *   API_URL - Base URL for the API (default: http://localhost:5000/api)
 *   MERCHANT_EMAIL - Email of the merchant to log in as
 *   MERCHANT_PASSWORD - Password for the merchant account
 *   CONTRACT_ID - Specific contract ID to cancel (bypasses automatic contract selection)
 *   CANCELLATION_REASON - Custom reason for cancellation request
 *   CANCELLATION_NOTES - Custom notes for cancellation request
 *   DEBUG - Set to 'true' for verbose logging
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allow overriding API URL via environment variable
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const COOKIES_FILE = path.join(__dirname, 'cookies.txt');

// Configurable credentials
const MERCHANT_EMAIL = process.env.MERCHANT_EMAIL || 'merchant@example.com';
const MERCHANT_PASSWORD = process.env.MERCHANT_PASSWORD || 'password123';
const SPECIFIC_CONTRACT_ID = process.env.CONTRACT_ID;

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

// Get CSRF token with nonce validation
async function getCsrfToken() {
  try {
    // Generate a nonce value for additional security
    // Using crypto module imported at the top of the file
    const nonce = createHash('sha256')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex');
      
    // Cache-busting parameter helps prevent stale token issues
    const cacheBuster = new Date().getTime();
    const cookies = loadCookies();
    const config = {
      headers: {
        'Origin': 'http://localhost:5000',
        'Referer': 'http://localhost:5000/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest'  // Indicates this is an AJAX request
      },
      withCredentials: true
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
    
    console.log('Getting CSRF token with headers:', {
      'Cookie': config.headers.Cookie ? 'present' : 'none',
      'Origin': config.headers.Origin,
      'Referer': config.headers.Referer,
      'User-Agent': 'Mozilla browser (simulated)'
    });
    
    // Add nonce and cache-busting parameter to avoid cached responses
    // The API endpoint is actually /csrf-token without the /auth prefix
    const response = await axios.get(`${API_BASE_URL}/csrf-token?nonce=${nonce}&_=${cacheBuster}`, config);
    
    // Save cookies if they were set
    if (response.headers['set-cookie']) {
      saveCookies(response.headers['set-cookie']);
      console.log('Saved new cookies from CSRF token response');
    }
    
    // Verify that we got a valid token
    if (!response.data || !response.data.csrfToken) {
      throw new Error('No CSRF token returned from server');
    }
    
    console.log(`Got CSRF token: ${response.data.csrfToken.substring(0, 8)}...`);
    
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.response?.data || error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    }
    throw error;
  }
}

// Login as a merchant
async function loginAsMerchant() {
  try {
    // Clear existing cookies to avoid stale or invalid sessions
    fs.writeFileSync(COOKIES_FILE, '{}');
    console.log('Cleared existing cookies');

    // Add a small delay before getting CSRF token
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const csrfToken = await getCsrfToken();
    console.log('Got CSRF token for login:', csrfToken);
    
    // Use configurable credentials from environment variables or defaults
    const credentials = {
      email: MERCHANT_EMAIL,
      password: MERCHANT_PASSWORD
    };
    
    console.log(`Attempting login as merchant: ${credentials.email}`);
    
    // Add another short delay before login attempt to ensure token is properly registered
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Set secure headers and origin to match expected CSRF protection
    const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5000',
        'Referer': 'http://localhost:5000/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      withCredentials: true
    });
    
    // Save cookies for future requests
    if (response.headers['set-cookie']) {
      saveCookies(response.headers['set-cookie']);
      console.log('Login successful, cookies saved.');
      
      // Log the cookies we've saved (redacted for security)
      const cookies = loadCookies();
      const redactedCookies = {};
      for (const key of Object.keys(cookies)) {
        redactedCookies[key] = `${cookies[key].substring(0, 5)}...`;
      }
      console.log('Saved cookies:', JSON.stringify(redactedCookies, null, 2));
      
      // Add a short delay after login to ensure session is established
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.warn('Login successful but no cookies received from server');
    }
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.error(`Authentication failed for ${MERCHANT_EMAIL}. Please check credentials.`);
    } else if (error.response?.status === 429) {
      console.error('Rate limit exceeded. Please wait before trying again.');
    } else if (error.response?.status === 403) {
      if (error.response?.data?.message?.includes('CSRF')) {
        console.error('CSRF validation failed. This might be due to:');
        console.error('- Missing or invalid Origin/Referer headers');
        console.error('- Mismatched CSRF token');
        console.error('- Session expired between token generation and login attempt');
        console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
      } else {
        console.error('Forbidden error:', error.response?.data?.message || 'Unknown reason');
      }
    } else {
      console.error('Error logging in:', error.response?.data || error.message);
    }
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
        'X-CSRF-Token': csrfToken,
        'Origin': 'http://localhost:5000',
        'Referer': 'http://localhost:5000/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      withCredentials: true
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
    
    console.log('Requesting active contracts with headers:', {
      'X-CSRF-Token': csrfToken ? `${csrfToken.substring(0, 5)}...` : 'none',
      'Cookie': config.headers.Cookie ? 'present' : 'none',
      'Origin': config.headers.Origin,
      'Referer': config.headers.Referer,
      'User-Agent': 'Mozilla browser (simulated)'
    });
    
    // Add a short delay before making the request
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const response = await axios.get(`${API_BASE_URL}/merchant/contracts?status=active`, config);
    
    // Save any cookies that might have been set
    if (response.headers['set-cookie']) {
      saveCookies(response.headers['set-cookie']);
      console.log('Updated cookies from contracts response');
    }
    
    if (!response.data.contracts || response.data.contracts.length === 0) {
      console.log('No active contracts found');
      return [];
    }
    
    console.log(`Found ${response.data.contracts.length} active contracts`);
    
    // Log the first contract for debugging (with sensitive data redacted)
    if (response.data.contracts.length > 0) {
      const contract = response.data.contracts[0];
      console.log('First contract details:', {
        id: contract.id,
        contractNumber: contract.contractNumber,
        status: contract.status,
        createdAt: contract.createdAt,
        amount: contract.amount,
        // Redact other sensitive data
      });
    }
    
    return response.data.contracts;
  } catch (error) {
    console.error('Error getting active contracts:');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${JSON.stringify(error.response.data, null, 2)}`);
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
      
      if (error.response.status === 401) {
        console.error('Authentication failed. You might need to log in again.');
      } else if (error.response.status === 403) {
        console.error('CSRF validation failed or permission denied.');
        console.error('This might be due to:');
        console.error('- Missing or invalid Origin/Referer headers');
        console.error('- Mismatched CSRF token');
        console.error('- Session expired between token generation and request');
      }
    } else if (error.request) {
      console.error('No response received from server');
    } else {
      console.error('Error:', error.message);
    }
    
    throw error;
  }
}

// Request cancellation for a contract
async function requestContractCancellation(contractId) {
  try {
    // Get a fresh CSRF token immediately before the request
    const csrfToken = await getCsrfToken();
    console.log(`Requesting cancellation for contract ${contractId}`);
    
    let cookies = loadCookies();
    
    // If no cookies are found, try logging in again
    if (!cookies || Object.keys(cookies).length === 0) {
      console.log('No session cookies found, attempting to log in again');
      await loginAsMerchant();
      // Get cookies again after login
      cookies = loadCookies();
    }
    
    const config = {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5000',
        'Referer': 'http://localhost:5000/',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      },
      withCredentials: true  // Important for CSRF protection
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
    
    console.log('Request headers:', {
      'X-CSRF-Token': csrfToken ? `${csrfToken.substring(0, 5)}...` : 'none',
      'Cookie': config.headers.Cookie ? 'present' : 'none',
      'Origin': config.headers.Origin,
      'Referer': config.headers.Referer,
      'User-Agent': 'Mozilla browser (simulated)'
    });
    
    // Customizable cancellation reasons
    const reasons = [
      'Business circumstances have changed',
      'Financial hardship',
      'Service dissatisfaction',
      'Better offers from competitors',
      'Business closing or downsizing'
    ];
    
    // Select a reason (could be randomized or configurable via env vars)
    const selectedReason = process.env.CANCELLATION_REASON || reasons[0];
    const notes = process.env.CANCELLATION_NOTES || 
      'We need to cancel this contract due to changes in our business model and cash flow. ' +
      'Please process this request at your earliest convenience. ' +
      'We would appreciate a prompt response.';
    
    const payload = {
      reason: selectedReason,
      notes: notes
    };
    
    // Log the payload for debugging
    console.log('Submitting cancellation request with payload:', JSON.stringify(payload, null, 2));
    
    // Add a longer delay before making the request to ensure the server has processed the CSRF token
    console.log('Waiting 1 second before sending request...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Make the API request with proper endpoint
    const response = await axios.post(
      `${API_BASE_URL}/contracts/${contractId}/request-cancellation`,
      payload,
      config
    );
    
    console.log('Cancellation request submitted successfully');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Save any updated cookies from the response
    if (response.headers['set-cookie']) {
      saveCookies(response.headers['set-cookie']);
      console.log('Updated cookies from response');
    }
    
    return {
      success: true,
      requestId: response.data.id || response.data.requestId,
      status: response.data.status || 'pending',
      timestamp: response.data.createdAt || new Date().toISOString(),
      data: response.data
    };
  } catch (error) {
    console.error('Error requesting cancellation:');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${JSON.stringify(error.response.data, null, 2)}`);
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
      
      // Specific error handling
      if (error.response.status === 409) {
        console.error('A cancellation request already exists for this contract');
      } else if (error.response.status === 400) {
        console.error('Invalid request parameters (reason or notes may be missing)');
      } else if (error.response.status === 403) {
        console.error('CSRF validation failed or permission denied.');
        console.error('This might be due to:');
        console.error('- Missing or invalid Origin/Referer headers');
        console.error('- Mismatched CSRF token');
        console.error('- Session expired between token generation and request');
        
        // Try to get a new CSRF token and show its value for debugging
        try {
          console.log('Attempting to get a new CSRF token...');
          const newToken = await getCsrfToken();
          console.error('DEBUG: Able to get a new CSRF token:', newToken.substring(0, 5) + '...');
        } catch (csrfError) {
          console.error('DEBUG: Failed to get a new CSRF token:', csrfError.message);
        }
      } else if (error.response.status === 401) {
        console.error('Authentication failed. You might need to log in again.');
        console.log('Attempting to login again...');
        try {
          await loginAsMerchant();
          console.log('Login successful, you may try the request again');
        } catch (loginError) {
          console.error('Failed to login again:', loginError.message);
        }
      }
    } else if (error.request) {
      console.error('No response received from server');
    } else {
      console.error('Error:', error.message);
    }
    
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log('=== Contract Cancellation Request Test ===');
    console.log(`API URL: ${API_BASE_URL}`);
    console.log(`Merchant Email: ${MERCHANT_EMAIL}`);
    console.log(`Using specific contract ID: ${SPECIFIC_CONTRACT_ID || 'No (auto-selecting)'}`);
    
    // Clear existing cookies and login
    fs.writeFileSync(COOKIES_FILE, '{}');
    console.log('Cleared existing cookies for a fresh session');
    
    // Login
    await loginAsMerchant();
    
    // Get a fresh CSRF token after login
    const freshCsrfToken = await getCsrfToken();
    console.log('Obtained fresh CSRF token after login:', freshCsrfToken.substring(0, 5) + '...');
    
    let contractId;
    
    // Check if a specific contract ID was provided
    if (SPECIFIC_CONTRACT_ID) {
      contractId = parseInt(SPECIFIC_CONTRACT_ID, 10);
      console.log(`Using specified contract ID: ${contractId}`);
    } else {
      // Get active contracts
      const contracts = await getActiveContracts();
      
      if (contracts.length === 0) {
        console.log('No active contracts found for cancellation testing');
        return;
      }
      
      // Use the first active contract
      contractId = contracts[0].id;
      console.log(`Selected contract ID: ${contractId}`);
    }
    
    // Wait a short time to ensure the session is properly established
    console.log('Waiting briefly before submitting cancellation request...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Request cancellation for the contract
    await requestContractCancellation(contractId);
    
    console.log('\n=== Test Results ===');
    console.log('✅ Successfully submitted cancellation request');
    console.log(`Contract ID: ${contractId}`);
    console.log('Status: Pending approval by admin');
    console.log('\nNext steps:');
    console.log('1. Admin can review the request using the admin interface');
    console.log('2. Admin can approve or deny the request');
    console.log('3. Merchant will be notified of the decision');
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('\n=== Test Failed ===');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.status === 401) {
        console.error('Possible causes:');
        console.error('- Invalid merchant credentials');
        console.error('- Session expired');
        console.error('- CSRF token invalid or expired');
      } else if (error.response.status === 404) {
        console.error('Possible causes:');
        console.error('- Contract ID not found');
        console.error('- API endpoint not found');
      } else if (error.response.status === 403) {
        console.error('Possible causes:');
        console.error('- Insufficient permissions');
        console.error('- Contract belongs to a different merchant');
        console.error('- CSRF token validation failed');
        console.error('\nPlease check server logs for more details. Common issues:');
        console.error('- Mismatch between request Origin/Referer and expected values');
        console.error('- Request made too quickly after obtaining CSRF token');
        console.error('- Request cookies not properly sent or processed');
      }
    } else {
      console.error(`Error: ${error.message}`);
    }
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