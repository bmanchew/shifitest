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
  const csrfMatch = cookies.match(/XSRF-TOKEN=([^;]+)/);
  if (csrfMatch && csrfMatch[1]) {
    return decodeURIComponent(csrfMatch[1]);
  }
  return null;
}

// Main test functions
async function login() {
  try {
    console.log('Logging in as test merchant...');
    
    // First, get the CSRF token
    const response = await axios.get(`${BASE_URL}/api/csrf-token`);
    const csrfToken = response.data.csrfToken;
    const cookies = response.headers['set-cookie'].join('; ');
    
    console.log(`Got CSRF token: ${csrfToken}`);
    
    // Now login
    const loginResponse = await axios.post(
      `${BASE_URL}/api/login`,
      {
        email: 'test-merchant@example.com',
        password: 'Password123!'
      },
      {
        headers: {
          'Cookie': cookies,
          'X-XSRF-TOKEN': csrfToken
        }
      }
    );
    
    if (loginResponse.headers['set-cookie']) {
      const newCookies = loginResponse.headers['set-cookie'].join('; ');
      saveCookies(newCookies);
      return { success: true, cookies: newCookies };
    } else {
      console.error('Login failed - no cookies returned');
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
    
    const csrfToken = extractCsrfToken(cookies);
    
    // Test the specific contract endpoint
    const command = `curl -s -X GET "${BASE_URL}/api/application-progress/kyc/${TEST_CONTRACT_ID}" -H "Cookie: ${cookies}" -H "X-XSRF-TOKEN: ${csrfToken}"`;
    const result = execSync(command).toString();
    
    console.log('Result:');
    console.log(JSON.stringify(JSON.parse(result), null, 2));
    
    return JSON.parse(result);
  } catch (error) {
    console.error('Application progress API error:', error);
    return null;
  }
}

async function testDocumentsEndpoint(cookies) {
  try {
    console.log(`\nTesting documents endpoint for contract ID ${TEST_CONTRACT_ID}...`);
    
    const csrfToken = extractCsrfToken(cookies);
    
    // Test the contract documents endpoint
    const command = `curl -s -X GET "${BASE_URL}/api/documents/contract/${TEST_CONTRACT_ID}" -H "Cookie: ${cookies}" -H "X-XSRF-TOKEN: ${csrfToken}"`;
    const result = execSync(command).toString();
    
    console.log('Result:');
    console.log(JSON.stringify(JSON.parse(result), null, 2));
    
    return JSON.parse(result);
  } catch (error) {
    console.error('Documents API error:', error);
    return null;
  }
}

// Run the tests
async function runTests() {
  // Try to use existing cookies first
  let cookies = loadCookies();
  let loginResult = { success: true, cookies };
  
  // If no cookies or they're expired, login again
  if (!cookies) {
    loginResult = await login();
    if (!loginResult.success) {
      console.error('Login failed, aborting tests');
      return;
    }
    cookies = loginResult.cookies;
  }
  
  console.log('Using cookies:', cookies);
  
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