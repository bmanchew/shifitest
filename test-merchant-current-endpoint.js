/**
 * This script tests the /api/merchants/current endpoint
 * It logs in as a merchant and attempts to fetch the current merchant details
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

// API base URL
const API_URL = 'http://localhost:5000/api';
const cookiesPath = 'merchant-cookies.txt';

// Axios instance with cookie support
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Helper to load cookies if available
function loadCookies() {
  try {
    if (fs.existsSync(cookiesPath)) {
      const cookies = fs.readFileSync(cookiesPath, 'utf8');
      return cookies.trim();
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
  return '';
}

// Helper to save cookies
function saveCookies(cookieString) {
  try {
    fs.writeFileSync(cookiesPath, cookieString);
    console.log('Cookies saved successfully');
  } catch (error) {
    console.error('Error saving cookies:', error);
  }
}

// Add cookies to every request
api.interceptors.request.use(config => {
  const cookies = loadCookies();
  if (cookies) {
    config.headers.Cookie = cookies;
  }
  return config;
});

// Save cookies from responses
api.interceptors.response.use(response => {
  const cookies = response.headers['set-cookie'];
  if (cookies) {
    saveCookies(cookies.join('; '));
  }
  return response;
});

// Helper to get CSRF token
async function getCsrfToken() {
  try {
    const response = await api.get('/csrf-token');
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    throw error;
  }
}

// Login as a merchant
async function loginAsMerchant() {
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await api.post('/auth/login', {
      email: 'brandon@shilohfinance.com',
      password: 'Password123!'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    console.log('Login successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
}

// Fetch current merchant data
async function fetchCurrentMerchant() {
  try {
    console.log('Fetching current merchant data...');
    const csrfToken = await getCsrfToken();
    
    const response = await api.get('/merchants/current', {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    console.log('Current merchant data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error fetching current merchant:', 
      error.response?.status, 
      error.response?.data || error.message
    );
    throw error;
  }
}

// Main function to run the test
async function runTest() {
  try {
    // First login as a merchant
    await loginAsMerchant();
    
    // Then fetch the current merchant data
    await fetchCurrentMerchant();
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
runTest();