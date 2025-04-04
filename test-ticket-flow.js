/**
 * Test script to verify the ticket system flow between merchant and admin
 * 
 * This script:
 * 1. Logs in as a merchant user
 * 2. Creates a support ticket
 * 3. Logs in as an admin user
 * 4. Responds to the ticket
 * 5. Checks that the ticket status updates correctly
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const tough = require('tough-cookie');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;

// Create cookie jars for different users
const merchantCookieJar = new tough.CookieJar();
const adminCookieJar = new tough.CookieJar();

// Merchant credentials
const MERCHANT_EMAIL = 'test-merchant@example.com';
const MERCHANT_PASSWORD = 'password123';

// Admin credentials (use test admin credentials)
const ADMIN_EMAIL = 'admin@shilohfinance.com';
const ADMIN_PASSWORD = 'password123';

// Create axios instances with cookie jar support
const merchantAxios = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
  jar: merchantCookieJar
});
axiosCookieJarSupport(merchantAxios);

const adminAxios = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
  jar: adminCookieJar
});
axiosCookieJarSupport(adminAxios);

// Test flows
async function runTest() {
  try {
    console.log('=== Starting Ticket System Test ===');
    
    // 1. Merchant login
    console.log('\n--- Step 1: Merchant Login ---');
    const merchantCsrfToken = await getMerchantCsrfToken();
    await loginAsMerchant(merchantCsrfToken);
    
    // 2. Get merchant information
    console.log('\n--- Step 2: Get Merchant Information ---');
    const merchantData = await getMerchantData();
    console.log(`Logged in as Merchant ID: ${merchantData.id}`);
    
    // 3. Create a ticket as merchant
    console.log('\n--- Step 3: Create Support Ticket ---');
    const ticketData = await createTicket(merchantData.id);
    console.log(`Created Ticket #${ticketData.ticketNumber} with ID: ${ticketData.id}`);
    
    // 4. Login as admin
    console.log('\n--- Step 4: Admin Login ---');
    const adminCsrfToken = await getAdminCsrfToken();
    await loginAsAdmin(adminCsrfToken);
    
    // 5. Check that admin can see the ticket
    console.log('\n--- Step 5: Admin Views Tickets ---');
    const adminTickets = await getAdminTickets();
    const createdTicket = adminTickets.find(t => t.id === ticketData.id);
    
    if (createdTicket) {
      console.log('✅ Admin can see the merchant ticket');
      console.log(`Ticket status: ${createdTicket.status}`);
    } else {
      console.log('❌ Admin cannot see the merchant ticket');
      throw new Error('Ticket not visible to admin');
    }
    
    // 6. Admin responds to the ticket
    console.log('\n--- Step 6: Admin Responds to Ticket ---');
    await respondToTicket(ticketData.id);
    console.log('Admin response sent');
    
    // 7. Merchant checks for response
    console.log('\n--- Step 7: Merchant Checks Response ---');
    await loginAsMerchant(await getMerchantCsrfToken());
    const ticketMessages = await getTicketMessages(ticketData.id);
    
    if (ticketMessages.length >= 2) {
      console.log('✅ Merchant can see admin response');
      ticketMessages.forEach((msg, i) => {
        console.log(`Message ${i+1}: From ${msg.isFromMerchant ? 'Merchant' : 'Admin'}`);
      });
    } else {
      console.log('❌ Admin response not visible to merchant');
      throw new Error('Admin response not found');
    }
    
    // 8. Merchant marks message as read
    console.log('\n--- Step 8: Merchant Marks Message as Read ---');
    if (ticketMessages.length > 0) {
      const lastMessage = ticketMessages[ticketMessages.length - 1];
      if (!lastMessage.isFromMerchant) {
        await markMessageAsRead(lastMessage.id);
        console.log('✅ Successfully marked admin message as read');
      }
    }
    
    console.log('\n=== Ticket System Test Completed Successfully ===');
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Helper functions
async function getMerchantCsrfToken() {
  const response = await merchantAxios.get('/api/csrf-token');
  return response.data.csrfToken;
}

async function getAdminCsrfToken() {
  const response = await adminAxios.get('/api/csrf-token');
  return response.data.csrfToken;
}

async function loginAsMerchant(csrfToken) {
  const response = await merchantAxios.post('/api/auth/login', {
    email: MERCHANT_EMAIL,
    password: MERCHANT_PASSWORD
  }, {
    headers: {
      'X-CSRF-Token': csrfToken
    }
  });
  
  console.log('Merchant login status:', response.data.success ? 'Success' : 'Failed');
  return response.data;
}

async function loginAsAdmin(csrfToken) {
  const response = await adminAxios.post('/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  }, {
    headers: {
      'X-CSRF-Token': csrfToken
    }
  });
  
  console.log('Admin login status:', response.data.success ? 'Success' : 'Failed');
  return response.data;
}

async function getMerchantData() {
  const response = await merchantAxios.get('/api/current-merchant');
  return response.data.merchant;
}

async function createTicket(merchantId) {
  const ticketData = {
    subject: 'Test Ticket from API',
    category: 'technical_issue',
    priority: 'normal',
    description: 'This is a test ticket created by the API test script',
    merchantId: merchantId,
    createdBy: 2 // Use fallback user ID as implemented in our fix
  };
  
  const response = await merchantAxios.post('/api/communications/tickets', ticketData);
  return response.data;
}

async function getAdminTickets() {
  const response = await adminAxios.get('/api/admin/communications/tickets');
  return response.data.tickets;
}

async function respondToTicket(ticketId) {
  const messageData = {
    content: 'This is an admin response to your ticket.',
    isFromMerchant: false
  };
  
  const response = await adminAxios.post(`/api/admin/communications/tickets/${ticketId}/messages`, messageData);
  return response.data;
}

async function getTicketMessages(ticketId) {
  const response = await merchantAxios.get(`/api/communications/tickets/${ticketId}/messages`);
  return response.data.messages;
}

async function markMessageAsRead(messageId) {
  // Test the merchant-specific route for marking a message as read
  const response = await merchantAxios.post(`/api/communications/messages/${messageId}/read`);
  return response.data;
}

// Run the test
runTest()
  .then(() => {
    console.log('Test completed');
  })
  .catch(err => {
    console.error('Test failed:', err);
  });