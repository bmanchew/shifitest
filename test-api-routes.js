/**
 * Comprehensive API route testing script
 * This script tests the application progress and document endpoints
 * to verify they're working properly with authentication
 */

import axios from 'axios';
import fs from 'fs';
import { execSync } from 'child_process';

// Color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper to load cookies from a file
function loadCookies(filename = './brandon-cookies.txt') {
  try {
    if (fs.existsSync(filename)) {
      return fs.readFileSync(filename, 'utf8');
    }
    return '';
  } catch (e) {
    console.error('Error loading cookies:', e);
    return '';
  }
}

// Helper to extract csrf token
function extractCsrfToken(cookies) {
  const match = cookies.match(/XSRF-TOKEN=([^;]+)/);
  return match ? match[1] : null;
}

// Log in as Brandon to get cookies
async function loginAsBrandon() {
  console.log(`${colors.blue}Logging in as Brandon to get authentication cookies...${colors.reset}`);
  
  try {
    // Get CSRF token first
    const csrfResponse = await axios.get('http://localhost:5000/api/csrf-token');
    const csrfCookie = csrfResponse.headers['set-cookie'][0];
    const csrfToken = extractCsrfToken(csrfCookie);
    
    if (!csrfToken) {
      throw new Error('Could not extract CSRF token');
    }
    
    // Now login with the token
    const loginResponse = await axios.post(
      'http://localhost:5000/api/auth/login',
      {
        email: 'brandon@shilohfinance.com',
        password: 'Password123!'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': csrfCookie,
          'X-CSRF-Token': csrfToken
        }
      }
    );
    
    // Extract all cookies
    const cookies = loginResponse.headers['set-cookie'];
    if (!cookies || cookies.length === 0) {
      throw new Error('No cookies received from login');
    }
    
    // Save cookies to file
    fs.writeFileSync('./brandon-cookies.txt', cookies.join('; '));
    
    console.log(`${colors.green}Login successful. Cookies saved to brandon-cookies.txt${colors.reset}`);
    return cookies.join('; ');
  } catch (error) {
    console.error(`${colors.red}Login error:${colors.reset}`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Make API request with complete cookie handling
async function makeApiRequest(url, method = 'GET', cookies = null) {
  try {
    // Load cookies if none provided
    const cookieHeader = cookies || loadCookies();
    
    // Extract CSRF token from cookies
    const csrfToken = extractCsrfToken(cookieHeader);
    
    console.log(`${colors.dim}Making ${method} request to ${url}${colors.reset}`);
    
    const response = await axios({
      method,
      url,
      headers: {
        'Cookie': cookieHeader,
        'X-CSRF-Token': csrfToken
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`${colors.red}Error making request to ${url}:${colors.reset}`, error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response data:', error.response.data);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
    }
    return { error: error.message, status: error.response?.status };
  }
}

// Make API request with curl as a fallback
async function makeApiRequestWithCurl(url, cookies = null) {
  try {
    // Load cookies if none provided
    const cookieFile = './brandon-cookies.txt';
    
    console.log(`${colors.dim}Making curl request to ${url}${colors.reset}`);
    
    const command = `curl -X GET "${url}" -b ${cookieFile} -v`;
    console.log(`Executing: ${command}`);
    
    const result = execSync(command).toString();
    
    try {
      return JSON.parse(result);
    } catch (e) {
      console.log(`${colors.yellow}Could not parse response as JSON:${colors.reset}`);
      console.log(result.substring(0, 500) + '...');
      return { rawResponse: result };
    }
  } catch (error) {
    console.error(`${colors.red}Error making curl request to ${url}:${colors.reset}`, error.message);
    return { error: error.message };
  }
}

// Test both API and direct endpoints with retry logic
async function testEndpoints() {
  // Login first to get cookies
  let cookies;
  try {
    cookies = await loginAsBrandon();
  } catch (e) {
    console.error(`${colors.red}Login failed, proceeding with existing cookies if available${colors.reset}`);
  }
  
  const contractId = 186; // Test contract with known data
  
  console.log(`\n${colors.bright}${colors.blue}===== Testing Application Progress Endpoint =====${colors.reset}`);
  console.log(`${colors.blue}Testing regular API endpoint:${colors.reset}`);
  const progressData = await makeApiRequest(`http://localhost:5000/api/application-progress?contractId=${contractId}`, 'GET', cookies);
  console.log('Progress data:', JSON.stringify(progressData, null, 2));
  
  if (!progressData || progressData.error) {
    console.log(`\n${colors.yellow}API request failed, trying with curl:${colors.reset}`);
    const progressDataCurl = await makeApiRequestWithCurl(`http://localhost:5000/api/application-progress?contractId=${contractId}`);
    console.log('Progress data (curl):', JSON.stringify(progressDataCurl, null, 2));
  }
  
  console.log(`\n${colors.bright}${colors.blue}===== Testing Contract Document Endpoint =====${colors.reset}`);
  console.log(`${colors.blue}Testing regular API endpoint:${colors.reset}`);
  const documentData = await makeApiRequest(`http://localhost:5000/api/contracts/${contractId}/document`, 'GET', cookies);
  console.log('Document data:', JSON.stringify(documentData, null, 2));
  
  if (!documentData || documentData.error) {
    console.log(`\n${colors.yellow}API request failed, trying with curl:${colors.reset}`);
    const documentDataCurl = await makeApiRequestWithCurl(`http://localhost:5000/api/contracts/${contractId}/document`);
    console.log('Document data (curl):', JSON.stringify(documentDataCurl, null, 2));
  }
}

// Run the tests
console.log(`${colors.bright}${colors.blue}Starting API endpoint testing script${colors.reset}`);
testEndpoints().catch(console.error);