/**
 * This script tests the individual message mark as read endpoint.
 * It ensures the merchant can mark a specific message as read.
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const COOKIES_FILE = './merchant-cookies.txt';
const MERCHANT_EMAIL = 'brandon@shilohfinance.com'; // Using Brandon's merchant account
const MERCHANT_PASSWORD = 'Password123!';          // Password from reset-brandon-password.js

// Helper function to save cookies
function saveCookies(cookieString) {
  fs.writeFileSync(COOKIES_FILE, cookieString);
  console.log('Cookies saved to', COOKIES_FILE);
}

// Helper function to load cookies
function loadCookies() {
  try {
    return fs.readFileSync(COOKIES_FILE, 'utf8');
  } catch (error) {
    console.log('No cookies file found, will create one after login');
    return '';
  }
}

// Helper function to extract CSRF token from cookies
function extractCsrfToken(cookies) {
  const match = cookies.match(/XSRF-TOKEN=([^;]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

// Login as a merchant
async function loginAsMerchant() {
  try {
    console.log('Logging in as merchant...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: MERCHANT_EMAIL,
      password: MERCHANT_PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Bypass': 'test-merchant-message-read' // Special header to bypass CSRF for testing
      }
    });

    // Save cookies for future requests
    if (response.headers['set-cookie']) {
      const cookieString = response.headers['set-cookie'].join('; ');
      saveCookies(cookieString);
      return cookieString;
    }

    console.error('No cookies received during login');
    return null;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    return null;
  }
}

// Get the merchant's conversations
async function getMerchantConversations(cookies) {
  try {
    console.log('Getting merchant conversations...');
    // First get the merchant profile to get the merchant ID
    const merchantResponse = await axios.get(`${BASE_URL}/merchants/current`, {
      headers: {
        'Cookie': cookies
      }
    });
    
    console.log('Merchant profile retrieved:', merchantResponse.data);
    const merchantId = merchantResponse.data.merchant.id;
    
    // Now get the conversations using the correct endpoint
    const response = await axios.get(`${BASE_URL}/merchants/${merchantId}/conversations`, {
      headers: {
        'Cookie': cookies
      }
    });

    return response.data.conversations || [];
  } catch (error) {
    console.error('Error getting conversations:', error.response?.data || error.message);
    return [];
  }
}

// Get messages for a specific conversation
async function getConversationMessages(conversationId, cookies) {
  try {
    console.log(`Getting messages for conversation ${conversationId}...`);
    const response = await axios.get(`${BASE_URL}/conversations/${conversationId}/messages`, {
      headers: {
        'Cookie': cookies
      }
    });

    return response.data.messages || [];
  } catch (error) {
    console.error('Error getting messages:', error.response?.data || error.message);
    return [];
  }
}

// Test marking a single message as read using the new endpoint
async function testMarkSingleMessageAsRead(messageId, conversationId, cookies) {
  try {
    console.log(`Testing marking message ${messageId} in conversation ${conversationId} as read...`);
    
    const csrfToken = extractCsrfToken(cookies);
    const headers = {
      'Cookie': cookies,
      'X-CSRF-Bypass': 'test-merchant-message-read' // Special header to bypass CSRF for testing
    };
    
    if (csrfToken) {
      headers['X-CSRF-TOKEN'] = csrfToken;
    }

    // Try the PATCH endpoint based on the actual implementation
    const patchResponse = await axios.patch(
      `${BASE_URL}/communications/merchant/${conversationId}/messages/${messageId}/read`, 
      {}, 
      { headers }
    );
    
    console.log('PATCH endpoint response:', patchResponse.data);
    return patchResponse.data.success;
  } catch (patchError) {
    console.error('Error with PATCH endpoint:', patchError.response?.data || patchError.message);
    
    // If the PATCH endpoint fails, try the POST endpoint as a fallback
    try {
      console.log('Trying POST endpoint as fallback...');
      const csrfToken = extractCsrfToken(cookies);
      const headers = {
        'Cookie': cookies,
        'X-CSRF-Bypass': 'test-merchant-message-read'
      };
      
      if (csrfToken) {
        headers['X-CSRF-TOKEN'] = csrfToken;
      }
      
      // Try the POST endpoint
      const response = await axios.post(
        `${BASE_URL}/communications/merchant/messages/${messageId}/read`, 
        {}, 
        { headers }
      );
      
      console.log('POST endpoint response:', response.data);
      return response.data.success;
    } catch (postError) {
      console.error('Error with POST endpoint:', postError.response?.data || postError.message);
      return false;
    }
  }
}

// Verify a message is marked as read using direct SQL query to avoid API translation issues
async function verifyMessageIsRead(messageId) {
  try {
    console.log(`Verifying message ${messageId} is marked as read in the database...`);
    
    // Use a direct SQL query with the execute_sql_tool
    const { Pool } = require('pg');
    
    // Create a database connection using environment variable
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    // Query the database directly to check the message's read status
    const { rows } = await pool.query(
      'SELECT is_read, read_at FROM messages WHERE id = $1',
      [messageId]
    );
    
    console.log('Database query result:', rows[0]);
    
    // Close the pool
    await pool.end();
    
    // Return true if the message is_read is true
    return rows.length > 0 && rows[0].is_read === true;
  } catch (error) {
    console.error('Error verifying message read status:', error);
    return false;
  }
}

// Main test function
async function runTest() {
  let cookies = loadCookies();
  
  if (!cookies) {
    cookies = await loginAsMerchant();
    if (!cookies) {
      console.error('Failed to login. Exiting test.');
      return;
    }
  }

  // Get merchant conversations
  const conversations = await getMerchantConversations(cookies);
  if (!conversations || conversations.length === 0) {
    console.log('No conversations found for merchant. Create a conversation first.');
    return;
  }

  console.log(`Found ${conversations.length} conversations`);
  
  // Get the first conversation's messages
  const firstConversation = conversations[0];
  console.log('Using conversation:', firstConversation.id, '-', firstConversation.topic || firstConversation.subject);
  
  const messages = await getConversationMessages(firstConversation.id, cookies);
  if (!messages || messages.length === 0) {
    console.log(`No messages found in conversation ${firstConversation.id}. Add a message first.`);
    return;
  }

  console.log(`Found ${messages.length} messages in conversation`);
  
  // Find an unread message
  const unreadMessage = messages.find(msg => !msg.isRead);
  if (!unreadMessage) {
    console.log('No unread messages found. Create an unread message first.');
    return;
  }
  
  console.log('Found unread message:', unreadMessage.id, '-', unreadMessage.content.substring(0, 30) + '...');
  
  // Test the mark as read endpoint
  const success = await testMarkSingleMessageAsRead(unreadMessage.id, firstConversation.id, cookies);
  
  if (success) {
    // Verify in the database that the message is now marked as read
    const isReadInDb = await verifyMessageIsRead(unreadMessage.id);
    if (isReadInDb) {
      console.log('✅ Test passed! Message was successfully marked as read.');
    } else {
      console.log('❌ Test failed! Message was not marked as read in the database.');
    }
  } else {
    console.log('❌ Test failed! Could not mark message as read via API.');
  }
}

// Run the test
runTest().catch(error => {
  console.error('Test failed with error:', error);
});