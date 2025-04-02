/**
 * Simple test script to verify the /api/merchants/current endpoint works
 * This script uses fetch API for simpler cookie handling
 */

import fetch from 'node-fetch';

async function main() {
  try {
    // Step 1: Get CSRF token
    console.log('Fetching CSRF token...');
    const csrfResponse = await fetch('http://localhost:5000/api/csrf-token', {
      credentials: 'include'
    });
    
    if (!csrfResponse.ok) {
      throw new Error(`Failed to get CSRF token: ${csrfResponse.status} ${csrfResponse.statusText}`);
    }
    
    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.csrfToken;
    console.log('CSRF token retrieved:', csrfToken);
    
    // Extract cookies to reuse
    const cookies = csrfResponse.headers.get('set-cookie');
    
    // Step 2: Login as merchant
    console.log('\nLogging in as merchant...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Cookie': cookies
      },
      body: JSON.stringify({
        email: 'brandon@shilohfinance.com',
        password: 'Password123!'
      }),
      credentials: 'include'
    });
    
    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}\n${errorText}`);
    }
    
    const loginData = await loginResponse.json();
    console.log('Login successful:', loginData);
    
    // Get updated cookies
    const updatedCookies = loginResponse.headers.get('set-cookie') || cookies;
    
    // Step 3: Test the current merchant endpoint
    console.log('\nTesting /api/merchants/current endpoint...');
    const merchantResponse = await fetch('http://localhost:5000/api/merchants/current', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Cookie': updatedCookies
      },
      credentials: 'include'
    });
    
    if (!merchantResponse.ok) {
      const errorText = await merchantResponse.text();
      throw new Error(`Failed to get current merchant: ${merchantResponse.status} ${merchantResponse.statusText}\n${errorText}`);
    }
    
    const merchantData = await merchantResponse.json();
    console.log('Current merchant data:', JSON.stringify(merchantData, null, 2));
    
    console.log('\nSuccess! Current merchant endpoint is working correctly.');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();