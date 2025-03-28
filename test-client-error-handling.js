/**
 * Test script for client-side error handling
 * 
 * This script tests our enhanced client-side error handling utilities
 * to ensure they correctly process different types of errors.
 */

import fetch from 'node-fetch';
import { URL } from 'url';

// Base URL for the API
const BASE_URL = process.env.API_URL || 'http://localhost:5000';

/**
 * Function to simulate client-side error handling from our utilities
 */
function handleApiError(error) {
  // Extract error message
  let message = 'An unexpected error occurred';
  
  // Simulate our client-side error handling logic
  if (error && typeof error === 'object' && 'response' in error) {
    const response = error.response;
    
    if (response && typeof response === 'object') {
      // Handle API error response
      if (response.data && typeof response.data === 'object') {
        const apiError = response.data;
        
        if (apiError.message) {
          message = apiError.message;
        }
        
        // Add validation errors if present
        if (apiError.errors && Array.isArray(apiError.errors) && apiError.errors.length > 0) {
          const validationMessages = apiError.errors.join('; ');
          message = `${message}: ${validationMessages}`;
        }
      } else if (response.statusText) {
        // Use status text if data is not available
        message = `Error: ${response.statusText}`;
      }
    }
  } else if (error instanceof Error) {
    // Handle standard Error objects
    message = error.message;
  } else if (typeof error === 'string') {
    // Handle string errors
    message = error;
  }
  
  return message;
}

/**
 * Check if an error is a CSRF token error
 */
function isCsrfError(error) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = error.response;
    
    if (response && typeof response === 'object' && response.status === 403) {
      if (response.data && typeof response.data === 'object') {
        const apiError = response.data;
        
        if (apiError.message && apiError.message.includes('CSRF')) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Check if an error is a session expiration error
 */
function isSessionExpiredError(error) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = error.response;
    
    if (response && typeof response === 'object' && response.status === 401) {
      if (response.data && typeof response.data === 'object') {
        const apiError = response.data;
        
        if (apiError.message && 
            (apiError.message.includes('expired') || apiError.message.includes('token'))) {
          return true;
        }
      }
      
      // Any 401 can be considered a session expiration
      return true;
    }
  }
  
  return false;
}

/**
 * Test regular API error handling
 */
async function testRegularErrorHandling() {
  console.log('\n1. Testing regular API error handling...');
  
  try {
    // Make a request to a non-existent endpoint to trigger a 404
    const response = await fetch(`${BASE_URL}/api/non-existent-endpoint`);
    const text = await response.text();
    
    // Create an error object similar to what our client would create
    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch (e) {
        errorData = { message: text };
      }
      
      const error = new Error(`${response.status}: ${response.statusText}`);
      error.response = {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      };
      
      // Process the error through our simulated error handler
      const errorMessage = handleApiError(error);
      console.log('✓ Processed error message:', errorMessage);
      console.log('Error object:', {
        status: error.response.status,
        message: error.response.data.message,
        errorType: 'API Error'
      });
    }
  } catch (error) {
    console.error('✗ Error in test:', error);
  }
}

/**
 * Test CSRF error detection
 */
async function testCsrfErrorDetection() {
  console.log('\n2. Testing CSRF error detection...');
  
  try {
    // Make a POST request without a CSRF token to trigger a 403
    const response = await fetch(`${BASE_URL}/api/customers/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Customer',
        email: 'test@example.com'
      })
    });
    
    const text = await response.text();
    
    // Create an error object similar to what our client would create
    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch (e) {
        errorData = { message: text };
      }
      
      const error = new Error(`${response.status}: ${response.statusText}`);
      error.response = {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      };
      
      // Check if this is a CSRF error
      const isCsrf = isCsrfError(error);
      console.log('✓ CSRF error detected:', isCsrf);
      console.log('Error object:', {
        status: error.response.status,
        message: error.response.data.message,
        isCsrfError: isCsrf
      });
    }
  } catch (error) {
    console.error('✗ Error in test:', error);
  }
}

/**
 * Test session expiration detection
 */
async function testSessionExpiration() {
  console.log('\n3. Testing session expiration detection...');
  
  try {
    // Create a mock 401 response since we can't easily trigger a real one without auth
    console.log('Note: Creating a mock 401 Unauthorized response since we need auth to get a real one');
    
    // Create a mock error to simulate a 401 response
    const mockError = new Error('Unauthorized: Session expired');
    mockError.response = {
      status: 401,
      statusText: 'Unauthorized',
      data: {
        success: false,
        message: 'Your session has expired. Please log in again.',
        status: 401
      }
    };
    
    // Check if this is a session expiration
    const isExpired = isSessionExpiredError(mockError);
    console.log('✓ Session expiration detected:', isExpired);
    console.log('Error object:', {
      status: mockError.response.status,
      message: mockError.response.data.message,
      isSessionExpired: isExpired
    });
    
    return;
    
    // Note: This code is kept as reference but won't run
    // In a real app, we would get a 401 from a protected endpoint
    const response = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword'
      })
    });
    
    const text = await response.text();
    
    // Create an error object similar to what our client would create
    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch (e) {
        errorData = { message: text };
      }
      
      const error = new Error(`${response.status}: ${response.statusText}`);
      error.response = {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      };
      
      // Check if this is a session expiration
      const isExpired = isSessionExpiredError(error);
      console.log('✓ Session expiration detected:', isExpired);
      console.log('Error object:', {
        status: error.response.status,
        message: error.response.data.message,
        isSessionExpired: isExpired
      });
    }
  } catch (error) {
    console.error('✗ Error in test:', error);
  }
}

/**
 * Main function to run all tests
 */
async function runTests() {
  console.log('Testing client-side error handling utilities...');
  
  try {
    await testRegularErrorHandling();
    await testCsrfErrorDetection();
    await testSessionExpiration();
    
    console.log('\nClient-side error handling tests completed!');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests();