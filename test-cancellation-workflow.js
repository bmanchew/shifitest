/**
 * End-to-end test script for the contract cancellation workflow
 * 
 * This script tests:
 * 1. Creating a cancellation request as a merchant
 * 2. Admin reviewing and processing the request
 * 3. Checking notifications and status changes
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  loginAsMerchant, 
  getActiveContracts, 
  requestContractCancellation 
} from './test-request-contract-cancellation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = 'http://localhost:5000/api';
const COOKIES_FILE = path.join(__dirname, 'cookies.txt');
const ADMIN_COOKIES_FILE = path.join(__dirname, 'admin_cookies.txt');

// Helper Functions for Cookies
function loadCookies(admin = false) {
  const cookieFile = admin ? ADMIN_COOKIES_FILE : COOKIES_FILE;
  try {
    if (fs.existsSync(cookieFile)) {
      return fs.readFileSync(cookieFile, 'utf8');
    }
  } catch (error) {
    console.error(`Error reading ${admin ? 'admin' : 'merchant'} cookies file:`, error);
  }
  return '';
}

function saveCookies(cookies, admin = false) {
  const cookieFile = admin ? ADMIN_COOKIES_FILE : COOKIES_FILE;
  if (cookies) {
    fs.writeFileSync(cookieFile, cookies.join('; '));
  }
}

// Get CSRF token
async function getCsrfToken(admin = false) {
  try {
    const response = await axios.get(`${API_BASE_URL}/csrf-token`, {
      headers: {
        Cookie: loadCookies(admin)
      }
    });
    
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.response?.data || error.message);
    throw error;
  }
}

// Login as admin
async function loginAsAdmin() {
  try {
    const csrfToken = await getCsrfToken(true);
    console.log('Got CSRF token for admin login:', csrfToken);
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@shifi.com',   // Adjust to a valid admin email
      password: 'admin123'        // Adjust to the correct password
    }, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    // Save cookies for future requests
    if (response.headers['set-cookie']) {
      saveCookies(response.headers['set-cookie'], true);
      console.log('Admin login successful, cookies saved.');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error logging in as admin:', error.response?.data || error.message);
    throw error;
  }
}

// Get pending cancellation requests as admin
async function getPendingCancellationRequests() {
  try {
    const csrfToken = await getCsrfToken(true);
    const response = await axios.get(`${API_BASE_URL}/admin/cancellation-requests/pending`, {
      headers: {
        'X-CSRF-Token': csrfToken,
        Cookie: loadCookies(true)
      }
    });
    
    console.log(`Found ${response.data.requests?.length || 0} pending cancellation requests`);
    return response.data.requests || [];
  } catch (error) {
    console.error('Error getting pending cancellation requests:', error.response?.data || error.message);
    throw error;
  }
}

// Set request to under review
async function setRequestUnderReview(requestId) {
  try {
    const csrfToken = await getCsrfToken(true);
    console.log(`Setting request ${requestId} to under review`);
    
    const response = await axios.post(`${API_BASE_URL}/admin/cancellation-requests/${requestId}/review`, {}, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
        Cookie: loadCookies(true)
      }
    });
    
    console.log('Request set to under review:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error setting request to under review:', error.response?.data || error.message);
    throw error;
  }
}

// Approve cancellation request
async function approveCancellationRequest(requestId) {
  try {
    const csrfToken = await getCsrfToken(true);
    console.log(`Approving cancellation request ${requestId}`);
    
    const response = await axios.post(`${API_BASE_URL}/admin/cancellation-requests/${requestId}/approve`, {
      notes: 'Approved after financial review',
      refundAmount: 150.00,
      fundingCycleAdjustment: -1
    }, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
        Cookie: loadCookies(true)
      }
    });
    
    console.log('Cancellation request approved:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error approving cancellation request:', error.response?.data || error.message);
    throw error;
  }
}

// Reject cancellation request
async function rejectCancellationRequest(requestId) {
  try {
    const csrfToken = await getCsrfToken(true);
    console.log(`Rejecting cancellation request ${requestId}`);
    
    const response = await axios.post(`${API_BASE_URL}/admin/cancellation-requests/${requestId}/reject`, {
      denialReason: 'Contract terms do not allow for early cancellation',
      notes: 'Customer should review contract terms section 4.2'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
        Cookie: loadCookies(true)
      }
    });
    
    console.log('Cancellation request rejected:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error rejecting cancellation request:', error.response?.data || error.message);
    throw error;
  }
}

// Get contract details as merchant
async function getContractDetails(contractId) {
  try {
    const csrfToken = await getCsrfToken();
    const response = await axios.get(`${API_BASE_URL}/contracts/${contractId}`, {
      headers: {
        'X-CSRF-Token': csrfToken,
        Cookie: loadCookies()
      }
    });
    
    console.log(`Contract ${contractId} status:`, response.data.contract.status);
    return response.data.contract;
  } catch (error) {
    console.error('Error getting contract details:', error.response?.data || error.message);
    throw error;
  }
}

// Get merchant notifications
async function getMerchantNotifications() {
  try {
    const csrfToken = await getCsrfToken();
    const response = await axios.get(`${API_BASE_URL}/notifications/unread`, {
      headers: {
        'X-CSRF-Token': csrfToken,
        Cookie: loadCookies()
      }
    });
    
    console.log(`Found ${response.data.notifications?.length || 0} unread notifications`);
    return response.data.notifications || [];
  } catch (error) {
    console.error('Error getting notifications:', error.response?.data || error.message);
    throw error;
  }
}

// Create a delay function for process steps
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test function
async function runCancellationWorkflowTest(approve = true) {
  console.log('=== STARTING CANCELLATION WORKFLOW TEST ===');
  console.log(`Testing ${approve ? 'APPROVAL' : 'REJECTION'} workflow`);
  
  try {
    // Step 1: Create a cancellation request as merchant
    console.log('\n--- Step 1: Creating cancellation request as merchant ---');
    await loginAsMerchant();
    const contracts = await getActiveContracts();
    
    if (contracts.length === 0) {
      console.log('No active contracts found. Cannot proceed with test.');
      return;
    }
    
    const contractId = contracts[0].id;
    console.log(`Using contract ID ${contractId} for testing`);
    
    const cancellationResult = await requestContractCancellation(contractId);
    const requestId = cancellationResult.request.id;
    console.log(`Cancellation request created with ID: ${requestId}`);
    
    // Brief delay to ensure database consistency
    await delay(1000);
    
    // Step 2: Process as admin
    console.log('\n--- Step 2: Processing request as admin ---');
    await loginAsAdmin();
    const pendingRequests = await getPendingCancellationRequests();
    
    // Find our specific request
    const ourRequest = pendingRequests.find(req => req.id === requestId);
    if (!ourRequest) {
      console.log(`Request ${requestId} not found in pending requests. Available requests:`);
      console.log(pendingRequests.map(r => r.id));
      return;
    }
    
    // Set to under review
    await setRequestUnderReview(requestId);
    await delay(1000);
    
    // Approve or reject based on parameter
    if (approve) {
      await approveCancellationRequest(requestId);
    } else {
      await rejectCancellationRequest(requestId);
    }
    
    // Brief delay to ensure database consistency
    await delay(1000);
    
    // Step 3: Verify outcomes as merchant
    console.log('\n--- Step 3: Verifying outcomes as merchant ---');
    await loginAsMerchant();
    
    // Check contract status
    const updatedContract = await getContractDetails(contractId);
    console.log(`Contract status after ${approve ? 'approval' : 'rejection'}: ${updatedContract.status}`);
    
    // Check notifications
    const notifications = await getMerchantNotifications();
    console.log('Recent notifications:');
    notifications.slice(0, 3).forEach(notif => {
      console.log(`- ${notif.title}: ${notif.message}`);
    });
    
    console.log('\n=== TEST COMPLETED SUCCESSFULLY ===');
    console.log(`Cancellation request was ${approve ? 'approved' : 'rejected'}`);
    console.log(`Contract ${contractId} is now ${updatedContract.status}`);
    
  } catch (error) {
    console.error('Test workflow failed:', error);
  }
}

// Run the test with the approval flow by default
// For rejection flow, call with false parameter
const shouldApprove = process.argv[2] !== 'reject';
runCancellationWorkflowTest(shouldApprove);

// Export functions for use in other modules
export {
  loginAsAdmin,
  getPendingCancellationRequests,
  setRequestUnderReview,
  approveCancellationRequest,
  rejectCancellationRequest,
  getContractDetails,
  getMerchantNotifications,
  runCancellationWorkflowTest
};