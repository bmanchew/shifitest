/**
 * Test script for the admin contract cancellation endpoints
 * This script tests the admin endpoints for managing cancellation requests
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = 'http://localhost:5000/api';
const COOKIES_FILE = path.join(__dirname, 'cookies.txt');

// Use local cookies for authentication if available
function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookieContent = fs.readFileSync(COOKIES_FILE, 'utf8');
      // Don't return empty cookies
      if (cookieContent.trim() === '') {
        return undefined;
      }
      
      // Process cookie string to extract individual cookies
      // This handles the case where cookie string might contain invalid characters
      const cookieParts = cookieContent.split(';').filter(Boolean);
      const cookieObj = {};
      
      // Extract key-value pairs
      for (const part of cookieParts) {
        const [key, value] = part.trim().split('=');
        if (key && value) {
          cookieObj[key.trim()] = value.trim();
        }
      }
      
      // Return cookie object instead of string
      return cookieObj;
    }
  } catch (error) {
    console.error('Error reading cookies file:', error);
  }
  return undefined;
}

// Get CSRF token
async function getCsrfToken() {
  try {
    const cookies = loadCookies();
    const config = {
      headers: {}
    };
    
    // Only add Cookie header if we have cookies
    if (cookies) {
      // Convert cookie object to string
      const cookieStr = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      if (cookieStr) {
        config.headers.Cookie = cookieStr;
      }
    }
    
    const response = await axios.get(`${API_BASE_URL}/csrf-token`, config);
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.response?.data || error.message);
    throw error;
  }
}

// Login as admin for testing
async function loginAsAdmin() {
  try {
    const csrfToken = await getCsrfToken();
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@shifi.com',
      password: 'admin123'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    // Save cookies for future requests
    if (response.headers['set-cookie']) {
      // Parse cookies into an object for easier handling
      const cookieObj = {};
      response.headers['set-cookie'].forEach(cookie => {
        const parts = cookie.split(';')[0].split('=');
        if (parts.length === 2) {
          cookieObj[parts[0].trim()] = parts[1].trim();
        }
      });
      
      // Save cookies as JSON for future requests
      fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookieObj));
    }
    
    return response.data;
  } catch (error) {
    console.error('Error logging in as admin:', error.response?.data || error.message);
    throw error;
  }
}

// Test getting all pending cancellation requests
async function testGetPendingCancellationRequests() {
  try {
    const csrfToken = await getCsrfToken();
    const cookies = loadCookies();
    
    const config = {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    };
    
    // Only add Cookie header if we have cookies
    if (cookies) {
      // Convert cookie object to string
      const cookieStr = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      if (cookieStr) {
        config.headers.Cookie = cookieStr;
      }
    }
    
    const response = await axios.get(`${API_BASE_URL}/admin/cancellation-requests/pending`, config);
    
    console.log('Pending cancellation requests:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error getting pending cancellation requests:', error.response?.data || error.message);
    throw error;
  }
}

// Test setting a request to under review
async function testSetRequestUnderReview(requestId) {
  try {
    const csrfToken = await getCsrfToken();
    const cookies = loadCookies();
    
    const config = {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      }
    };
    
    // Only add Cookie header if we have cookies
    if (cookies) {
      // Convert cookie object to string
      const cookieStr = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      if (cookieStr) {
        config.headers.Cookie = cookieStr;
      }
    }
    
    const response = await axios.post(
      `${API_BASE_URL}/admin/cancellation-requests/${requestId}/review`, 
      {
        notes: 'Setting for admin review'
      }, 
      config
    );
    
    console.log('Set request to under review:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error setting request to under review:', error.response?.data || error.message);
    throw error;
  }
}

// Test approving a cancellation request
async function testApproveCancellationRequest(requestId) {
  try {
    const csrfToken = await getCsrfToken();
    const cookies = loadCookies();
    
    const config = {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      }
    };
    
    // Only add Cookie header if we have cookies
    if (cookies) {
      // Convert cookie object to string
      const cookieStr = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      if (cookieStr) {
        config.headers.Cookie = cookieStr;
      }
    }
    
    const response = await axios.post(
      `${API_BASE_URL}/admin/cancellation-requests/${requestId}/approve`, 
      {
        notes: 'Approved after customer evaluation',
        refundAmount: 250.00,
        fundingCycleAdjustment: -1
      },
      config
    );
    
    console.log('Approved cancellation request:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error approving cancellation request:', error.response?.data || error.message);
    throw error;
  }
}

// Test rejecting a cancellation request
async function testRejectCancellationRequest(requestId) {
  try {
    const csrfToken = await getCsrfToken();
    const cookies = loadCookies();
    
    const config = {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      }
    };
    
    // Only add Cookie header if we have cookies
    if (cookies) {
      // Convert cookie object to string
      const cookieStr = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      if (cookieStr) {
        config.headers.Cookie = cookieStr;
      }
    }
    
    const response = await axios.post(
      `${API_BASE_URL}/admin/cancellation-requests/${requestId}/reject`, 
      {
        denialReason: 'Contract terms do not permit cancellation at this stage',
        notes: 'Customer was informed of contract terms. Recommend following up with alternative options.'
      },
      config
    );
    
    console.log('Rejected cancellation request:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error rejecting cancellation request:', error.response?.data || error.message);
    throw error;
  }
}

// Create a test cancellation request for testing purposes
async function createTestCancellationRequest() {
  try {
    // Get an active contract to use
    const csrfToken = await getCsrfToken();
    const cookies = loadCookies();
    
    const getConfig = {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    };
    
    // Only add Cookie header if we have cookies
    if (cookies) {
      // Convert cookie object to string
      const cookieStr = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      if (cookieStr) {
        getConfig.headers.Cookie = cookieStr;
      }
    }
    
    const contractsResponse = await axios.get(
      `${API_BASE_URL}/contracts?status=active&limit=1`, 
      getConfig
    );
    
    if (!contractsResponse.data.contracts || contractsResponse.data.contracts.length === 0) {
      console.error('No active contracts found for testing');
      return null;
    }
    
    const contract = contractsResponse.data.contracts[0];
    
    // Create a cancellation request
    const postConfig = {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      }
    };
    
    // Only add Cookie header if we have cookies
    if (cookies) {
      // Convert cookie object to string
      const cookieStr = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      if (cookieStr) {
        postConfig.headers.Cookie = cookieStr;
      }
    }
    
    const response = await axios.post(
      `${API_BASE_URL}/contracts/${contract.id}/request-cancellation`, 
      {
        reason: 'Testing admin cancellation endpoints',
        notes: 'This is a test cancellation request created by the test script'
      },
      postConfig
    );
    
    console.log('Created test cancellation request:', JSON.stringify(response.data, null, 2));
    
    return response.data.request;
  } catch (error) {
    console.error('Error creating test cancellation request:', error.response?.data || error.message);
    throw error;
  }
}

// Run all tests
async function runTests() {
  try {
    // Login as admin first
    await loginAsAdmin();
    
    // Get existing cancellation requests
    const pendingRequestsData = await testGetPendingCancellationRequests();
    
    let testRequestId;
    
    // If no pending requests found, create one for testing
    if (!pendingRequestsData.requests || pendingRequestsData.requests.length === 0) {
      console.log('No pending requests found. Creating a test request...');
      const newRequest = await createTestCancellationRequest();
      if (newRequest) {
        testRequestId = newRequest.id;
      } else {
        console.error('Could not create test request. Exiting tests.');
        return;
      }
    } else {
      // Use the first pending request for testing
      testRequestId = pendingRequestsData.requests[0].id;
    }
    
    console.log(`Using request ID ${testRequestId} for testing`);
    
    // Test setting request to under review
    await testSetRequestUnderReview(testRequestId);
    
    // For actual approval/rejection, use a simple condition to demonstrate both paths
    if (testRequestId % 2 === 0) {
      // For even IDs, test approval
      await testApproveCancellationRequest(testRequestId);
    } else {
      // For odd IDs, test rejection
      await testRejectCancellationRequest(testRequestId);
    }
    
    // Check the final status of the cancellation requests
    await testGetPendingCancellationRequests();
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test run failed:', error);
  }
}

// Run the tests
runTests();

// Export functions for use in other modules
export {
  loginAsAdmin,
  getCsrfToken,
  testGetPendingCancellationRequests,
  testSetRequestUnderReview,
  testApproveCancellationRequest,
  testRejectCancellationRequest,
  createTestCancellationRequest,
  runTests
};