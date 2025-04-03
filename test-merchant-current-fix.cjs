const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API URL
const API_URL = 'http://localhost:5000/api';

// Function to load cookies from file
function loadCookies() {
  try {
    return fs.readFileSync(path.join(__dirname, 'merchant-cookies.txt'), 'utf8');
  } catch (error) {
    console.error('Error loading cookies:', error.message);
    return '';
  }
}

// Function to save cookies to file
function saveCookies(cookies) {
  try {
    fs.writeFileSync(path.join(__dirname, 'merchant-cookies.txt'), cookies);
    console.log('Cookies saved successfully');
  } catch (error) {
    console.error('Error saving cookies:', error.message);
  }
}

// Login as merchant
async function loginAsMerchant() {
  console.log('Attempting to login as merchant...');
  
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'brandon@shilohfinance.com',
      password: 'Password123!'
    });
    
    // Get the auth_token cookie
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      const cookieString = cookies.join('; ');
      saveCookies(cookieString);
    }
    
    console.log('Login successful!');
    return { success: true };
  } catch (error) {
    console.error('Login failed:', error.response?.status, error.response?.data);
    throw new Error('Login failed');
  }
}

// Test accessing the /merchants/current endpoint directly
async function testMerchantsCurrentEndpoint() {
  try {
    const cookies = loadCookies();
    
    console.log('=== TEST 1: Direct Axios request to /api/merchants/current ===');
    console.log('Using cookies:', cookies);
    
    // Create a new axios instance for this test
    const axiosInstance = axios.create({
      baseURL: 'http://localhost:5000'
    });
    
    const response = await axiosInstance.get('/api/merchants/current', {
      headers: {
        'Cookie': cookies
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('Error:', error.response?.status, error.response?.data);
    console.error('Request details:', {
      url: error.config?.url,
      method: error.config?.method,
      headers: error.config?.headers,
      baseURL: error.config?.baseURL
    });
    return false;
  }
}

// Test using the NodeJS http module directly
async function testWithHttpModule() {
  const http = require('http');
  const cookies = loadCookies();
  
  console.log('=== TEST 2: Direct HTTP Module request to /api/merchants/current ===');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/merchants/current',
      method: 'GET',
      headers: {
        'Cookie': cookies
      }
    };
    
    const req = http.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response data:', data);
        try {
          const jsonData = JSON.parse(data);
          console.log('Parsed JSON:', JSON.stringify(jsonData, null, 2));
          resolve(true);
        } catch (e) {
          console.error('Error parsing JSON:', e);
          resolve(false);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      reject(e);
    });
    
    req.end();
  });
}

// Debugging endpoints to trace mounted routes
async function debugServerRoutes() {
  try {
    console.log('=== TEST 3: Checking if merchant router is mounted correctly ===');
    
    // Create a simple axios instance for this test
    const axiosInstance = axios.create({
      baseURL: 'http://localhost:5000'
    });
    
    // Try to access a debug endpoint if available
    try {
      const response = await axiosInstance.get('/api', {
        headers: {
          'Cookie': loadCookies()
        }
      });
      console.log('API root endpoint response:', response.status, response.data);
    } catch (error) {
      console.log('API root endpoint error:', error.response?.status, error.response?.data);
    }
    
    // Try accessing the merchant router root
    try {
      const response = await axiosInstance.get('/api/merchants', {
        headers: {
          'Cookie': loadCookies()
        }
      });
      console.log('Merchant router response:', response.status, response.data);
    } catch (error) {
      console.log('Merchant router error:', error.response?.status, error.response?.data);
    }
    
    return true;
  } catch (error) {
    console.error('Debug server routes error:', error);
    return false;
  }
}

// Main function
async function main() {
  try {
    // First, login as merchant
    await loginAsMerchant();
    
    // Run the tests
    const test1Result = await testMerchantsCurrentEndpoint();
    console.log('Test 1 result:', test1Result ? 'PASSED' : 'FAILED');
    
    const test2Result = await testWithHttpModule();
    console.log('Test 2 result:', test2Result ? 'PASSED' : 'FAILED');
    
    const test3Result = await debugServerRoutes();
    console.log('Test 3 result:', test3Result ? 'PASSED' : 'FAILED');
    
    console.log('All tests completed');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the main function
main();