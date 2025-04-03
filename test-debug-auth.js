/**
 * Test script to debug authentication issues with backend API
 * This script adds more detailed logging to see what's happening with cookies and session management
 */

import fs from 'fs';
import axios from 'axios';

// Admin credentials
const ADMIN_EMAIL = 'admin@shifi.com';
const ADMIN_PASSWORD = 'admin123';

// Base URL for API requests
const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  withCredentials: true
});

// Save cookies from response
function saveCookies(response) {
  if (response && response.headers && response.headers['set-cookie']) {
    const cookies = response.headers['set-cookie'];
    console.log('Got cookies in response:', cookies);
    fs.writeFileSync('admin-cookies.txt', cookies.join('\n'));
    console.log('Cookies saved to admin-cookies.txt');
  } else {
    console.log('No cookies found in response headers');
  }
}

// Main function to test authentication flow
async function testAuth() {
  try {
    // Step 1: Get CSRF token
    console.log('Step 1: Getting CSRF token...');
    const csrfResponse = await axios.get(`${API_BASE_URL}/csrf-token`, {
      withCredentials: true
    });
    
    console.log('CSRF response status:', csrfResponse.status);
    console.log('CSRF token:', csrfResponse.data.csrfToken);
    console.log('Response headers:', csrfResponse.headers);
    
    // Save any cookies that were set
    saveCookies(csrfResponse);
    
    const csrfToken = csrfResponse.data.csrfToken;
    
    // Step 2: Login as admin
    console.log('\nStep 2: Logging in as admin...');
    
    // Load cookies from file for the login request
    let cookies = [];
    if (fs.existsSync('admin-cookies.txt')) {
      cookies = fs.readFileSync('admin-cookies.txt', 'utf8').split('\n');
      console.log('Loaded cookies for login request:', cookies);
    }
    
    const loginResponse = await axios.post(
      `${API_BASE_URL}/auth/login`, 
      {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        userType: 'admin'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': cookies.join('; ')
        },
        withCredentials: true
      }
    );
    
    console.log('Login response status:', loginResponse.status);
    console.log('Login response data:', loginResponse.data);
    console.log('Login response headers:', loginResponse.headers);
    
    // Save any new cookies from login
    saveCookies(loginResponse);
    
    // Reload cookies after login
    cookies = [];
    if (fs.existsSync('admin-cookies.txt')) {
      cookies = fs.readFileSync('admin-cookies.txt', 'utf8').split('\n');
      console.log('Loaded cookies after login:', cookies);
    }
    
    // Step 3: Get a new CSRF token after login
    console.log('\nStep 3: Getting new CSRF token after login...');
    
    // Extract the auth token cookie specifically
    const authTokenCookie = cookies.find(cookie => cookie.startsWith('auth_token='));
    console.log('Auth token cookie:', authTokenCookie);
    
    const newCsrfResponse = await axios.get(`${API_BASE_URL}/csrf-token`, {
      headers: {
        'Cookie': cookies.join('; ')
      },
      withCredentials: true
    });
    
    console.log('New CSRF response status:', newCsrfResponse.status);
    console.log('New CSRF token:', newCsrfResponse.data.csrfToken);
    
    // Update CSRF token and save new cookies
    const newCsrfToken = newCsrfResponse.data.csrfToken;
    saveCookies(newCsrfResponse);
    
    // Reload cookies again
    if (fs.existsSync('admin-cookies.txt')) {
      cookies = fs.readFileSync('admin-cookies.txt', 'utf8').split('\n');
      console.log('Loaded cookies before contracts request:', cookies);
    }
    
    // Step 4: Try to access contracts endpoint
    console.log('\nStep 4: Accessing contracts endpoint...');
    const contractsResponse = await axios.get(
      `${API_BASE_URL}/contracts?admin=true`,
      {
        headers: {
          'X-CSRF-Token': newCsrfToken,
          'Cookie': cookies.join('; ')
        },
        withCredentials: true
      }
    );
    
    console.log('Contracts response status:', contractsResponse.status);
    console.log('Number of contracts returned:', 
                contractsResponse.data && contractsResponse.data.contracts 
                ? contractsResponse.data.contracts.length 
                : 0);
    
  } catch (error) {
    console.error('Error during test:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    }
  }
}

// Run the test
console.log('Starting authentication debug test...\n');
testAuth()
  .then(() => console.log('\nTest completed'))
  .catch(error => console.error('Unexpected error:', error));