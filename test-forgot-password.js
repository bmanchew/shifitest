/**
 * Test script for the forgot-password functionality
 */
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

// Create a cookie jar and wrapper for axios
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

/**
 * Get CSRF token from server
 */
async function getCsrfToken() {
  try {
    console.log('Getting CSRF token...');
    
    // First, make a request to get the CSRF token with the cookie jar
    const response = await client.get('http://localhost:5000/api/csrf-token', {
      withCredentials: true
    });
    
    console.log('CSRF token response:', response.data);
    
    // Use csrfToken instead of token
    const token = response.data.csrfToken;
    
    // Check for token in response
    if (!token) {
      console.error('No CSRF token found in response');
      console.log('Full response:', response);
    }
    
    // Get cookies from the jar
    const cookies = await jar.getCookies('http://localhost:5000');
    console.log('Cookies in jar:', cookies);
    
    console.log('CSRF token retrieved successfully:', token);
    return token;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Test the forgot-password endpoint
 */
async function testForgotPassword() {
  try {
    console.log('Testing forgot-password endpoint...');
    
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    console.log('Using CSRF token:', csrfToken);
    
    // Replace with a test email
    const email = 'test@example.com';
    
    // Make request with CSRF token using the same client with cookie jar
    const response = await client.post('http://localhost:5000/api/auth/forgot-password', 
      { email },
      { 
        headers: {
          'X-CSRF-Token': csrfToken
        },
        withCredentials: true
      }
    );
    
    console.log('Response:', response.status, response.data);
    return response.data;
  } catch (error) {
    console.error('Error testing forgot-password:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await testForgotPassword();
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

main();