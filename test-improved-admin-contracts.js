/**
 * Improved test script for the contracts API endpoints using admin credentials
 * With better session handling
 */

import fs from 'fs';
import axios from 'axios';
import { URL } from 'url';

// Admin credentials
const ADMIN_EMAIL = 'admin@shifi.com';
const ADMIN_PASSWORD = 'admin123';

// Base URL for API requests
const API_BASE_URL = 'http://localhost:5000/api';

// Cookie jar to store cookies between requests
let cookieJar = {};

// Function to save cookies to file and update cookie jar
function saveCookies(response) {
  if (response && response.headers && response.headers['set-cookie']) {
    const cookies = response.headers['set-cookie'];
    
    // Log cookies for debugging
    console.log('Got cookies:', cookies);
    
    // Update cookie jar
    cookies.forEach(cookie => {
      const [cookieMain] = cookie.split(';');
      const [cookieName, cookieValue] = cookieMain.split('=');
      cookieJar[cookieName] = cookieValue;
    });
    
    // Save to file
    fs.writeFileSync('admin-cookies.txt', cookies.join('\n'));
    console.log('Cookies saved to admin-cookies.txt');
  }
}

// Function to load cookies from file
function loadCookies() {
  if (fs.existsSync('admin-cookies.txt')) {
    const cookieText = fs.readFileSync('admin-cookies.txt', 'utf8');
    console.log('Cookies loaded from admin-cookies.txt');
    
    // Update cookie jar
    cookieText.split('\n').forEach(cookie => {
      if (cookie) {
        const [cookieMain] = cookie.split(';');
        const [cookieName, cookieValue] = cookieMain.split('=');
        cookieJar[cookieName] = cookieValue;
      }
    });
    
    return cookieText.split('\n');
  }
  return [];
}

// Function to get cookie string from the jar
function getCookieString() {
  return Object.entries(cookieJar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

// Function to get CSRF token
async function getCsrfToken() {
  console.log('Getting CSRF token...');
  try {
    const response = await axios.get(`${API_BASE_URL}/csrf-token`, {
      headers: {
        'Cookie': getCookieString()
      },
      withCredentials: true
    });
    
    // Save any cookies
    saveCookies(response);
    
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    throw error;
  }
}

// Function to login as admin
async function loginAsAdmin() {
  console.log('Logging in as admin...');
  try {
    // Load existing cookies
    loadCookies();
    
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    
    // Login request
    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        userType: 'admin'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': getCookieString()
        },
        withCredentials: true
      }
    );
    
    // Save cookies from login response
    saveCookies(response);
    
    console.log('Login successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login failed:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    throw error;
  }
}

// Function to test contracts API
async function testContracts() {
  console.log('Testing contracts endpoint as admin...');
  try {
    // Get CSRF token after login
    const csrfToken = await getCsrfToken();
    
    console.log('Getting all contracts as admin...');
    const response = await axios.get(
      `${API_BASE_URL}/contracts?admin=true`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': getCookieString()
        },
        withCredentials: true
      }
    );
    
    // Log number of contracts
    console.log('Got contracts:', response.data);
    console.log('Total contracts:', response.data.contracts.length);
    
    // Show the first contract details
    if (response.data.contracts.length > 0) {
      console.log('First contract:', response.data.contracts[0]);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error testing contracts:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    return error.response?.data;
  }
}

// Main function
async function main() {
  console.log('Starting contract API test as admin...\n');
  
  try {
    await loginAsAdmin();
    await testContracts();
  } catch (error) {
    console.error('Test failed:', error.message);
  }
  
  console.log('\nTest completed');
}

// Run the main function
main();