/**
 * Simple test for OpenAI WebSocket connection
 * This script tests just the WebSocket connection to verify the basic functionality
 * 
 * Uses vanilla HTTP request to get session configuration and then connects to WebSocket
 */

import http from 'http';
import WebSocket from 'ws';

// Configuration
const API_HOST = 'localhost';
const API_PORT = 5000;
const TEST_CUSTOMER_ID = 1; // Use a valid customer ID from your database

// First, get the session configuration via the HTTP API
console.log('Step 1: Getting session configuration via HTTP API...');

const requestOptions = {
  hostname: API_HOST,
  port: API_PORT,
  path: '/api/financial-sherpa/realtime',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Bypass': 'test-financial-sherpa' // Add bypass header for testing
  }
};

const req = http.request(requestOptions, (res) => {
  console.log(`API Response Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const configResponse = JSON.parse(data);
      console.log('Session configuration received:', configResponse);
      
      if (!configResponse.success) {
        console.error('Failed to get session configuration:', configResponse.error);
        process.exit(1);
      }
      
      // Now connect to the WebSocket with the configuration
      connectToWebSocket(configResponse);
    } catch (error) {
      console.error('Error parsing API response:', error);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('API request error:', error);
  process.exit(1);
});

// Send the request with the customer ID
req.write(JSON.stringify({ customerId: TEST_CUSTOMER_ID }));
req.end();

// Function to connect to WebSocket after getting configuration
function connectToWebSocket(config) {
  const WS_URL = `ws://${API_HOST}:${API_PORT}/api/openai/realtime`;
  
  console.log(`\nStep 2: Attempting to connect to WebSocket at ${WS_URL}`);
  
  const ws = new WebSocket(WS_URL);
  
  // Set a timeout
  const timeout = setTimeout(() => {
    console.log('Connection timed out after 15 seconds');
    ws.close();
    process.exit(1);
  }, 15000);
  
  ws.on('open', () => {
    console.log('WebSocket connection established successfully!');
    
    // Send create_session message
    const message = {
      type: 'create_session',
      voice: 'alloy',
      instructions: `You are the Financial Sherpa, a friendly and knowledgeable AI assistant for ShiFi Financial. Your role is to help the customer understand their financial data.`
    };
    
    console.log('Sending message:', message);
    ws.send(JSON.stringify(message));
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received WebSocket message:', message);
      
      if (message.type === 'session_created') {
        console.log('✅ Session created successfully with ID:', message.sessionId);
        clearTimeout(timeout);
        
        // Close the connection after success
        setTimeout(() => {
          ws.close();
          process.exit(0);
        }, 1000);
      } else if (message.type === 'error') {
        console.error('❌ Error from WebSocket server:', message);
        clearTimeout(timeout);
        ws.close();
        process.exit(1);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearTimeout(timeout);
    process.exit(1);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WebSocket connection closed: code=${code}, reason=${reason}`);
  });
}