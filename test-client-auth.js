/**
 * This script simulates a more complete client-side auth flow
 * to verify our updated current-merchant endpoints work properly
 * in a browser-like environment.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for the test
const BASE_URL = 'http://localhost:5000';
const COOKIES_FILE = 'test-client-auth-cookies.txt';
const TEST_EMAIL = 'brandon@shilohfinance.com';
const TEST_PASSWORD = 'Password123!';

// In-memory storage for simulating localStorage
const localStorage = {
  _data: {},
  getItem(key) {
    return this._data[key] || null;
  },
  setItem(key, value) {
    this._data[key] = value;
  },
  removeItem(key) {
    delete this._data[key];
  },
  clear() {
    this._data = {};
  }
};

// Helper functions
function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookies = fs.readFileSync(COOKIES_FILE, 'utf8').trim();
      console.log('Loaded cookies:', cookies);
      return cookies;
    }
  } catch (error) {
    console.error('Error loading cookies:', error.message);
  }
  return '';
}

function saveCookies(cookieString) {
  try {
    fs.writeFileSync(COOKIES_FILE, cookieString);
    console.log('Saved cookies to file');
  } catch (error) {
    console.error('Error saving cookies:', error.message);
  }
}

// API request function similar to the client code
async function apiRequest(method, url, data = null) {
  try {
    const cookies = loadCookies();
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookies
      },
      withCredentials: true
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`API Request Error (${method} ${url}):`, error.response?.data || error.message);
    throw error;
  }
}

// Simulated client-side auth functions
async function fetchCsrfToken() {
  try {
    const response = await axios.get(`${BASE_URL}/api/csrf-token`);
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    throw error;
  }
}

async function loginUser(email, password) {
  try {
    // First, get a CSRF token
    const csrfToken = await fetchCsrfToken();
    
    const response = await axios.post(
      `${BASE_URL}/api/auth/login`,
      {
        email,
        password
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      }
    );

    // Save cookies for future requests
    if (response.headers['set-cookie']) {
      const cookieString = response.headers['set-cookie'].join('; ');
      saveCookies(cookieString);
    }

    console.log('Login successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
}

async function storeUserData(user) {
  localStorage.setItem('shifi_user', JSON.stringify(user));
}

async function getCurrentUser() {
  try {
    // First check if we have user data in local storage
    const userData = localStorage.getItem('shifi_user');
    let user = null;

    if (userData) {
      // Parse the existing user data from localStorage
      user = JSON.parse(userData);
      console.log('Found user in localStorage:', user);
    } else {
      try {
        // Try to get user from the server if not in localStorage
        const response = await apiRequest('GET', '/api/auth/current');
        if (response.user) {
          user = response.user;
          console.log('Retrieved user from server:', user);
          storeUserData(user);
        }
      } catch (error) {
        console.error('Failed to get current user from server:', error);
        return null;
      }
    }

    // Attempt to validate the session and get fresh merchant data
    if (user?.role === 'merchant' && !user.merchantId) {
      console.log('Merchant user found without merchantId, attempting to fetch from API');
      
      try {
        // Use the dedicated current-merchant endpoint
        const merchantResponse = await apiRequest('GET', '/api/current-merchant');
        
        if (merchantResponse.success && merchantResponse.data?.id) {
          console.log(`Successfully retrieved merchant ID: ${merchantResponse.data.id}`);
          
          // Update the local user data with merchant information
          user = {
            ...user,
            merchantId: merchantResponse.data.id
          };
          
          // Store the updated user data
          storeUserData(user);
        } else {
          console.warn("First endpoint attempt failed, trying v1 endpoint");
          
          // Try the v1 versioned endpoint as fallback
          const v1Response = await apiRequest('GET', '/api/v1/current-merchant');
          
          if (v1Response.success && v1Response.data?.id) {
            console.log(`Successfully retrieved merchant ID from v1 endpoint: ${v1Response.data.id}`);
            
            // Update the local user data with merchant information
            user = {
              ...user,
              merchantId: v1Response.data.id
            };
            
            // Store the updated user data
            storeUserData(user);
          } else {
            console.warn("Both current-merchant endpoints failed, trying legacy dashboard endpoint");
            
            // Fallback to the merchant-dashboard endpoint as last resort
            const dashboardResponse = await apiRequest('GET', '/api/merchant-dashboard/current');
            
            if (dashboardResponse.success && dashboardResponse.merchant?.id) {
              console.log(`Successfully retrieved merchant ID from dashboard endpoint: ${dashboardResponse.merchant.id}`);
              
              // Update the local user data with merchant information
              user = {
                ...user,
                merchantId: dashboardResponse.merchant.id
              };
              
              // Store the updated user data
              storeUserData(user);
            }
          }
        }
      } catch (error) {
        console.warn("Failed to get current merchant data:", error);
        // We'll continue with the existing user data even if the merchant API call fails
      }
    }
    
    return user;
  } catch (error) {
    console.error("Failed to get current user:", error);
    return null;
  }
}

// Main test function
async function simulateClientAuth() {
  console.log('\n===== Starting Client Auth Simulation =====');
  localStorage.clear();
  
  try {
    // Check if we have existing cookies
    const existingCookies = loadCookies();
    if (!existingCookies) {
      // Login to get cookies and user data
      console.log('No existing cookies, logging in...');
      const loginResult = await loginUser(TEST_EMAIL, TEST_PASSWORD);
      if (loginResult.user) {
        await storeUserData(loginResult.user);
      }
    }
    
    // Get current user and merchant data
    console.log('\n===== Checking Current User =====');
    const user = await getCurrentUser();
    
    console.log('\n===== Final User State =====');
    console.log(JSON.stringify(user, null, 2));
    
    if (user?.merchantId) {
      console.log(`\n✅ SUCCESS: Client auth flow completed successfully with merchantId: ${user.merchantId}`);
      return true;
    } else {
      console.log('\n❌ FAILURE: Client auth flow failed to retrieve merchantId');
      return false;
    }
  } catch (error) {
    console.error('Client auth simulation error:', error);
    return false;
  }
}

// Run the test
simulateClientAuth().then(success => {
  console.log('\nTest completed with result:', success ? 'SUCCESS' : 'FAILURE');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test failed with uncaught error:', error);
  process.exit(1);
});