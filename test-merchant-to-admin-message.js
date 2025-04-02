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

// Utility function to load cookies from a file
function loadCookies() {
  try {
    if (fs.existsSync('merchant-cookies.txt')) {
      const content = fs.readFileSync('merchant-cookies.txt', 'utf8');
      const savedCookies = JSON.parse(content);
      Object.assign(cookieJar, savedCookies);
      console.log('Loaded cookies from file');
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
}

// Utility function to write cookies to a file
function writeCookies() {
  try {
    fs.writeFileSync('merchant-cookies.txt', JSON.stringify(cookieJar), 'utf8');
    console.log('Saved cookies to file');
  } catch (error) {
    console.error('Error saving cookies:', error);
  }
}

// Add cookies to request
instance.interceptors.request.use(config => {
  const cookies = Object.entries(cookieJar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  
  if (cookies) {
    config.headers['Cookie'] = cookies;
  }
  
  return config;
});

// Save cookies from response
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

// Get CSRF token
async function getCsrfToken() {
  console.log('Getting CSRF token...');
  const response = await instance.get('/api/csrf-token');
  
  if (response.status !== 200 || !response.data.csrfToken) {
    console.error('Failed to get CSRF token:', response.data);
    return null;
  }
  
  console.log('Got CSRF token');
  return response.data.csrfToken;
}

// Login as a merchant
async function loginAsMerchant() {
  console.log('Logging in as a merchant...');
  loadCookies();
  
  // Try to get a protected resource to check if we're already logged in
  const checkResponse = await instance.get('/api/merchant/profile');
  
  if (checkResponse.status === 200 && checkResponse.data.success) {
    console.log('Already logged in as merchant:', checkResponse.data.merchant.id);
    return checkResponse.data.merchant;
  }
  
  // Get CSRF token for login
  const csrfToken = await getCsrfToken();
  if (!csrfToken) return null;
  
  const loginResponse = await instance.post('/api/auth/login', {
    email: process.env.TEST_MERCHANT_EMAIL || 'brandon@shilohfinance.com',
    password: process.env.TEST_MERCHANT_PASSWORD || 'Shiloh123!'
  }, {
    headers: {
      'X-CSRF-Token': csrfToken
    }
  });
  
  if (loginResponse.status !== 200 || !loginResponse.data.success) {
    console.error('Login failed:', loginResponse.data);
    return null;
  }
  
  console.log('Login successful! Merchant ID:', loginResponse.data.user.id);
  writeCookies();
  
  // Get merchant profile to return merchant data
  const profileResponse = await instance.get('/api/merchant/profile');
  if (profileResponse.status === 200 && profileResponse.data.success) {
    return profileResponse.data.merchant;
  }
  
  return { id: loginResponse.data.user.id };
}

// Get merchant's active contracts
async function getMerchantContracts(merchantId) {
  console.log(`Getting contracts for merchant ${merchantId}...`);
  
  const response = await instance.get('/api/merchant/contracts');
  
  if (response.status !== 200 || !response.data.success) {
    console.error('Failed to get contracts:', response.data);
    return [];
  }
  
  const activeContracts = response.data.contracts.filter(c => c.status === 'active');
  console.log(`Found ${activeContracts.length} active contracts`);
  return activeContracts;
}

// Get existing conversations
async function getMerchantConversations() {
  console.log('Getting merchant conversations...');
  
  const response = await instance.get('/api/communications/merchant');
  
  if (response.status !== 200) {
    console.error('Failed to get conversations:', response.data);
    return [];
  }
  
  console.log(`Found ${response.data.conversations.length} conversations`);
  return response.data.conversations;
}

// Create a new conversation as a merchant
async function createNewConversation(contractId) {
  console.log(`Creating new conversation for contract ${contractId}...`);
  
  // Get CSRF token
  const csrfToken = await getCsrfToken();
  if (!csrfToken) return null;
  
  const payload = {
    contractId,
    topic: "Merchant-initiated test conversation",
    message: "This is a test message sent from a merchant to test the messaging system.",
    category: "billing",
    priority: "normal"
  };
  
  const response = await instance.post('/api/communications/merchant', payload, {
    headers: {
      'X-CSRF-Token': csrfToken
    }
  });
  
  if (response.status !== 200 || !response.data.success) {
    console.error('Failed to create conversation:', response.data);
    return null;
  }
  
  console.log('Conversation created successfully!');
  console.log('Conversation data:', response.data);
  
  return response.data.conversation || response.data.id;
}

// Send a message to an existing conversation
async function sendMessageToConversation(conversationId, message) {
  console.log(`Sending message to conversation ${conversationId}...`);
  
  // Get CSRF token
  const csrfToken = await getCsrfToken();
  if (!csrfToken) return false;
  
  const payload = {
    content: message
  };
  
  const response = await instance.post(`/api/communications/merchant/${conversationId}/messages`, payload, {
    headers: {
      'X-CSRF-Token': csrfToken
    }
  });
  
  if (response.status !== 200 || !response.data.success) {
    console.error('Failed to send message:', response.data);
    return false;
  }
  
  console.log('Message sent successfully!');
  return true;
}

// Main test function
async function testMerchantToAdminMessaging() {
  try {
    // 1. Login as merchant
    const merchant = await loginAsMerchant();
    if (!merchant) {
      console.error('Failed to login as merchant');
      return;
    }
    
    // 2. Get merchant's active contracts
    const contracts = await getMerchantContracts(merchant.id);
    if (contracts.length === 0) {
      console.error('No active contracts found for merchant');
      return;
    }
    
    const contractId = contracts[0].id;
    console.log(`Using contract ID ${contractId} for testing`);
    
    // 3. Create a new conversation
    const conversation = await createNewConversation(contractId);
    if (!conversation) {
      console.error('Failed to create conversation');
      return;
    }
    
    const conversationId = conversation.id || conversation;
    console.log(`Created conversation with ID ${conversationId}`);
    
    // 4. Send a follow-up message
    const messageSent = await sendMessageToConversation(
      conversationId, 
      "This is a follow-up message to test if admins receive merchant messages correctly."
    );
    
    if (messageSent) {
      console.log('✅ TEST PASSED: Merchant was able to initiate conversation and send messages');
    } else {
      console.log('❌ TEST FAILED: Could not complete merchant-to-admin messaging test');
    }
    
  } catch (error) {
    console.error('Error during test:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testMerchantToAdminMessaging().catch(console.error);