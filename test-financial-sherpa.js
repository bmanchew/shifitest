/**
 * Test script for Financial Sherpa functionality
 * This script tests the initialization of the Financial Sherpa component
 * by calling the realtime endpoint directly
 */

import axios from 'axios';
import WebSocket from 'ws';

// Configuration
const API_URL = 'http://localhost:5000'; // Port 5000 is where our server runs
const TEST_CUSTOMER_ID = 1; // Replace with a valid customer ID from your database

// Global variables
let config = null;
let csrfToken = null;

/**
 * Get a CSRF token
 */
async function getCsrfToken() {
  try {
    console.log('Fetching CSRF token...');
    const response = await axios.get(`${API_URL}/api/csrf-token`, {
      withCredentials: true,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      }
    });
    
    if (response.data && response.data.success) {
      console.log('CSRF token retrieved successfully');
      
      // Save cookies for subsequent requests
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        console.log('Received cookies from server');
        axios.defaults.headers.common['Cookie'] = cookies.join('; ');
      } else {
        console.log('No cookies received from server');
      }
      
      return response.data.csrfToken;
    } else {
      throw new Error('Failed to get CSRF token');
    }
  } catch (error) {
    console.error('Error fetching CSRF token:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    throw error;
  }
}

/**
 * Test the Financial Sherpa realtime initialization endpoint
 */
async function testFinancialSherpaRealtime() {
  try {
    // First get a CSRF token
    csrfToken = await getCsrfToken();
    
    console.log('Testing Financial Sherpa realtime endpoint...');
    
    // Call the realtime endpoint
    console.log(`Using CSRF token: ${csrfToken.substring(0, 8)}...`);
    const response = await axios.post(
      `${API_URL}/api/financial-sherpa/realtime`,
      {
        customerId: TEST_CUSTOMER_ID
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken,
          'X-CSRF-Token': csrfToken, // Include both header formats for compatibility
          'X-CSRF-Bypass': 'test-financial-sherpa' // Add bypass header for testing
        },
        withCredentials: true
      }
    );
    
    if (!response.data || !response.data.success) {
      throw new Error(`API error: ${response.data?.error || 'Unknown error'}`);
    }
    
    console.log('Financial Sherpa realtime endpoint response:', response.data);
    config = response.data;
    
    return config;
  } catch (error) {
    console.error('Error testing Financial Sherpa realtime endpoint:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    throw error;
  }
}

/**
 * Test creating a WebSocket connection
 */
async function testWebSocketConnection() {
  if (!config || !config.wsEndpoint) {
    throw new Error('No WebSocket endpoint available. Run testFinancialSherpaRealtime first.');
  }
  
  return new Promise((resolve, reject) => {
    console.log(`Creating WebSocket connection to: ${API_URL.replace('http', 'ws')}${config.wsEndpoint}`);
    
    const ws = new WebSocket(`${API_URL.replace('http', 'ws')}${config.wsEndpoint}`);
    
    // Connection timeout - use a longer timeout for testing
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, 30000);
    
    ws.on('open', () => {
      console.log('WebSocket connection established successfully!');
      
      // Send create_session message
      const createSessionMessage = {
        type: 'create_session',
        voice: 'alloy',
        instructions: 'You are a friendly and helpful financial assistant for ShiFi Financial.'
      };
      
      console.log('Sending create_session message:', createSessionMessage);
      ws.send(JSON.stringify(createSessionMessage));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Received WebSocket message:', message);
        
        if (message.type === 'welcome') {
          console.log('Received welcome message');
        } else if (message.type === 'session_created') {
          console.log('Session created successfully with ID:', message.sessionId);
          clearTimeout(timeout);
          
          // Close the connection after success
          setTimeout(() => {
            ws.close();
            resolve({ success: true, sessionId: message.sessionId });
          }, 1000);
        } else if (message.type === 'error') {
          console.error('Error from WebSocket server:', message);
          clearTimeout(timeout);
          ws.close();
          reject(new Error(message.message || 'Unknown WebSocket error'));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clearTimeout(timeout);
      reject(error);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`WebSocket connection closed: code=${code}, reason=${reason}`);
    });
  });
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log('Starting Financial Sherpa tests...');
    
    // Test Financial Sherpa realtime initialization
    const realtimeConfig = await testFinancialSherpaRealtime();
    console.log('✅ Financial Sherpa realtime initialization successful');
    
    // Test WebSocket connection
    const wsResult = await testWebSocketConnection();
    console.log('✅ WebSocket connection test successful');
    
    console.log('\n🎉 All tests passed successfully!');
    console.log('The Financial Sherpa feature is working correctly.');
    
    // Print test summary
    console.log('\nTest Summary:');
    console.log('1. Financial Sherpa API endpoint: ✅');
    console.log('2. WebSocket connection: ✅');
    console.log(`3. OpenAI session creation: ✅ (Session ID: ${wsResult.sessionId})`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    
    // Print troubleshooting tips
    console.log('\nTroubleshooting tips:');
    console.log('1. Ensure the server is running on port 5000');
    console.log('2. Check that the OpenAI API key is valid and has access to the Realtime API');
    console.log('3. Verify that CSRF protection is properly configured for WebSocket endpoints');
    console.log('4. Check server logs for more detailed error messages');
    
    process.exit(1);
  }
}

// Run the tests
runTests();