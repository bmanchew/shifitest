/**
 * Script to test the merchant performances endpoint
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Store cookies for subsequent requests
let cookies = [];

// Save cookies to file
function saveCookies() {
  fs.writeFileSync('admin-cookies.txt', JSON.stringify(cookies));
}

// Load cookies from file if it exists
function loadCookies() {
  try {
    if (fs.existsSync('admin-cookies.txt')) {
      cookies = JSON.parse(fs.readFileSync('admin-cookies.txt'));
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
}

// Get CSRF token
async function getCsrfToken() {
  try {
    const response = await axios.get('http://localhost:5000/api/csrf-token', {
      headers: {
        Cookie: cookies.join('; ')
      },
      withCredentials: true
    });
    
    // Save new cookies if they exist
    if (response.headers['set-cookie']) {
      // Merge cookies instead of replacing
      const newCookies = response.headers['set-cookie'];
      cookies = [...cookies, ...newCookies];
      saveCookies();
    }
    
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    return null;
  }
}

// Login as admin
async function loginAsAdmin() {
  try {
    // Load existing cookies
    loadCookies();
    
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    
    console.log('Obtained CSRF token:', csrfToken);
    
    // Login
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@shifi.com',
      password: 'admin123'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Cookie': cookies.join('; ')
      },
      withCredentials: true
    });
    
    // Save new cookies if they exist
    if (response.headers['set-cookie']) {
      // Merge cookies instead of replacing
      const newCookies = response.headers['set-cookie'];
      cookies = [...cookies, ...newCookies];
      saveCookies();
    }
    
    console.log('Login successful:', response.data);
    return true;
  } catch (error) {
    console.error('Login failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

// Test getting merchant performances
async function testGetMerchantPerformances() {
  try {
    const response = await axios.get('http://localhost:5000/api/admin/merchant-performances', {
      headers: {
        Cookie: cookies.join('; ')
      },
      withCredentials: true
    });
    
    // Save new cookies if they exist
    if (response.headers['set-cookie']) {
      // Merge cookies instead of replacing
      const newCookies = response.headers['set-cookie'];
      cookies = [...cookies, ...newCookies];
      saveCookies();
    }
    
    console.log('Merchant performances data:', JSON.stringify(response.data, null, 2));
    
    // For the old format that had success property, just pass it through
    // For the new format which is just an array, wrap it in an object for backwards compatibility in tests
    if (Array.isArray(response.data)) {
      return { success: true, data: response.data };
    }
    
    return response.data;
  } catch (error) {
    console.error('Error getting merchant performances:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

// Test updating all merchant performances
async function testUpdateAllMerchantPerformances() {
  try {
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    
    const response = await axios.post('http://localhost:5000/api/admin/update-all-merchant-performances', {}, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Cookie': cookies.join('; ')
      },
      withCredentials: true
    });
    
    // Save new cookies if they exist
    if (response.headers['set-cookie']) {
      // Merge cookies instead of replacing
      const newCookies = response.headers['set-cookie'];
      cookies = [...cookies, ...newCookies];
      saveCookies();
    }
    
    console.log('Update all merchant performances result:', JSON.stringify(response.data, null, 2));
    
    // For the old format that had success property, just pass it through
    // For the new format which is just an array, wrap it in an object for backwards compatibility in tests
    if (Array.isArray(response.data)) {
      return { success: true, message: "All merchant performances updated successfully", data: response.data };
    }
    
    return response.data;
  } catch (error) {
    console.error('Error updating all merchant performances:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

// Run tests
async function runTests() {
  console.log('Starting merchant performances API tests...');
  
  // Login
  const loginSuccess = await loginAsAdmin();
  if (!loginSuccess) {
    console.error('Aborting tests because login failed');
    return;
  }
  
  // Get merchant performances
  console.log('\nTesting GET merchant performances endpoint:');
  const performancesData = await testGetMerchantPerformances();
  
  // Changed to check if performancesData is an array (the new format)
  // or if it has the old success property 
  if (performancesData && (Array.isArray(performancesData) || performancesData.success)) {
    // Update all merchant performances
    console.log('\nTesting UPDATE all merchant performances endpoint:');
    await testUpdateAllMerchantPerformances();
    
    // Get merchant performances again to see the update
    console.log('\nGetting merchant performances after update:');
    await testGetMerchantPerformances();
  }
  
  console.log('\nTests completed.');
}

// Run the tests
runTests();