const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const fs = require('fs');
const path = require('path');

// Create a cookie jar for session management
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

// Base URL for API requests
const baseUrl = 'http://localhost:5000/api';

async function loginAsMerchant() {
  console.log('Attempting to login as merchant...');
  try {
    const response = await client.post(`${baseUrl}/auth/login`, {
      email: 'brandon@shilohfinance.com',
      password: 'Password123!'
    });

    if (response.data.success) {
      console.log('Successfully logged in as merchant:', response.data.user.email);
      console.log('User ID:', response.data.user.id);
      
      // Check if this user is associated with a merchant
      const merchantCheckResponse = await client.get(`${baseUrl}/merchants/current`);
      if (merchantCheckResponse.data.success) {
        console.log('Merchant details:', merchantCheckResponse.data.merchant);
        return merchantCheckResponse.data.merchant;
      } else {
        console.error('User logged in but not associated with any merchant');
        return null;
      }
    } else {
      console.error('Login failed:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('Error during login:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

async function getUnreadMessageCount(merchantId) {
  console.log(`Fetching unread message count for merchant ID: ${merchantId}...`);
  try {
    // Try the merchant endpoint that should work for the logged-in merchant
    const response = await client.get(`${baseUrl}/communications/merchant/unread-count`);
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`Unread message count: ${response.data.unreadCount}`);
      
      // Try also the admin endpoint that requires merchantId parameter
      console.log(`Now testing the admin endpoint with merchantId parameter...`);
      const adminEndpointResponse = await client.get(`${baseUrl}/communications/merchant/${merchantId}/unread-count`);
      console.log('Admin endpoint response:', JSON.stringify(adminEndpointResponse.data, null, 2));
      
      return response.data.unreadCount;
    } else {
      console.error('Failed to get unread message count:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('Error getting unread message count:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

async function run() {
  try {
    // Login as merchant
    const merchant = await loginAsMerchant();
    
    // Use merchantId 49 for testing - this is the known merchant ID for ShilohFinance
    const merchantId = 49;
    console.log(`Using merchant ID ${merchantId} for testing since current endpoint failed`);
    
    // Get unread message count
    await getUnreadMessageCount(merchantId);
    
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

// Run the test
run();