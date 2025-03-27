/**
 * Test script for the communications API endpoints
 * This script provides a direct way to test communications endpoints
 */
import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Base URL for API requests
const BASE_URL = 'http://localhost:5001/api'; // Using 5001 as port 5000 was in use

// Get the current file path and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the authentication cookie from the cookies.txt file
function getAuthCookie() {
  try {
    const cookiesPath = new URL('cookies.txt', import.meta.url).pathname;
    if (fs.existsSync(cookiesPath)) {
      const cookiesContent = fs.readFileSync(cookiesPath, 'utf8');
      const cookies = cookiesContent.split('\n')
        .filter(line => line.trim() !== '')
        .map(line => line.trim());
      
      if (cookies.length > 0) {
        return cookies[0];
      }
    } else {
      // Try relative path as fallback
      const relativePath = './cookies.txt';
      if (fs.existsSync(relativePath)) {
        const cookiesContent = fs.readFileSync(relativePath, 'utf8');
        const cookies = cookiesContent.split('\n')
          .filter(line => line.trim() !== '')
          .map(line => line.trim());
        
        if (cookies.length > 0) {
          return cookies[0];
        }
      }
    }
  } catch (error) {
    console.error('Error reading cookie file:', error.message);
  }
  
  return null;
}

/**
 * Test the communications/merchant/unread-count endpoint
 */
async function testUnreadCountEndpoint() {
  console.log('\n--- Testing Merchant Unread Messages Count Endpoint ---');
  
  const cookie = getAuthCookie();
  if (!cookie) {
    console.error('Authentication cookie not found. Please login first and ensure cookies.txt exists.');
    return;
  }
  
  try {
    const response = await axios.get(`${BASE_URL}/communications/merchant/unread-count`, {
      headers: {
        'Cookie': cookie
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    console.log('Unread message count:', response.data.count);
    
    return true;
  } catch (error) {
    handleApiError(error);
    return false;
  }
}

/**
 * Test the communications/merchant endpoint to get all conversations
 */
async function testGetAllConversationsEndpoint() {
  console.log('\n--- Testing Get All Merchant Conversations Endpoint ---');
  
  const cookie = getAuthCookie();
  if (!cookie) {
    console.error('Authentication cookie not found. Please login first and ensure cookies.txt exists.');
    return;
  }
  
  try {
    const response = await axios.get(`${BASE_URL}/communications/merchant`, {
      headers: {
        'Cookie': cookie
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    console.log('Number of conversations:', response.data.success ? 
      (response.data.data ? response.data.data.length : 0) : 'N/A');
    
    return true;
  } catch (error) {
    handleApiError(error);
    return false;
  }
}

/**
 * Handle API errors in a consistent way
 */
function handleApiError(error) {
  console.error('API Error:');
  
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.error('Status:', error.response.status);
    console.error('Response data:', error.response.data);
  } else if (error.request) {
    // The request was made but no response was received
    console.error('No response received from server');
  } else {
    // Something happened in setting up the request that triggered an Error
    console.error('Error message:', error.message);
  }
  
  if (error.config) {
    console.error('Request URL:', error.config.url);
    console.error('Request method:', error.config.method);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Communications API Test Script ===');
  
  // Test unread count endpoint
  const unreadCountResult = await testUnreadCountEndpoint();
  
  // Test get all conversations endpoint
  const allConversationsResult = await testGetAllConversationsEndpoint();
  
  // Summary
  console.log('\n=== Test Summary ===');
  console.log('Unread count endpoint test:', unreadCountResult ? 'Passed ✓' : 'Failed ✗');
  console.log('All conversations endpoint test:', allConversationsResult ? 'Passed ✓' : 'Failed ✗');
}

// Run the main function
main().catch(error => {
  console.error('Uncaught error in main:', error);
});