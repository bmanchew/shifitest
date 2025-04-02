import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Set up axios with cookies for authentication
const cookieJar = {};
const instance = axios.create({
  baseURL: 'http://localhost:5000',
  validateStatus: () => true // Don't throw on any status code
});

// Utility function to save cookies from response
function saveCookies(response) {
  const cookies = response.headers['set-cookie'];
  if (cookies) {
    cookies.forEach(cookie => {
      const [name, ...rest] = cookie.split(';')[0].split('=');
      cookieJar[name] = rest.join('=');
    });
  }
}

// Utility function to add cookies to request
function setCookies(config) {
  const cookies = Object.entries(cookieJar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  
  if (cookies) {
    config.headers.Cookie = cookies;
  }
  return config;
}

// Add request and response interceptors
instance.interceptors.request.use(setCookies);
instance.interceptors.response.use(
  response => {
    saveCookies(response);
    return response;
  },
  error => {
    if (error.response) {
      saveCookies(error.response);
    }
    return Promise.reject(error);
  }
);

// Test function to check the unread message count endpoint
async function testUnreadMessageCount() {
  console.log('Starting unread message count test...');
  try {
    // 1. First login as a merchant
    console.log('Logging in as a merchant...');
    const loginResponse = await instance.post('/api/auth/login', {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@shifi.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'admin123'
    });
    
    if (loginResponse.status !== 200 || !loginResponse.data.success) {
      console.error('Login failed:', loginResponse.data);
      return;
    }
    
    console.log('Login successful! User ID:', loginResponse.data.user.id);
    
    // 2. Get the unread message count
    console.log('Fetching unread message count...');
    const countResponse = await instance.get('/api/communications/merchant/unread-count');
    
    if (countResponse.status !== 200) {
      console.error('Failed to get unread count:', countResponse.data);
      return;
    }
    
    console.log('Success! Unread message count:', countResponse.data.count);
    console.log('Full response:', JSON.stringify(countResponse.data, null, 2));
    
    // 3. Get conversations for the merchant
    console.log('Fetching merchant conversations...');
    const conversationsResponse = await instance.get('/api/communications/merchant');
    
    if (conversationsResponse.status !== 200) {
      console.error('Failed to get merchant conversations:', conversationsResponse.data);
      return;
    }
    
    console.log(`Found ${conversationsResponse.data.conversations.length} conversations`);
    
    // Log the total number of unread messages by manual calculation
    let manualUnreadCount = 0;
    for (const conversation of conversationsResponse.data.conversations) {
      if (conversation.status !== 'active') continue;
      
      console.log(`Fetching messages for conversation ${conversation.id}`);
      const messagesResponse = await instance.get(`/api/communications/merchant/${conversation.id}/messages`);
      
      if (messagesResponse.status !== 200) {
        console.error(`Failed to get messages for conversation ${conversation.id}:`, messagesResponse.data);
        continue;
      }
      
      const messages = messagesResponse.data.messages;
      console.log(`Found ${messages.length} messages in conversation ${conversation.id}`);
      
      // Count unread messages not sent by merchant
      const unreadMessages = messages.filter(msg => !msg.isRead && msg.senderId !== loginResponse.data.user.id);
      manualUnreadCount += unreadMessages.length;
      
      console.log(`Conversation ${conversation.id} has ${unreadMessages.length} unread messages`);
    }
    
    console.log(`Manual unread count: ${manualUnreadCount}`);
    console.log(`API unread count: ${countResponse.data.count}`);
    
    if (manualUnreadCount === countResponse.data.count) {
      console.log('✅ TEST PASSED: Unread counts match!');
    } else {
      console.log('❌ TEST FAILED: Unread counts do not match!');
    }
    
  } catch (error) {
    console.error('Error during test:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testUnreadMessageCount().catch(console.error);