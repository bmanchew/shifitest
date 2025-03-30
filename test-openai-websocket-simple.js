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
  // Use either the provided websocket endpoint or fallback to the default
  const WS_PATH = config.wsEndpoint || '/api/openai/realtime';
  const WS_URL = `ws://${API_HOST}:${API_PORT}${WS_PATH}`;
  
  console.log(`\nStep 2: Attempting to connect to WebSocket at ${WS_URL}`);
  console.log('WebSocket configuration:', {
    API_HOST,
    API_PORT,
    WS_PATH,
    WS_URL,
    customerId: config.customerId,
    customerName: config.customerName
  });
  
  // Add query parameters to URL for identification
  const wsUrlWithParams = `${WS_URL}?userId=${config.customerId}&role=customer`;
  console.log(`Full WebSocket URL: ${wsUrlWithParams}`);
  
  // WebSocket client options (for debugging)
  const wsOptions = {
    handshakeTimeout: 10000,
    perMessageDeflate: false,
    maxPayload: 100 * 1024 * 1024, // 100 MB
    followRedirects: true,
    headers: {
      'User-Agent': 'ShiFi-Test-Client/1.0',
      'Origin': `http://${API_HOST}:${API_PORT}`
    }
  };
  
  console.log('Creating WebSocket with options:', wsOptions);
  const ws = new WebSocket(wsUrlWithParams, [], wsOptions);
  
  // Track WebSocket client state
  console.log('Initial WebSocket readyState:', getReadyStateName(ws.readyState));
  
  // Log WebSocket state changes
  const originalOnOpen = ws._socket?.onopen;
  if (ws._socket) {
    ws._socket.onopen = function(...args) {
      console.log('TCP socket connected (low level)');
      if (originalOnOpen) return originalOnOpen.apply(this, args);
    };
  }
  
  // Set a timeout
  const timeout = setTimeout(() => {
    console.log('Connection timed out after 15 seconds');
    console.log('Final WebSocket readyState:', getReadyStateName(ws.readyState));
    ws.close();
    process.exit(1);
  }, 15000);
  
  ws.on('open', () => {
    console.log('WebSocket connection established successfully!');
    console.log('WebSocket readyState after open:', getReadyStateName(ws.readyState));
    
    // Send create_session message
    const message = {
      type: 'create_session',
      voice: 'alloy',
      instructions: `You are the Financial Sherpa, a friendly and knowledgeable AI assistant for ShiFi Financial. Your role is to help ${config.customerName || 'the customer'} understand their financial data.`
    };
    
    console.log('Sending message:', message);
    try {
      ws.send(JSON.stringify(message));
      console.log('Message sent successfully');
    } catch (e) {
      console.error('Error sending message:', e);
    }
  });
  
  ws.on('message', (data) => {
    try {
      // First log the raw message for debugging
      console.log('Raw message received:', data.toString().substring(0, 100) + (data.toString().length > 100 ? '...' : ''));
      
      const message = JSON.parse(data.toString());
      console.log('Received WebSocket message:', message);
      
      if (message.type === 'welcome') {
        console.log('🎉 Welcome message received from WebSocket server');
      } else if (message.type === 'session_created') {
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
      console.error('Raw data:', data.toString());
    }
  });
  
  ws.on('upgrade', (response) => {
    console.log('WebSocket upgrade response received:', {
      statusCode: response.statusCode,
      headers: response.headers
    });
  });
  
  ws.on('unexpected-response', (request, response) => {
    console.error('WebSocket received unexpected response:', {
      statusCode: response.statusCode,
      statusMessage: response.statusMessage,
      headers: response.headers
    });
    
    // Read and log the response body for debugging
    let responseBody = '';
    response.on('data', (chunk) => {
      responseBody += chunk.toString();
    });
    
    response.on('end', () => {
      console.error('Response body:', responseBody);
      clearTimeout(timeout);
      process.exit(1);
    });
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    console.error('WebSocket error details:', {
      message: error.message,
      code: error.code,
      type: error.type,
      target: error.target?.constructor.name,
      readyState: ws.readyState !== undefined ? getReadyStateName(ws.readyState) : 'unknown'
    });
    clearTimeout(timeout);
    process.exit(1);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WebSocket connection closed: code=${code}, reason=${reason}`);
  });
}

// Helper function to convert WebSocket readyState to readable name
function getReadyStateName(state) {
  const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
  return states[state] || `UNKNOWN(${state})`;
}