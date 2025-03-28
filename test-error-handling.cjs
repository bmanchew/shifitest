/**
 * Test script for the enhanced error handling system
 * 
 * This script tests different types of errors to verify our
 * error handling middleware is working correctly.
 */
const axios = require('axios');

// Base URL for API requests
const BASE_URL = 'http://localhost:5000';

/**
 * Test API error responses
 */
async function testApiErrorResponses() {
  console.log('Testing API error responses...');

  // Test API error responses for 404
  try {
    console.log('\n1. Testing 404 Not Found API response...');
    await axios.get(`${BASE_URL}/api/non-existent-endpoint`);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('✓ 404 Error response:', {
        status: error.response.status,
        message: error.response.data.message,
        success: error.response.data.success,
        errorCode: error.response.data.errorCode
      });
    } else {
      console.error('✗ Unexpected error testing 404:', error);
    }
  }

  // Test validation error or CSRF error
  try {
    console.log('\n2. Testing validation/CSRF error...');
    // This endpoint requires authentication and CSRF token, so it should fail with either
    await axios.post(`${BASE_URL}/api/auth/change-password`, {});
  } catch (error) {
    if (error.response && (error.response.status === 400 || error.response.status === 401 || error.response.status === 403)) {
      console.log('✓ Validation/Auth/CSRF Error response:', {
        status: error.response.status,
        message: error.response.data.message,
        success: error.response.data.success,
        errorCode: error.response.data.errorCode
      });
    } else {
      console.error('✗ Unexpected error testing validation:', error);
    }
  }

  // Test CSRF protection
  try {
    console.log('\n3. Testing CSRF protection...');
    // This should trigger CSRF protection error since we're not sending a CSRF token
    await axios.post(`${BASE_URL}/api/customers/create`, {
      name: 'Test Customer',
      email: 'test@example.com'
    });
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log('✓ CSRF Error response:', {
        status: error.response.status,
        message: error.response.data.message,
        success: error.response.data.success,
        errorCode: error.response.data.errorCode
      });
    } else {
      console.error('✗ Unexpected error testing CSRF:', error);
    }
  }

  console.log('\nError handling tests completed!');
}

/**
 * Main function
 */
async function main() {
  try {
    await testApiErrorResponses();
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the main function
main();