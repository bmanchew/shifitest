/**
 * Standalone script to test CSRF token functionality in the client
 * 
 * This implements a similar approach to our client React code but for Node.js,
 * allowing us to manually verify that CSRF tokens are working as expected.
 */

import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:5001'; // Use the actual port where the server is running
const MAX_RETRIES = 3;
const RETRY_DELAY = 500; // ms

// Store the token in memory
let csrfToken = null;
let tokenFetchTime = null;
const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// Test endpoints to verify
const TEST_ENDPOINTS = [
  { 
    method: 'POST', 
    url: '/api/ping', 
    data: { message: 'test' }, 
    description: 'Basic ping endpoint' 
  },
  { 
    method: 'POST', 
    url: '/api/auth/login', 
    data: { email: 'test@example.com', password: 'password123' }, 
    description: 'Auth login endpoint (should not need CSRF)' 
  }
];

/**
 * Check if the token has expired and needs to be refreshed
 */
function isTokenExpired() {
  if (!tokenFetchTime) return true;
  
  const now = Date.now();
  const elapsed = now - tokenFetchTime;
  return elapsed > TOKEN_EXPIRY_MS;
}

/**
 * Fetch a CSRF token from the server with retry logic
 */
async function fetchCsrfToken(attempt = 1) {
  console.log(`Attempting to fetch CSRF token (attempt ${attempt}/${MAX_RETRIES})...`);
  
  try {
    // Add a random query parameter to prevent caching
    const cacheBuster = `_=${Date.now()}`;
    const response = await fetch(`${BASE_URL}/api/csrf-token?${cacheBuster}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      if (attempt < MAX_RETRIES) {
        console.warn(`Failed to fetch CSRF token (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
        
        // Exponential backoff
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return fetchCsrfToken(attempt + 1);
      }
      
      throw new Error(`Failed to fetch CSRF token after ${MAX_RETRIES} attempts: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.csrfToken) {
      throw new Error('Invalid CSRF token response format');
    }
    
    // Store the token and when we fetched it
    csrfToken = data.csrfToken;
    tokenFetchTime = Date.now();
    
    // Show token preview for debugging
    const tokenPreview = csrfToken.length > 8 ? 
      `${csrfToken.substring(0, 8)}...` : 
      '[token too short]';
    console.log(`Successfully obtained CSRF token: ${tokenPreview}`);
    
    // Also print the set-cookie header if present
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      console.log('Set-Cookie header:', cookies);
    } else {
      console.warn('No Set-Cookie header found in response.');
    }
    
    return csrfToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
}

/**
 * Make a request to a test endpoint with CSRF protection
 */
async function testEndpoint(endpoint, attempt = 1) {
  const { method, url, data, description } = endpoint;
  console.log(`\nTesting ${description}: ${method} ${url}`);
  
  // Get a CSRF token if needed
  if (!csrfToken || isTokenExpired()) {
    await fetchCsrfToken();
  }
  
  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // For non-login endpoints, add CSRF token
  if (!url.startsWith('/api/auth/login')) {
    headers['CSRF-Token'] = csrfToken;
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  try {
    // Make the request
    const response = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    });
    
    console.log(`Response status: ${response.status}`);
    
    // Handle CSRF errors specifically
    if (response.status === 403) {
      const responseText = await response.text();
      
      // Check if it's a CSRF token error
      if (responseText.includes('CSRF') && attempt <= MAX_RETRIES) {
        console.warn(`CSRF token error detected, refreshing token and retrying...`);
        
        // Clear the token and fetch a new one
        csrfToken = null;
        tokenFetchTime = null;
        await fetchCsrfToken();
        
        // Wait before retrying
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        return testEndpoint(endpoint, attempt + 1);
      }
      
      console.error(`Request forbidden: ${responseText}`);
      return false;
    }
    
    // For successful responses
    if (response.ok) {
      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
        console.log('Response data:', JSON.stringify(responseData, null, 2));
      } else {
        responseData = await response.text();
        console.log('Response text:', responseData);
      }
      
      console.log(`✅ ${description} test passed!`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ Request failed: ${response.status} ${response.statusText}`);
      console.error('Error details:', errorText);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing endpoint:`, error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting CSRF token tests...');
  
  // First fetch a token directly
  try {
    await fetchCsrfToken();
    console.log('Initial token fetch successful!');
  } catch (error) {
    console.error('Failed to fetch initial token:', error);
    return;
  }
  
  // Then test each endpoint
  let successCount = 0;
  for (const endpoint of TEST_ENDPOINTS) {
    const success = await testEndpoint(endpoint);
    if (success) successCount++;
  }
  
  // Report results
  console.log(`\nTest results: ${successCount}/${TEST_ENDPOINTS.length} endpoints passed`);
}

// Run the tests
runTests().catch(error => {
  console.error('Tests failed with error:', error);
});