/**
 * End-to-end test script for the contract cancellation workflow
 * 
 * This script tests:
 * 1. Creating a cancellation request as a merchant
 * 2. Admin reviewing and processing the request
 * 3. Checking notifications and status changes
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5000';

// Store cookies in different files for merchant and admin sessions
const MERCHANT_COOKIES_FILE = path.join(__dirname, 'merchant_cookies.txt');
const ADMIN_COOKIES_FILE = path.join(__dirname, 'admin_cookies.txt');
let merchantCookies = [];
let adminCookies = [];

/**
 * Load cookies from cookies.txt if it exists
 */
function loadCookies(admin = false) {
  try {
    const cookiesFile = admin ? ADMIN_COOKIES_FILE : MERCHANT_COOKIES_FILE;
    if (fs.existsSync(cookiesFile)) {
      const cookiesText = fs.readFileSync(cookiesFile, 'utf8');
      const cookies = cookiesText.split('\n')
        .filter(cookie => cookie.trim().length > 0);
      console.log(`Loaded ${cookies.length} cookies from ${cookiesFile}`);
      return cookies;
    }
    return [];
  } catch (error) {
    console.error('Error loading cookies:', error.message);
    return [];
  }
}

/**
 * Save cookies to cookies.txt
 */
function saveCookies(cookies, admin = false) {
  try {
    const cookiesFile = admin ? ADMIN_COOKIES_FILE : MERCHANT_COOKIES_FILE;
    fs.writeFileSync(cookiesFile, cookies.join('\n'), 'utf8');
    console.log(`Saved ${cookies.length} cookies to ${cookiesFile}`);
  } catch (error) {
    console.error('Error saving cookies:', error.message);
  }
}

/**
 * Get a CSRF token from the server
 */
