/**
 * Test script for API endpoints related to application progress and documents
 * This tests the newly created dedicated API routers
 */

import axios from 'axios';
import fs from 'fs';
import { execSync } from 'child_process';

// Constants
const BASE_URL = 'http://localhost:5000/api';
const COOKIES_FILE = './brandon-cookies.txt';
const CONTRACT_ID = 186; // Contract ID with complete application progress data

/**
 * Load cookies from file if exists
 */
function loadCookies() {
  if (fs.existsSync(COOKIES_FILE)) {
    const cookieContent = fs.readFileSync(COOKIES_FILE, 'utf-8');
    return cookieContent.trim();
  }
  return null;
}

/**
 * Save cookies to file
 */
function saveCookies(cookies) {
  fs.writeFileSync(COOKIES_FILE, cookies);
  console.log('Cookies saved to', COOKIES_FILE);
}

/**
 * Extract CSRF token from cookies
 */
function extractCsrfToken(cookies) {
  if (!cookies) return null;
  
  const match = cookies.match(/XSRF-TOKEN=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Login as Brandon (merchant user)
 */
async function loginAsBrandon() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'brandon@shilohfinance.com',
      password: 'Password123!'
    }, {
      withCredentials: true
    });
    
    if (response.data.success) {
      const cookies = response.headers['set-cookie'].join('; ');
      saveCookies(cookies);
      return cookies;
    } else {
      console.error('Login failed:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Login error:', error.message);
    return null;
  }
}

/**
 * Make API request with curl to better handle cookies
 */
async function makeApiRequestWithCurl(url, cookies = null) {
  let cookiesStr = '';
  
  if (cookies) {
    // Extract the auth_token cookie
    const authTokenMatch = cookies.match(/#HttpOnly_localhost.*auth_token([^#]+)/);
    if (authTokenMatch && authTokenMatch[1]) {
      // Format the cookie correctly - extract just the value part
      const tokenValue = authTokenMatch[1].trim().split(/\s+/)[0];
      if (tokenValue) {
        cookiesStr = `-H "Cookie: auth_token=${tokenValue}"`;
      }
    }
  }
  
  try {
    const cmd = `curl -s ${cookiesStr} "${url}"`;
    console.log(`Executing: ${cmd}`);
    
    const result = execSync(cmd).toString();
    return JSON.parse(result);
  } catch (error) {
    console.error(`Curl request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test application progress endpoints
 */
async function testApplicationProgressEndpoints(cookies) {
  console.log('\n--- Testing Application Progress Endpoints ---');
  
  // Test: Get application progress for contract
  console.log(`\nGetting application progress for contract ID ${CONTRACT_ID}`);
  const progressResult = await makeApiRequestWithCurl(
    `${BASE_URL}/application-progress/kyc/${CONTRACT_ID}`,
    cookies
  );
  
  console.log('Response:', JSON.stringify(progressResult, null, 2));
  
  if (progressResult.success) {
    console.log(`✅ Successfully retrieved ${progressResult.data.length} application progress records!`);
  } else {
    console.log('❌ Failed to get application progress');
  }
  
  return progressResult;
}

/**
 * Test documents endpoints
 */
async function testDocumentsEndpoints(cookies, progressData) {
  console.log('\n--- Testing Documents Endpoints ---');
  
  // Test: Get documents for contract
  console.log(`\nGetting documents for contract ID ${CONTRACT_ID}`);
  const documentsResult = await makeApiRequestWithCurl(
    `${BASE_URL}/documents/contract/${CONTRACT_ID}`,
    cookies
  );
  
  console.log('Response:', JSON.stringify(documentsResult, null, 2));
  
  if (documentsResult.success) {
    console.log(`✅ Successfully retrieved ${documentsResult.data.length} document records!`);
    
    // If we have documents and progress data, test individual document endpoint
    if (documentsResult.data.length > 0 && progressData && progressData.data && progressData.data.length > 0) {
      const documentId = progressData.data[0].id;
      console.log(`\nGetting specific document with ID ${documentId}`);
      
      const documentResult = await makeApiRequestWithCurl(
        `${BASE_URL}/documents/${documentId}`,
        cookies
      );
      
      console.log('Document Response:', JSON.stringify(documentResult, null, 2));
      
      if (documentResult.success) {
        console.log('✅ Successfully retrieved individual document!');
      } else {
        console.log('❌ Failed to get individual document');
      }
    }
  } else {
    console.log('❌ Failed to get documents');
  }
}

/**
 * Main test function
 */
async function runTests() {
  try {
    console.log('Starting API endpoints test...');
    
    // Check if we have saved cookies or need to login
    let cookies = loadCookies();
    if (!cookies) {
      console.log('No saved cookies found, logging in...');
      cookies = await loginAsBrandon();
    } else {
      console.log('Using saved cookies from', COOKIES_FILE);
    }
    
    if (!cookies) {
      console.error('Failed to get authentication cookies. Cannot continue tests.');
      return;
    }
    
    // Test application progress endpoints
    const progressData = await testApplicationProgressEndpoints(cookies);
    
    // Test documents endpoints
    await testDocumentsEndpoints(cookies, progressData);
    
    console.log('\n--- All Tests Completed ---');
  } catch (error) {
    console.error('Error during tests:', error);
  }
}

// Run the tests
runTests();