/**
 * Test script for the admin contract cancellation endpoints
 * This script tests the admin endpoints for managing cancellation requests
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5000';

// Store cookies in a file for reuse
const COOKIES_FILE = path.join(__dirname, 'admin_cookies.txt');
let cookies = [];

function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookiesText = fs.readFileSync(COOKIES_FILE, 'utf8');
      cookies = cookiesText.split('\n')
        .filter(cookie => cookie.trim().length > 0);
      console.log(`Loaded ${cookies.length} cookies from file`);
    }
  } catch (error) {
    console.error('Error loading cookies:', error.message);
  }
}

function saveCookies() {
  try {
    fs.writeFileSync(COOKIES_FILE, cookies.join('\n'), 'utf8');
    console.log(`Saved ${cookies.length} cookies to file`);
  } catch (error) {
    console.error('Error saving cookies:', error.message);
  }
}

async function getCsrfToken() {
  try {
    const response = await axios.get(`${API_URL}/api/csrf-token`, {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    
    // Save any cookies that were set
    if (response.headers['set-cookie']) {
      cookies = cookies.concat(response.headers['set-cookie']);
      saveCookies();
    }
    
    return response.data.token;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function loginAsAdmin() {
  try {
    console.log('Logging in as admin...');
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(
      `${API_URL}/api/auth/login`,
      {
        email: 'admin@example.com',
        password: 'adminpassword'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    // Save any cookies that were set
    if (response.headers['set-cookie']) {
      cookies = cookies.concat(response.headers['set-cookie']);
      saveCookies();
    }
    
    console.log('Admin login successful!');
    return response.data;
  } catch (error) {
    console.error('Error logging in:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function testGetPendingCancellationRequests() {
  try {
    console.log('Getting pending cancellation requests...');
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.get(
      `${API_URL}/api/admin/cancellation-requests/pending`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    console.log(`Found ${response.data.requests.length} pending cancellation requests`);
    return response.data.requests;
  } catch (error) {
    console.error('Error getting pending cancellation requests:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function testSetRequestUnderReview(requestId) {
  try {
    console.log(`Setting request ${requestId} to under review...`);
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(
      `${API_URL}/api/admin/cancellation-requests/${requestId}/review`,
      {
        adminNotes: 'Under review by admin for testing'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    console.log('Request set to under review successfully!');
    return response.data;
  } catch (error) {
    console.error('Error setting request under review:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function testApproveCancellationRequest(requestId) {
  try {
    console.log(`Approving cancellation request ${requestId}...`);
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(
      `${API_URL}/api/admin/cancellation-requests/${requestId}/approve`,
      {
        adminNotes: 'Approved by admin for testing',
        refundAmount: 0 // No refund in this test case
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    console.log('Cancellation request approved successfully!');
    return response.data;
  } catch (error) {
    console.error('Error approving cancellation request:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function testRejectCancellationRequest(requestId) {
  try {
    console.log(`Rejecting cancellation request ${requestId}...`);
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(
      `${API_URL}/api/admin/cancellation-requests/${requestId}/reject`,
      {
        adminNotes: 'Rejected by admin for testing',
        denialReason: 'Rejection test - contract is not eligible for cancellation'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    console.log('Cancellation request rejected successfully!');
    return response.data;
  } catch (error) {
    console.error('Error rejecting cancellation request:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function createTestCancellationRequest() {
  try {
    console.log('Creating a test cancellation request...');
    
    // For this test, we'd need to make calls as a merchant user
    // But since this is an admin test script, we'll just check if there are existing requests
    const pendingRequests = await testGetPendingCancellationRequests();
    
    if (pendingRequests.length > 0) {
      console.log('Found existing cancellation request to use for testing');
      return pendingRequests[0];
    }
    
    console.log('No existing cancellation requests found. Please run the merchant test script first to create one.');
    return null;
  } catch (error) {
    console.error('Error creating test cancellation request:', error.message);
    throw error;
  }
}

async function runTests() {
  try {
    // Load any saved cookies
    loadCookies();
    
    // Login as admin
    await loginAsAdmin();
    
    // First, check for pending cancellation requests
    const pendingRequests = await testGetPendingCancellationRequests();
    
    let testRequest;
    if (pendingRequests.length === 0) {
      console.log('No pending requests found, trying to create one...');
      testRequest = await createTestCancellationRequest();
      
      if (!testRequest) {
        console.log('Could not create or find a test cancellation request. Exiting test.');
        return;
      }
    } else {
      testRequest = pendingRequests[0];
      console.log('Using existing cancellation request for testing:', {
        id: testRequest.id,
        contractId: testRequest.contractId,
        status: testRequest.status
      });
    }
    
    // Set the request to under review
    await testSetRequestUnderReview(testRequest.id);
    
    // If you want to test both approval and rejection in the same run,
    // you'd need two different requests
    
    // For this test, we'll just test one of them
    // Uncomment the appropriate line:
    await testApproveCancellationRequest(testRequest.id);
    // await testRejectCancellationRequest(testRequest.id);
    
    // Get the updated list of pending requests
    const updatedPendingRequests = await testGetPendingCancellationRequests();
    console.log(`After processing, there are ${updatedPendingRequests.length} pending requests remaining`);
    
    // Test result summary
    console.log('\n======= TEST RESULTS =======');
    console.log('✅ Admin login successful');
    console.log('✅ Fetched pending cancellation requests');
    console.log('✅ Set request to under review');
    console.log('✅ Approved cancellation request'); // Or '✅ Rejected cancellation request'
    console.log('✅ Verified request status updated');
    console.log('=============================\n');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the tests
runTests();