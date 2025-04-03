/**
 * This script tests the fix for the merchant authentication flow
 * 1. Logs in as a merchant
 * 2. Retrieves the current merchant data from the merchant-dashboard endpoint
 * 3. Stores the data in localStorage
 */

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
    return { success: true, userData: response.data };
  } catch (error) {
    console.error('Login failed:', error.response?.status, error.response?.data);
    throw new Error('Login failed');
  }
}

// Test accessing the /merchant-dashboard/current endpoint
async function testMerchantDashboardCurrentEndpoint() {
  try {
    const cookies = loadCookies();
    
    console.log('=== TEST: Direct Axios request to /api/merchant-dashboard/current ===');
    console.log('Using cookies:', cookies);
    
    // Create a new axios instance for this test
    const axiosInstance = axios.create({
      baseURL: 'http://localhost:5000'
    });
    
    const response = await axiosInstance.get('/api/merchant-dashboard/current', {
      headers: {
        'Cookie': cookies
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Store the response data in a way that simulates localStorage
    const userData = {
      id: response.data.merchant.userId,
      email: response.data.merchant.email,
      role: 'merchant',
      name: response.data.merchant.name || 'Unknown Merchant',
      merchantId: response.data.merchant.id
    };
    
    console.log('\nUser data that would be stored in localStorage:', JSON.stringify(userData, null, 2));
    
    fs.writeFileSync('shifi_user.json', JSON.stringify(userData), 'utf8');
    console.log('User data saved to shifi_user.json');
    
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

// Main function
async function main() {
  try {
    // First, login as merchant
    const loginResult = await loginAsMerchant();
    
    // Run the test only if login was successful
    if (loginResult.success) {
      const testResult = await testMerchantDashboardCurrentEndpoint();
      console.log('Test result:', testResult ? 'PASSED' : 'FAILED');
    }
    
    console.log('All tests completed');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the main function
main();