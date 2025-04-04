/**
 * A simplified test script to test only the message read endpoint
 */
const axios = require('axios');
const fs = require('fs');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const MESSAGE_ID = 1; // This is the ID of the message we just created

// Login details
const EMAIL = 'brandon@shilohfinance.com';
const PASSWORD = 'Password123!';

async function loginAsMerchant() {
  try {
    console.log('Logging in as merchant...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Bypass': 'test-merchant-message-read' // Special header to bypass CSRF for testing
      }
    });

    // Extract cookies
    if (response.headers['set-cookie']) {
      const cookieString = response.headers['set-cookie'].join('; ');
      console.log('Login successful, cookies received');
      return cookieString;
    }

    console.error('No cookies received during login');
    return null;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    return null;
  }
}

async function testMarkMessageAsRead(messageId, cookies) {
  try {
    console.log(`Testing marking message ${messageId} as read...`);
    
    // Test a sample conversation ID
    const conversationId = 1; // Use our test conversation ID
    
    // Try PATCH endpoint first (the one that's implemented in the code)
    const patchResponse = await axios.patch(
      `${BASE_URL}/communications/merchant/${conversationId}/messages/${messageId}/read`, 
      {}, 
      { 
        headers: {
          'Cookie': cookies,
          'X-CSRF-Bypass': 'test-merchant-message-read' // Special header to bypass CSRF for testing
        }
      }
    );
    
    console.log('PATCH endpoint response:', patchResponse.data);
    return true;
  } catch (patchError) {
    console.error('Error with PATCH endpoint:', patchError.response?.data || patchError.message);
    
    // Try POST endpoint as fallback
    try {
      console.log('Trying POST endpoint...');
      const response = await axios.post(
        `${BASE_URL}/communications/merchant/messages/${messageId}/read`, 
        {}, 
        { 
          headers: {
            'Cookie': cookies,
            'X-CSRF-Bypass': 'test-merchant-message-read' // Special header to bypass CSRF for testing
          }
        }
      );

      console.log('POST endpoint response:', response.data);
      return true;
    } catch (error) {
      console.error('Error with POST endpoint:', error.response?.data || error.message);
      return false;
    }
  }
}

// Direct database verification to check if a message is read
async function verifyMessageIsRead(messageId) {
  try {
    console.log(`Verifying message ${messageId} is marked as read in the database...`);
    
    // Use a direct SQL query
    const { Pool } = require('pg');
    
    // Create a database connection using environment variable
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    // Query the database directly to check the message's read status
    const { rows } = await pool.query(
      'SELECT id, is_read, read_at FROM messages WHERE id = $1',
      [messageId]
    );
    
    console.log('Database query result:', rows[0] || 'Message not found');
    
    // Close the pool
    await pool.end();
    
    // Return true if the message is_read is true
    return rows.length > 0 && rows[0].is_read === true;
  } catch (error) {
    console.error('Error verifying message read status:', error);
    return false;
  }
}

// Simple test that doesn't require a full conversation flow
async function runDirectTest() {
  console.log('Running direct test for message read endpoint...');
  
  // Login
  const cookies = await loginAsMerchant();
  if (!cookies) {
    console.error('Failed to login. Exiting test.');
    return;
  }
  
  // Test marking message as read with a known message ID
  const success = await testMarkMessageAsRead(MESSAGE_ID, cookies);
  
  if (success) {
    // Verify in the database
    const isReadInDb = await verifyMessageIsRead(MESSAGE_ID);
    if (isReadInDb) {
      console.log('✅ Test passed! Message was successfully marked as read.');
    } else {
      console.log('⚠️ Mixed result: API endpoint worked but database verification failed.');
    }
  } else {
    console.log('❌ Test failed! Could not mark message as read via API.');
  }
}

// Run the test
runDirectTest().catch(error => {
  console.error('Test failed with error:', error);
});