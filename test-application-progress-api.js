/**
 * Test script for validating the application progress and documents API endpoints
 * 
 * This script tests:
 * 1. Login as a merchant
 * 2. Access the application progress endpoint 
 * 3. Access the documents endpoint
 * 
 * This helps verify the dedicated routers are working correctly
 */

import fs from 'fs';
import axios from 'axios';
import { execSync } from 'child_process';

// Configuration
const BASE_URL = 'http://localhost:5000';
const TEST_CONTRACT_ID = 186; // Use a contract ID that exists in the database
const COOKIES_FILE = './test-api-cookies.txt';

// Helper functions
function loadCookies() {
  if (fs.existsSync(COOKIES_FILE)) {
    return fs.readFileSync(COOKIES_FILE, 'utf8');
  }
  return '';
}

function saveCookies(cookieString) {
  fs.writeFileSync(COOKIES_FILE, cookieString);
  console.log('Cookies saved');
}

function extractCsrfToken(cookies) {
  // First try the standard format with XSRF-TOKEN
  const csrfMatch = cookies.match(/XSRF-TOKEN=([^;]+)/);
  if (csrfMatch && csrfMatch[1]) {
    return decodeURIComponent(csrfMatch[1]);
  }
  
  // Then try the _csrf format which might be used
  const csrfMatch2 = cookies.match(/_csrf=([^;]+)/);
  if (csrfMatch2 && csrfMatch2[1]) {
    return csrfMatch2[1];
  }
  
  // As a last resort, try to find any token in the cookies
  const csrfMatch3 = cookies.match(/csrf([^=]+)=([^;]+)/i);
  if (csrfMatch3 && csrfMatch3[2]) {
    return csrfMatch3[2];
  }
  
  return null;
}

// Main test functions
async function getCsrfToken() {
  try {
    console.log('Getting CSRF token...');
    // Get CSRF token and save the cookie
    const response = await axios.get(`${BASE_URL}/api/csrf-token`, {
      withCredentials: true
    });
    
    // Save the cookies from the CSRF token request
    if (response.headers['set-cookie']) {
      const cookies = response.headers['set-cookie'].join('; ');
      console.log('Received cookies from CSRF request:', cookies);
      saveCookies(cookies);
    }
    
    if (response.data && response.data.csrfToken) {
      console.log('Received CSRF token:', response.data.csrfToken);
      return { 
        token: response.data.csrfToken,
        cookies: response.headers['set-cookie'] || []
      };
    } else {
      console.error('Failed to get CSRF token');
      console.log('Response:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

async function login() {
  try {
    console.log('Logging in as test merchant...');
    
    // First get a CSRF token
    const csrfResult = await getCsrfToken();
    if (!csrfResult) {
      console.error('Login aborted - CSRF token is required');
      return { success: false };
    }
    
    // Login using the versioned endpoint (v1)
    const loginResponse = await axios.post(
      `${BASE_URL}/api/v1/auth/login`,
      {
        email: 'test-merchant@example.com',
        password: 'Password123!'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfResult.token,
          'Cookie': csrfResult.cookies.join('; ')
        },
        withCredentials: true
      }
    );
    
    if (loginResponse.headers['set-cookie']) {
      // Save all cookies
      const cookies = loginResponse.headers['set-cookie'].join('; ');
      console.log('Received cookies from login:', cookies);
      saveCookies(cookies);
      return { success: true, cookies };
    } else {
      console.error('Login failed - no cookies returned');
      console.log('Login response:', loginResponse.data);
      return { success: false };
    }
  } catch (error) {
    console.error('Login error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return { success: false };
  }
}

async function testApplicationProgressEndpoint(cookies) {
  try {
    console.log(`\nTesting application progress endpoint for contract ID ${TEST_CONTRACT_ID}...`);
    
    // Extract the CSRF token
    const csrfToken = extractCsrfToken(cookies);
    
    // Extract auth token cookie if present
    const authTokenCookieMatch = cookies.match(/(auth_token|token)=([^;]+)/);
    const authToken = authTokenCookieMatch ? authTokenCookieMatch[2] : '';
    
    // Create a properly formatted cookie header with both tokens
    const cookieHeader = `_csrf=${csrfToken}; auth_token=${authToken}`;
    
    // Test the specific contract endpoint with proper cookies
    const command = `curl -s -X GET "${BASE_URL}/api/v1/application-progress/kyc/${TEST_CONTRACT_ID}" -H "Cookie: ${cookieHeader}"`;
    
    console.log('Running command:', command);
    const result = execSync(command).toString();
    
    console.log('Result:', result);
    
    if (!result) {
      console.error('Empty response received');
      return null;
    }
    
    try {
      return JSON.parse(result);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', result);
      return null;
    }
  } catch (error) {
    console.error('Application progress API error:', error);
    return null;
  }
}

async function testDocumentsEndpoint(cookies) {
  try {
    console.log(`\nTesting documents endpoint for contract ID ${TEST_CONTRACT_ID}...`);
    
    // Extract the CSRF token
    const csrfToken = extractCsrfToken(cookies);
    
    // Extract auth token cookie if present
    const authTokenCookieMatch = cookies.match(/(auth_token|token)=([^;]+)/);
    const authToken = authTokenCookieMatch ? authTokenCookieMatch[2] : '';
    
    // Create a properly formatted cookie header with both tokens
    const cookieHeader = `_csrf=${csrfToken}; auth_token=${authToken}`;
    
    // Test the contract documents endpoint with proper cookies
    const command = `curl -s -X GET "${BASE_URL}/api/v1/documents/contract/${TEST_CONTRACT_ID}" -H "Cookie: ${cookieHeader}"`;
    
    console.log('Running command:', command);
    const result = execSync(command).toString();
    
    console.log('Result:', result);
    
    if (!result) {
      console.error('Empty response received');
      return null;
    }
    
    try {
      return JSON.parse(result);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', result);
      return null;
    }
  } catch (error) {
    console.error('Documents API error:', error);
    return null;
  }
}

// Run the tests
async function runTests() {
  // Force fresh login to get new cookies
  console.log('Forcing new login to get fresh authentication tokens...');
  fs.existsSync(COOKIES_FILE) && fs.unlinkSync(COOKIES_FILE);
  
  // Login to get fresh cookies
  const loginResult = await login();
  if (!loginResult.success) {
    console.error('Login failed, aborting tests');
    return;
  }
  const cookies = loginResult.cookies;
  
  console.log('Using fresh cookies from login:', cookies);
  
  // Test the application progress endpoint
  const progressResult = await testApplicationProgressEndpoint(cookies);
  
  // Test the documents endpoint
  const documentsResult = await testDocumentsEndpoint(cookies);
  
  console.log('\nTests completed!');
  console.log(`Application Progress API: ${progressResult && progressResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Documents API: ${documentsResult && documentsResult.success ? 'SUCCESS' : 'FAILED'}`);
}

// Run the tests
runTests().catch(console.error);