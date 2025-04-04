/**
 * Test script for the merchant message read endpoint
 */

import fetch from 'node-fetch';
import { db } from './server/db/index.js';  // Corrected import path
import { users, messages, conversations, merchants } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import { generateJwtToken } from './server/services/auth.js';

const BASE_URL = 'http://localhost:5000';

async function main() {
  try {
    console.log('Testing merchant message read endpoint...');
    
    // Find a merchant user
    const merchantUser = await db.query.users.findFirst({
      where: eq(users.role, 'merchant'),
      limit: 1
    });
    
    if (!merchantUser) {
      console.error('No merchant user found in database');
      return;
    }
    
    console.log(`Found merchant user: ${merchantUser.id} (${merchantUser.email})`);
    
    // Generate a JWT token for this user
    const token = generateJwtToken(merchantUser);
    console.log(`Generated JWT token for merchant user`);
    
    // Find messages associated with the merchant
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.userId, merchantUser.id),
      limit: 1
    });
    
    if (!merchant) {
      console.error('No merchant profile found for the user');
      return;
    }
    
    console.log(`Found merchant profile with ID: ${merchant.id}`);
    
    // Find a conversation for this merchant
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.merchantId, merchant.id)
    });
    
    if (!conversation) {
      console.error('No conversation found for this merchant');
      return;
    }
    
    console.log(`Found conversation ID: ${conversation.id}`);
    
    // Find a message in this conversation
    const message = await db.query.messages.findFirst({
      where: eq(messages.conversationId, conversation.id)
    });
    
    if (!message) {
      console.error('No messages found in this conversation');
      return;
    }
    
    console.log(`Found message ID: ${message.id}`);
    
    // Now test the endpoint
    console.log(`Testing message read endpoint with conversation ID ${conversation.id} and message ID ${message.id}`);
    
    const response = await fetch(`${BASE_URL}/api/merchant/communications/${conversation.id}/messages/${message.id}/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-CSRF-Bypass': 'test-merchant-setup'
      }
    });
    
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('Test successful! Message marked as read.');
    } else {
      console.error('Test failed:', data.message);
    }
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    // Close any open connections
    process.exit(0);
  }
}

main().catch(console.error);