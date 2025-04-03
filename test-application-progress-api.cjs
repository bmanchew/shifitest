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

const fs = require('fs');
const axios = require('axios');
const { execSync } = require('child_process');

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
    console.log('Logging in as brandon (merchant user)...');
    
    // Use the curl command which might be more reliable for handling cookies
    const loginCommand = `curl -s -c ${COOKIES_FILE} -X POST ${BASE_URL}/api/login -H "Content-Type: application/json" -d '{"email":"brandon@shilohfinance.com","password":"Password123!"}'`;
    
    console.log('Executing login command...');
    const loginResult = execSync(loginCommand).toString();
    console.log('Login response:', loginResult);
    
    // Now get a CSRF token for subsequent requests
    const csrfCommand = `curl -s -b ${COOKIES_FILE} -c ${COOKIES_FILE} ${BASE_URL}/api/csrf-token`;
    const csrfResult = execSync(csrfCommand).toString();
    console.log('CSRF response:', csrfResult);
    
    // Read the cookies file
    const cookies = loadCookies();
    
    if (cookies) {
      return { success: true, cookies };
    } else {
      console.error('Login failed - no cookies saved');
      return { success: false };
    }
  } catch (error) {
    console.error('Login error:', error);
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