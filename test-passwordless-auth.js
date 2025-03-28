/**
 * Test script for passwordless authentication methods (Magic Link and OTP)
 * 
 * This script tests:
 * 1. Requesting a magic link for a customer email
 * 2. Verifying a magic link token
 * 3. Requesting an OTP code for a customer phone
 * 4. Verifying an OTP code
 */

import axios from 'axios';
import { randomUUID } from 'crypto';
import tough from 'tough-cookie';
import { wrapper as axiosCookieJarSupport } from 'axios-cookiejar-support';

// Base URL for API
const API_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'customer@example.com'; // Replace with a real customer email in your system
const TEST_PHONE = '5551234567'; // Replace with a real customer phone in your system

// Create a cookie jar
const cookieJar = new tough.CookieJar();

// Create an axios instance with credentials and cookie jar support
const api = axiosCookieJarSupport(axios.create({
  baseURL: API_URL,
  withCredentials: true,
  jar: cookieJar
}));

// CSRF token storage
let csrfToken = null;

/**
 * Fetch a CSRF token
 */
async function fetchCsrfToken() {
  try {
    const response = await api.get('/csrf-token');
    csrfToken = response.data.csrfToken;
    console.log('✅ CSRF token fetched successfully');
    return csrfToken;
  } catch (error) {
    console.error('❌ Failed to fetch CSRF token:', error.message);
    return null;
  }
}

/**
 * Handle API errors in a consistent way
 */
function handleApiError(error) {
  if (error.response) {
    console.error(`API Error (${error.response.status}):`, error.response.data);
  } else if (error.request) {
    console.error('Request Error:', error.request);
  } else {
    console.error('Error:', error.message);
  }
}

/**
 * Test requesting a magic link
 */
async function testMagicLinkRequest() {
  console.log('\n🔗 Testing Magic Link Request...');
  try {
    // Request the magic link
    const response = await api.post('/auth/magic-link', {
      email: TEST_EMAIL
    }, {
      headers: {
        'CSRF-Token': csrfToken
      }
    });
    
    console.log('✅ Magic Link Request Response:', response.data);
    return response.data;
  } catch (error) {
    handleApiError(error);
    return null;
  }
}

/**
 * Test magic link verification
 * Note: In a real scenario, the user would click the link in their email
 * and the token would be extracted from the URL. For testing, we're
 * simulating this with a fake token that won't actually work.
 */
async function testMagicLinkVerification() {
  console.log('\n🔐 Testing Magic Link Verification...');
  try {
    // This is just a test - the token won't be valid since we don't have access
    // to the actual token sent via email
    const testToken = randomUUID();
    
    console.log(`Using test token: ${testToken} (this won't actually work)`);
    
    // In a real scenario, this would be a GET request to /auth/magic-link/verify/:token
    // But for testing purposes, we'll make a GET request to simulate a user clicking the link
    const response = await api.get(`/auth/magic-link/verify/${testToken}`, {
      headers: {
        'CSRF-Token': csrfToken
      }
    });
    
    console.log('Magic Link Verification Response:', response.data);
    return response.data;
  } catch (error) {
    console.log('⚠️ Expected error for fake token:', error.response ? error.response.data : error.message);
    return null;
  }
}

/**
 * Test requesting an OTP code
 */
async function testOtpRequest() {
  console.log('\n📱 Testing OTP Request...');
  try {
    // Request the OTP
    const response = await api.post('/auth/otp', {
      phone: TEST_PHONE
    }, {
      headers: {
        'CSRF-Token': csrfToken
      }
    });
    
    console.log('✅ OTP Request Response:', response.data);
    return response.data;
  } catch (error) {
    handleApiError(error);
    return null;
  }
}

/**
 * Test OTP verification
 * Note: In a real scenario, the user would receive the OTP via SMS
 * and enter it in the UI. For testing, we're simulating this with a
 * fake OTP that won't actually work.
 */
async function testOtpVerification() {
  console.log('\n🔢 Testing OTP Verification...');
  try {
    // This is just a test - the OTP won't be valid
    const testOtp = '123456';
    
    console.log(`Using test OTP: ${testOtp} (this won't actually work)`);
    
    const response = await api.post('/auth/otp/verify', {
      phone: TEST_PHONE,
      otp: testOtp
    }, {
      headers: {
        'CSRF-Token': csrfToken
      }
    });
    
    console.log('OTP Verification Response:', response.data);
    return response.data;
  } catch (error) {
    console.log('⚠️ Expected error for fake OTP:', error.response ? error.response.data : error.message);
    return null;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 TESTING PASSWORDLESS AUTHENTICATION METHODS 🧪');
  console.log('==============================================');
  
  // First, fetch a CSRF token
  await fetchCsrfToken();
  if (!csrfToken) {
    console.error('❌ Failed to fetch CSRF token, aborting tests');
    return;
  }
  
  // Test magic link flow
  await testMagicLinkRequest();
  await testMagicLinkVerification();
  
  // Test OTP flow
  await testOtpRequest();
  await testOtpVerification();
  
  console.log('\n✅ All tests completed!');
  console.log('Note: Some errors are expected when testing with fake tokens/OTPs');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test failed:', error);
});