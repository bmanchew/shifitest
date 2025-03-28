/**
 * Test script for login route diagnostics
 * 
 * This script tests the login routes to determine 
 * why the login page is returning a 404 error
 * 
 * Enhanced with CSRF token handling to properly test auth endpoints
 */
import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:5000'; // Adjust if using a different port

// Global storage for CSRF token and cookies
let csrfToken = null;
let cookies = null;
const AUTH_ENDPOINTS = [
  '/api/auth/login',
  '/api/v1/auth/login',
  '/auth/login', 
  '/api/auth',
  '/api/v1/auth'
];

/**
 * Fetch CSRF token from the server
 * @returns {Promise<string>} - CSRF token
 */
async function fetchCsrfToken() {
  try {
    console.log('Fetching CSRF token...');
    
    const response = await fetch(`${BASE_URL}/api/csrf-token`, {
      method: 'GET',
      headers: {
        'User-Agent': 'LoginRouteDiagnostics/1.0'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
    }
    
    // Save cookies for future requests
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      cookies = setCookieHeader;
      console.log('  ✓ Received cookies from server');
    }
    
    const data = await response.json();
    
    if (data && data.csrfToken) {
      csrfToken = data.csrfToken;
      console.log('  ✓ CSRF token retrieved successfully');
      return csrfToken;
    } else {
      throw new Error('CSRF token not found in response');
    }
  } catch (error) {
    console.error('  ✗ Failed to fetch CSRF token:', error.message);
    return null;
  }
}

/**
 * Test if an endpoint is available
 * @param {string} url - URL to test
 * @param {string} method - HTTP method to use
 * @param {boolean} withCsrf - Whether to include CSRF token
 * @returns {Promise<object>} - Result of the test
 */
async function testEndpoint(url, method = 'GET', withCsrf = false) {
  try {
    // For POST requests that need CSRF, get token first if not already fetched
    if (withCsrf && method === 'POST' && !csrfToken) {
      await fetchCsrfToken();
    }
    
    console.log(`Testing ${method} ${url}${withCsrf ? ' (with CSRF token)' : ''}...`);
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'LoginRouteDiagnostics/1.0'
    };
    
    // Add CSRF token if requested and available
    if (withCsrf && csrfToken) {
      headers['CSRF-Token'] = csrfToken;
    }
    
    // Add cookies if available
    if (cookies) {
      headers['Cookie'] = cookies;
    }
    
    const response = await fetch(url, { 
      method,
      headers,
      credentials: 'include',
      body: method !== 'GET' ? JSON.stringify({}) : undefined
    });
    
    // Update cookies if provided
    const newCookies = response.headers.get('set-cookie');
    if (newCookies) {
      cookies = newCookies;
    }
    
    const status = response.status;
    let body;
    
    try {
      body = await response.json();
    } catch (e) {
      body = await response.text();
    }
    
    return {
      url,
      method,
      status,
      body,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      withCsrf
    };
  } catch (error) {
    return {
      url,
      method,
      error: error.message,
      ok: false,
      withCsrf
    };
  }
}

/**
 * Test all auth endpoints
 */
async function testAllAuthEndpoints() {
  console.log('Starting login route diagnostics...');
  console.log('====================================');
  
  // First, get a CSRF token
  await fetchCsrfToken();
  
  // Test all endpoints with both GET and POST methods
  const results = [];
  
  for (const endpoint of AUTH_ENDPOINTS) {
    const url = `${BASE_URL}${endpoint}`;
    
    // Test with GET
    results.push(await testEndpoint(url, 'GET'));
    
    // Test with POST (without CSRF token)
    results.push(await testEndpoint(url, 'POST'));
    
    // Test with POST (with CSRF token)
    results.push(await testEndpoint(url, 'POST', true));
  }
  
  console.log('\nDiagnostic Results:');
  console.log('==================');
  
  // Group results by status code
  const byStatus = {};
  
  for (const result of results) {
    const statusKey = result.status || 'error';
    if (!byStatus[statusKey]) {
      byStatus[statusKey] = [];
    }
    byStatus[statusKey].push(result);
  }
  
  // Report by status code
  for (const [status, endpoints] of Object.entries(byStatus)) {
    console.log(`\nStatus ${status}:`);
    console.log('-----------------');
    
    for (const endpoint of endpoints) {
      console.log(`${endpoint.method} ${endpoint.url}`);
      if (endpoint.error) {
        console.log(`  Error: ${endpoint.error}`);
      } else {
        console.log(`  Content-Type: ${endpoint.contentType || 'unknown'}`);
        if (typeof endpoint.body === 'string') {
          console.log(`  Body: ${endpoint.body.substring(0, 100)}${endpoint.body.length > 100 ? '...' : ''}`);
        } else {
          console.log(`  Body: ${JSON.stringify(endpoint.body, null, 2)}`);
        }
      }
    }
  }
  
  console.log('\nLogin Route Analysis:');
  console.log('====================');
  
  // Check specifically for the login route
  const loginEndpoints = results.filter(r => r.url.includes('/login'));
  
  // Separate endpoints by CSRF status
  const workingLoginEndpoints = loginEndpoints.filter(r => r.status < 400);
  const csrfProtectedEndpoints = loginEndpoints.filter(r => r.status === 403 && r.body?.message?.includes('CSRF'));
  const authenticatedEndpoints = results.filter(r => r.withCsrf && r.status !== 403);
  
  if (workingLoginEndpoints.length > 0) {
    console.log('✓ Working login endpoints found:');
    workingLoginEndpoints.forEach(e => {
      console.log(`  ${e.method} ${e.url} (${e.status})${e.withCsrf ? ' with CSRF token' : ''}`);
    });
  } else if (csrfProtectedEndpoints.length > 0 && authenticatedEndpoints.length > 0) {
    console.log('⚠ Login endpoints are protected by CSRF:');
    csrfProtectedEndpoints.forEach(e => {
      console.log(`  ${e.method} ${e.url} (${e.status}) - CSRF protection enabled`);
    });
    console.log('\nThis indicates the routes exist but require proper CSRF token handling.');
    authenticatedEndpoints.forEach(e => {
      console.log(`  ${e.method} ${e.url} (${e.status}) - Accessible with CSRF token`);
    });
  } else {
    console.log('✗ No working login endpoints found!');
    console.log('Possible solutions:');
    console.log('1. Check the auth router is properly registered at /api/auth');
    console.log('2. Ensure the login route handler is defined in the auth router');
    console.log('3. Verify middleware is not blocking requests to the login endpoint');
    
    // CSRF token diagnostics
    if (csrfToken) {
      console.log('\nCSRF diagnostics:');
      console.log(`  ✓ CSRF token obtained: ${csrfToken.substring(0, 10)}...`);
      console.log('  ✓ Cookie set correctly');
    } else {
      console.log('\nCSRF token issues:');
      console.log('  ✗ Failed to obtain CSRF token');
      console.log('  ℹ Check the /api/csrf-token endpoint is working');
    }
  }
}

// Run the tests
testAllAuthEndpoints().catch(error => {
  console.error('Diagnostics failed:', error);
});