async function getCsrfToken(admin = false) {
  try {
    const cookies = admin ? adminCookies : merchantCookies;
    
    const response = await axios.get(`${API_URL}/api/csrf-token`, {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    
    // Save any cookies that were set
    if (response.headers['set-cookie']) {
      if (admin) {
        adminCookies = adminCookies.concat(response.headers['set-cookie']);
        saveCookies(adminCookies, true);
      } else {
        merchantCookies = merchantCookies.concat(response.headers['set-cookie']);
        saveCookies(merchantCookies, false);
      }
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

/**
 * Login as a merchant
 */
async function loginAsMerchant() {
  try {
    console.log('Logging in as merchant...');
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(
      `${API_URL}/api/auth/login`,
      {
        email: 'merchant@example.com',
        password: 'password123'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: merchantCookies.join('; ')
        }
      }
    );
    
    // Save any cookies that were set
    if (response.headers['set-cookie']) {
      merchantCookies = merchantCookies.concat(response.headers['set-cookie']);
      saveCookies(merchantCookies, false);
    }
    
    console.log('Merchant login successful!');
    return response.data;
  } catch (error) {
    console.error('Error logging in as merchant:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Login as an admin
 */
async function loginAsAdmin() {
  try {
    console.log('Logging in as admin...');
    
    const csrfToken = await getCsrfToken(true);
    
    const response = await axios.post(
      `${API_URL}/api/auth/login`,
      {
        email: 'admin@example.com',
        password: 'adminpassword'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: adminCookies.join('; ')
        }
      }
    );
    
    // Save any cookies that were set
    if (response.headers['set-cookie']) {
      adminCookies = adminCookies.concat(response.headers['set-cookie']);
      saveCookies(adminCookies, true);
    }
    
    console.log('Admin login successful!');
    return response.data;
  } catch (error) {
    console.error('Error logging in as admin:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Get merchant's contracts
 */
async function getMerchantContracts() {
  try {
    console.log('Getting merchant contracts...');
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.get(
      `${API_URL}/api/merchant/contracts`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: merchantCookies.join('; ')
        }
      }
    );
    
    console.log(`Found ${response.data.contracts.length} contracts`);
    return response.data.contracts;
  } catch (error) {
    console.error('Error getting contracts:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Request cancellation for a contract as a merchant
 */
async function requestContractCancellation(contractId, reason, notes = '') {
  try {
    console.log(`Requesting cancellation for contract ${contractId}...`);
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(
      `${API_URL}/api/merchant/contracts/${contractId}/request-cancellation`,
      {
        reason,
        notes
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: merchantCookies.join('; ')
        }
      }
    );
    
    console.log('Cancellation request submitted successfully!');
    return response.data;
  } catch (error) {
    console.error('Error requesting cancellation:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Get pending cancellation requests as admin
 */
async function getPendingCancellationRequests() {
  try {
    console.log('Getting pending cancellation requests as admin...');
    
    const csrfToken = await getCsrfToken(true);
    
    const response = await axios.get(
      `${API_URL}/api/admin/cancellation-requests/pending`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: adminCookies.join('; ')
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

/**
 * Set a cancellation request to 'under review' as admin
 */
async function setRequestUnderReview(requestId) {
  try {
    console.log(`Setting request ${requestId} to under review...`);
    
    const csrfToken = await getCsrfToken(true);
    
    const response = await axios.post(
      `${API_URL}/api/admin/cancellation-requests/${requestId}/review`,
      {
        adminNotes: 'Under review by admin'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: adminCookies.join('; ')
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

/**
 * Approve a cancellation request as admin
 */
async function approveCancellationRequest(requestId) {
  try {
    console.log(`Approving cancellation request ${requestId}...`);
    
    const csrfToken = await getCsrfToken(true);
    
    const response = await axios.post(
      `${API_URL}/api/admin/cancellation-requests/${requestId}/approve`,
      {
        adminNotes: 'Approved by admin after review',
        refundAmount: 0 // No refund in this test case
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: adminCookies.join('; ')
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

/**
 * Reject a cancellation request as admin
 */
async function rejectCancellationRequest(requestId) {
  try {
    console.log(`Rejecting cancellation request ${requestId}...`);
    
    const csrfToken = await getCsrfToken(true);
    
    const response = await axios.post(
      `${API_URL}/api/admin/cancellation-requests/${requestId}/reject`,
      {
        adminNotes: 'Rejected by admin',
        denialReason: 'Contract is not eligible for cancellation at this time'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: adminCookies.join('; ')
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

/**
 * Get contract details
 */
async function getContractDetails(contractId) {
  try {
    console.log(`Getting details for contract ${contractId}...`);
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.get(
      `${API_URL}/api/contracts/${contractId}`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: merchantCookies.join('; ')
        }
      }
    );
    
    console.log(`Retrieved details for contract ${contractId}`);
    return response.data.contract;
  } catch (error) {
    console.error('Error getting contract details:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Get merchant notifications
 */
async function getMerchantNotifications() {
  try {
    console.log('Getting merchant notifications...');
    
    const csrfToken = await getCsrfToken();
    
    const response = await axios.get(
      `${API_URL}/api/notifications/in-app`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: merchantCookies.join('; ')
        }
      }
    );
    
    console.log(`Found ${response.data.notifications.length} notifications`);
    return response.data.notifications;
  } catch (error) {
    console.error('Error getting notifications:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Simple delay function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run the full cancellation workflow test
 */
async function runCancellationWorkflowTest(approve = true) {
  try {
    console.log('\n========== STARTING CANCELLATION WORKFLOW TEST ==========');
    console.log(`Test mode: ${approve ? 'APPROVE' : 'REJECT'} cancellation\n`);
    
    // Load any saved cookies
    merchantCookies = loadCookies(false);
    adminCookies = loadCookies(true);
    
    // Step 1: Login as a merchant
    await loginAsMerchant();
    
    // Step 2: Get the merchant's contracts
    const contracts = await getMerchantContracts();
    
    if (contracts.length === 0) {
      console.log('No contracts found for merchant. Please create a contract first.');
      return;
    }
    
    // Get the first active or pending contract
    const contract = contracts.find(c => c.status === 'active' || c.status === 'pending');
    
    if (!contract) {
      console.log('No active or pending contracts found. Need an active contract to test cancellation.');
      return;
    }
    
    console.log('Found contract to test with:', {
      id: contract.id,
      contractNumber: contract.contractNumber,
      status: contract.status,
      amount: contract.amount
    });
    
    // Step 3: Request cancellation for the contract
    const cancellationReason = 'Testing full contract cancellation workflow';
    const cancellationNotes = 'These are test notes for the E2E cancellation workflow test';
    
    const cancellationResponse = await requestContractCancellation(
      contract.id, 
      cancellationReason, 
      cancellationNotes
    );
    
    console.log('Cancellation request created:', cancellationResponse);
    
    // Step 4: Login as admin
    await loginAsAdmin();
    
    // Step 5: Get pending cancellation requests as admin
    const pendingRequests = await getPendingCancellationRequests();
    
    if (pendingRequests.length === 0) {
      console.log('No pending cancellation requests found. The request may not have been created properly.');
      return;
    }
    
    // Find the request for our contract
    const request = pendingRequests.find(req => req.contractId === contract.id);
    
    if (!request) {
      console.log('Could not find the cancellation request for our contract.');
      return;
    }
    
    console.log('Found cancellation request:', {
      id: request.id,
      contractId: request.contractId,
      status: request.status,
      requestReason: request.requestReason
    });
    
    // Step 6: Set the request to under review
    await setRequestUnderReview(request.id);
    
    // Add a small delay to ensure the update is processed
    await delay(1000);
    
    // Step 7: Approve or reject the request based on the test mode
    if (approve) {
      await approveCancellationRequest(request.id);
    } else {
      await rejectCancellationRequest(request.id);
    }
    
    // Add a small delay to ensure the update is processed
    await delay(1000);
    
    // Step 8: Switch back to merchant and check notifications
    await loginAsMerchant();
    
    const notifications = await getMerchantNotifications();
    
    // Extract cancellation-related notifications
    const cancellationNotifications = notifications.filter(n => 
      n.type.includes('cancellation') || 
      n.message.toLowerCase().includes('cancel')
    );
    
    console.log('Cancellation notifications received:', cancellationNotifications.length);
    
    if (cancellationNotifications.length > 0) {
      console.log('Latest cancellation notification:', {
        id: cancellationNotifications[0].id,
        type: cancellationNotifications[0].type,
        message: cancellationNotifications[0].message,
        status: cancellationNotifications[0].status
      });
    }
    
    // Test result summary
    console.log('\n======= CANCELLATION WORKFLOW TEST RESULTS =======');
    console.log('✅ Merchant login successful');
    console.log('✅ Retrieved merchant contracts');
    console.log('✅ Submitted cancellation request');
    console.log('✅ Admin login successful');
    console.log('✅ Retrieved pending cancellation requests');
    console.log('✅ Set request to under review');
    console.log(`✅ ${approve ? 'Approved' : 'Rejected'} cancellation request`);
    console.log('✅ Checked for merchant notifications');
    console.log('=================================================\n');
    
    console.log(`The contract cancellation workflow test (${approve ? 'APPROVE' : 'REJECT'} mode) completed successfully.`);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// By default, run the test in "approve" mode
// To run in "reject" mode, change this to false
const APPROVE_MODE = true;

// Run the tests
runCancellationWorkflowTest(APPROVE_MODE);