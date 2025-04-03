/**
 * Debug script for the /api/merchants/current endpoint 
 * This script logs in as a merchant and attempts to fetch
 * the current merchant details with detailed debugging
 */

import axios from 'axios';
import fs from 'fs';
import { Buffer } from 'buffer';

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

// Helper to extract CSRF token
async function getCsrfToken() {
  try {
    const response = await api.get('/auth/csrf-token');
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    throw new Error('Failed to get CSRF token');
  }
}

// Login as a merchant
async function loginAsMerchant() {
  try {
    const csrfToken = await getCsrfToken();
    
    console.log('Attempting to login as merchant...');
    const response = await api.post('/auth/login', {
      email: 'brandon@shilohfinance.com',
      password: 'Password123!'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    // Save cookies for future requests
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      saveCookies(cookies.join('; '));
    }
    
    console.log('Login successful!');
    return { csrfToken, cookies };
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw new Error('Login failed');
  }
}

// Get current merchant with debug info
async function getCurrentMerchant(csrfToken) {
  try {
    const cookies = loadCookies();
    
    console.log('Fetching /api/merchants/current...');
    console.log('Using CSRF token:', csrfToken);
    console.log('Using cookies:', cookies);
    
    // Create a direct Axios instance without the /api prefix in baseURL
    const directApi = axios.create({
      baseURL: 'http://localhost:5000'
    });
    
    console.log('Full URL will be:', 'http://localhost:5000/api/merchants/current');
    const response = await directApi.get('/api/merchants/current', {
      headers: {
        'Cookie': cookies,
        'X-CSRF-Token': csrfToken
      }
    });
    
    console.log('Current merchant data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error fetching current merchant:', error.response?.status, JSON.stringify(error.response?.data, null, 2));
    if (error.response?.status === 400) {
      console.error('400 Bad Request error - this suggests a problem with the request parameters');
      console.error('Debug info in response:', error.response.data?.debug ? JSON.stringify(error.response.data.debug, null, 2) : 'No debug info available');
    }
    
    // Log additional request details for debugging
    console.error('Request details:', {
      url: error.config?.url,
      method: error.config?.method,
      headers: error.config?.headers,
      baseURL: error.config?.baseURL
    });
    
    throw new Error(`Failed to get current merchant: ${error.response?.status} ${error.response?.statusText}`);
  }
}

// Check the JWT token content
async function checkJwtToken() {
  try {
    const cookies = loadCookies();
    const cookieObj = {};
    
    // Parse cookies into an object
    cookies.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      cookieObj[name] = value;
    });
    
    console.log('Cookies found:', Object.keys(cookieObj));
    
    // Get the auth token from cookies
    const token = cookieObj.auth_token || cookieObj.token;
    
    if (!token) {
      console.error('No authentication token found in cookies');
      return;
    }
    
    // Get token parts without trying to verify
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Token does not appear to be a valid JWT');
      return;
    }
    
    // Decode the payload (middle part)
    const payload = Buffer.from(parts[1], 'base64').toString();
    
    try {
      const decoded = JSON.parse(payload);
      console.log('JWT token payload:', JSON.stringify(decoded, null, 2));
      console.log('User ID type:', typeof decoded.userId);
      console.log('User ID value:', decoded.userId);
    } catch (e) {
      console.error('Failed to parse JWT payload:', e);
    }
  } catch (error) {
    console.error('Error checking JWT token:', error);
  }
}

// Run the test
async function main() {
  try {
    // Login as merchant first
    const { csrfToken } = await loginAsMerchant();
    
    // Check what's in the JWT token
    await checkJwtToken();
    
    // Try to get current merchant
    await getCurrentMerchant(csrfToken);
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

main();