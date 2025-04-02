// Test script to login as merchant and verify access to merchant-only endpoints
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5000';
const CREDENTIALS = {
  email: 'brandon@shilohfinance.com',
  password: 'Password123!'
};

// Store cookies between requests to maintain the session
let cookies = [];

function saveCookies(response) {
  if (response.headers['set-cookie']) {
    cookies = response.headers['set-cookie'];
    fs.writeFileSync('merchant-cookies.txt', cookies.join('\n'));
    console.log('Cookies saved to merchant-cookies.txt');
  }
}

function loadCookies() {
  try {
    if (fs.existsSync('merchant-cookies.txt')) {
      const cookieContent = fs.readFileSync('merchant-cookies.txt', 'utf8');
      cookies = cookieContent.split('\n').filter(c => c.trim() !== '');
      console.log('Loaded cookies from file');
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
}

function setCookies(config) {
  if (cookies.length > 0) {
    config.headers = {
      ...config.headers,
      Cookie: cookies.join('; ')
    };
  }
  return config;
}

// Function to get a CSRF token
async function getCsrfToken() {
  try {
    const response = await axios.get(`${API_URL}/api/csrf-token`);
    console.log('Got CSRF token');
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    throw error;
  }
}

// Function to login as merchant
async function loginAsMerchant() {
  try {
    const csrfToken = await getCsrfToken();
    
    console.log('Attempting to login as merchant:', CREDENTIALS.email);
    const response = await axios.post(`${API_URL}/api/auth/login`, 
      CREDENTIALS,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    saveCookies(response);
    
    if (response.data.success) {
      console.log('✅ Login successful');
      console.log('User details:', response.data.user);
      return response.data.user;
    } else {
      console.error('❌ Login failed:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Login error:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Function to test merchant contracts endpoint
async function testMerchantContracts() {
  try {
    const csrfToken = await getCsrfToken();
    
    console.log('Fetching merchant contracts...');
    const response = await axios.get(
      `${API_URL}/api/merchant/contracts`,
      {
        headers: {
          'X-CSRF-Token': csrfToken
        },
        withCredentials: true
      }
    );
    
    if (response.data.success) {
      console.log('✅ Successfully retrieved merchant contracts');
      console.log(`Found ${response.data.contracts.length} contracts`);
      return response.data.contracts;
    } else {
      console.error('❌ Failed to retrieve contracts:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error retrieving contracts:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Function to test merchant conversations endpoint
async function testMerchantConversations() {
  try {
    const csrfToken = await getCsrfToken();
    
    console.log('Fetching merchant conversations...');
    const response = await axios.get(
      `${API_URL}/api/communications/merchant`,
      {
        headers: {
          'X-CSRF-Token': csrfToken
        },
        withCredentials: true
      }
    );
    
    if (response.data.success) {
      console.log('✅ Successfully retrieved merchant conversations');
      console.log(`Found ${response.data.conversations.length} conversations`);
      return response.data.conversations;
    } else {
      console.error('❌ Failed to retrieve conversations:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error retrieving conversations:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Function to test unread message count endpoint
async function testUnreadMessageCount() {
  try {
    const csrfToken = await getCsrfToken();
    
    console.log('Fetching unread message count...');
    const response = await axios.get(
      `${API_URL}/api/communications/merchant/unread-count`,
      {
        headers: {
          'X-CSRF-Token': csrfToken
        },
        withCredentials: true
      }
    );
    
    if (response.data.success) {
      console.log('✅ Successfully retrieved unread message count');
      console.log(`Unread count: ${response.data.count}`);
      return response.data.count;
    } else {
      console.error('❌ Failed to retrieve unread count:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error retrieving unread count:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Main function to run all tests
async function runTests() {
  // Configure axios to include cookies
  axios.interceptors.request.use(setCookies);
  
  // Load existing cookies if available
  loadCookies();
  
  // Login as merchant
  const user = await loginAsMerchant();
  if (!user) {
    console.error('Cannot proceed with tests due to login failure');
    return;
  }
  
  // Run all tests
  await testMerchantContracts();
  await testMerchantConversations();
  await testUnreadMessageCount();
  
  console.log('All tests completed');
}

// Run all tests
runTests();