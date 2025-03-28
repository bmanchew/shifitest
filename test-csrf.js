/**
 * This script tests the CSRF token endpoint and verifies proper CSRF token handling
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5001'; // Update port if needed

async function testCSRF() {
  try {
    console.log('Testing CSRF token endpoint...');
    
    // 1. Get a CSRF token
    const tokenResponse = await fetch(`${BASE_URL}/api/csrf-token`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Failed to get CSRF token: ${tokenResponse.status} ${tokenResponse.statusText}`);
    }
    
    const tokenData = await tokenResponse.json();
    console.log('CSRF Token response:', tokenData);
    
    if (!tokenData.success || !tokenData.csrfToken) {
      throw new Error('Invalid CSRF token response format');
    }
    
    const csrfToken = tokenData.csrfToken;
    console.log(`Obtained CSRF token: ${csrfToken}`);
    
    // Get cookies from the response
    const cookies = tokenResponse.headers.get('set-cookie');
    console.log('Set-Cookie header:', cookies);
    
    // 2. Test making a request with the CSRF token
    console.log('Testing protected endpoint with CSRF token...');
    const testResponse = await fetch(`${BASE_URL}/api/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'CSRF-Token': csrfToken,
        'X-CSRF-Token': csrfToken // Include both header formats for compatibility
      },
      body: JSON.stringify({ message: 'test' })
    });
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      throw new Error(`Protected request failed: ${testResponse.status} ${testResponse.statusText}\n${errorText}`);
    }
    
    const testData = await testResponse.json();
    console.log('Protected endpoint response:', testData);
    
    console.log('CSRF token test completed successfully!');
  } catch (error) {
    console.error('CSRF test error:', error);
  }
}

// Run the test
testCSRF();