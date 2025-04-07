/**
 * Script to create a test support ticket for testing the new UI
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Constants
const BASE_URL = 'http://localhost:5000';
const ADMIN_EMAIL = 'admin@shifi.com';
const ADMIN_PASSWORD = 'admin123';
const MERCHANT_EMAIL = 'test-merchant@example.com';
const MERCHANT_PASSWORD = 'password123';
const COOKIES_FILE = './merchant-cookies.txt';

// API client with cookie support
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true
});

// Helper functions
function saveCookies(response) {
  if (response.headers['set-cookie']) {
    fs.writeFileSync(COOKIES_FILE, response.headers['set-cookie'].join('; '));
    console.log(`[INFO] Saved ${response.headers['set-cookie'].length} cookies`);
  }
}

function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      return fs.readFileSync(COOKIES_FILE, 'utf8');
    }
  } catch (err) {
    console.error('[ERROR] Error loading cookies:', err);
  }
  return '';
}

// Add cookie middleware to requests
api.interceptors.request.use(config => {
  const cookies = loadCookies();
  if (cookies) {
    config.headers.Cookie = cookies;
    console.log('[INFO] Added cookies to request');
  }
  return config;
});

// Add cookie saving middleware to responses 
api.interceptors.response.use(response => {
  saveCookies(response);
  return response;
});

// Get CSRF token
async function getCsrfToken() {
  try {
    const response = await api.get('/api/csrf-token');
    const csrfToken = response.data.csrfToken;
    console.log(`[INFO] Obtained CSRF token: ${csrfToken}`);
    return csrfToken;
  } catch (error) {
    console.error('[ERROR] Failed to get CSRF token:', error.message);
    throw error;
  }
}

// Login as merchant
async function loginAsMerchant() {
  try {
    console.log('[INFO] Attempting to login as merchant...');
    const csrfToken = await getCsrfToken();
    
    const response = await api.post('/api/auth/login', {
      email: MERCHANT_EMAIL,
      password: MERCHANT_PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      }
    });
    
    if (response.data.success) {
      console.log('[INFO] Merchant login successful');
      return response.data.user;
    } else {
      console.error('[ERROR] Merchant login failed:', response.data);
      throw new Error('Login failed');
    }
  } catch (error) {
    console.error('[ERROR] Failed to login as merchant:', error.message);
    throw error;
  }
}

// Create a test support ticket
async function createTestTicket() {
  try {
    const user = await loginAsMerchant();
    console.log('[INFO] Logged in as merchant:', user);
    
    const csrfToken = await getCsrfToken();
    
    const ticketData = {
      subject: 'Test Support Ticket - ' + new Date().toISOString(),
      description: 'This is a test support ticket created to test the new unified ticket view UI.',
      category: 'technical_issue',
      priority: 'normal'
    };
    
    console.log('[INFO] Creating test ticket with data:', ticketData);
    
    const response = await api.post('/api/support-tickets', ticketData, {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      }
    });
    
    console.log('[INFO] Ticket creation response:', response.data);
    
    // Add a message to the ticket
    if (response.data.success && response.data.ticket.id) {
      const ticketId = response.data.ticket.id;
      
      const messageResponse = await api.post(`/api/support-tickets/${ticketId}/messages`, {
        content: 'This is a test message for the ticket. Please check if the UI displays correctly.',
        senderId: user.merchantId,
        senderType: 'merchant'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        }
      });
      
      console.log('[INFO] Message creation response:', messageResponse.data);
      
      // Admin response
      console.log('[INFO] Attempting to login as admin...');
      
      // Get a new CSRF token
      const adminCsrfToken = await getCsrfToken();
      
      const adminLoginResponse = await api.post('/api/auth/login', {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': adminCsrfToken
        }
      });
      
      if (adminLoginResponse.data.success) {
        console.log('[INFO] Admin login successful');
        
        // Get a new CSRF token
        const newAdminCsrfToken = await getCsrfToken();
        
        // Add an admin response
        const adminMessageResponse = await api.post(`/api/support-tickets/${ticketId}/messages`, {
          content: 'This is a test response from support. Testing the message display in the new UI.',
          senderId: 1, // Admin ID
          senderType: 'admin'
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': newAdminCsrfToken
          }
        });
        
        console.log('[INFO] Admin message creation response:', adminMessageResponse.data);
        
        // Log back in as merchant for testing
        await loginAsMerchant();
        
        console.log('[INFO] Test ticket setup complete. Ticket ID:', ticketId);
        
        // Provide testing instructions
        console.log('\n=== TESTING INSTRUCTIONS ===');
        console.log(`1. Login as merchant: ${MERCHANT_EMAIL} / ${MERCHANT_PASSWORD}`);
        console.log(`2. Go to Support Tickets section`);
        console.log(`3. Click on the newly created ticket`);
        console.log(`4. Verify the new unified UI design is working correctly`);
        console.log('==========================\n');
      }
    }
  } catch (error) {
    console.error('[ERROR] Failed to create test ticket:', error.message);
    if (error.response) {
      console.error('[ERROR] Response data:', error.response.data);
      console.error('[ERROR] Response status:', error.response.status);
    }
  }
}

// Execute the main function
createTestTicket();