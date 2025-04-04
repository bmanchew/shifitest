/**
 * Test script for the merchant message read endpoint
 * This version uses raw SQL queries to avoid ESModule/CommonJS compatibility issues
 */

const axios = require('axios');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// JWT secret for generating tokens
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

const BASE_URL = 'http://localhost:5000';

// Function to generate JWT token
function generateJwtToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function main() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('Testing merchant message read endpoint...');
    
    // Find a merchant user using raw SQL
    const userResult = await client.query(
      "SELECT * FROM users WHERE role = 'merchant' LIMIT 1"
    );
    
    if (userResult.rows.length === 0) {
      console.error('No merchant user found in database');
      return;
    }
    
    const merchantUser = userResult.rows[0];
    console.log(`Found merchant user: ${merchantUser.id} (${merchantUser.email})`);
    
    // Generate a JWT token for this user
    const token = generateJwtToken(merchantUser);
    console.log(`Generated JWT token for merchant user`);
    
    // Find merchant profile
    const merchantResult = await client.query(
      'SELECT * FROM merchants WHERE "user_id" = $1 LIMIT 1',
      [merchantUser.id]
    );
    
    if (merchantResult.rows.length === 0) {
      console.error('No merchant profile found for the user');
      return;
    }
    
    const merchant = merchantResult.rows[0];
    console.log(`Found merchant profile with ID: ${merchant.id}`);
    
    // Find a conversation for this merchant
    const conversationResult = await client.query(
      'SELECT * FROM conversations WHERE "merchantId" = $1 LIMIT 1',
      [merchant.id]
    );
    
    if (conversationResult.rows.length === 0) {
      console.error('No conversation found for this merchant');
      return;
    }
    
    const conversation = conversationResult.rows[0];
    console.log(`Found conversation ID: ${conversation.id}`);
    
    // Find a message in this conversation
    const messageResult = await client.query(
      'SELECT * FROM messages WHERE "conversationId" = $1 LIMIT 1',
      [conversation.id]
    );
    
    if (messageResult.rows.length === 0) {
      console.error('No messages found in this conversation');
      return;
    }
    
    const message = messageResult.rows[0];
    console.log(`Found message ID: ${message.id}`);
    
    // Now test the endpoint
    console.log(`Testing message read endpoint with conversation ID ${conversation.id} and message ID ${message.id}`);
    
    try {
      const response = await axios.patch(
        `${BASE_URL}/api/merchant/communications/${conversation.id}/messages/${message.id}/read`, 
        {}, // Empty body
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-CSRF-Bypass': 'test-merchant-message-read'
          }
        }
      );
      
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    
      if (response.status >= 200 && response.status < 300) {
        console.log('Test successful! Message marked as read.');
        
        // Verify the message was marked as read in the database
        const verifyResult = await client.query(
          'SELECT "isRead", "readAt" FROM messages WHERE id = $1',
          [message.id]
        );
        
        if (verifyResult.rows.length > 0) {
          const updatedMessage = verifyResult.rows[0];
          console.log('Database verification:', 
            updatedMessage.isRead ? 'Message is marked as read ✓' : 'Message is NOT marked as read ✗', 
            updatedMessage.readAt ? `ReadAt timestamp: ${updatedMessage.readAt}` : 'No readAt timestamp'
          );
        }
      } else {
        console.error('Test failed:', response.data?.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error during test:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }
  } catch (error) {
    console.error('Error during database operations:', error);
  } finally {
    // Release client back to the pool
    if (client) {
      client.release();
    }
    process.exit(0);
  }
}

main().catch(console.error);