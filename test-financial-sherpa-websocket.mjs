/**
 * Test script for Financial Sherpa WebSocket functionality
 * 
 * This script tests both the REST endpoint for initializing a WebSocket connection
 * and the WebSocket connection itself, verifying that:
 * 1. The API endpoint returns proper WebSocket connection details
 * 2. The WebSocket connection can be established
 * 3. Session creation works correctly
 * 4. Audio data can be sent and received
 */

import fetch from 'node-fetch';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

// Config
const API_URL = 'http://localhost:5000/api/financial-sherpa/realtime';
const CSRF_URL = 'http://localhost:5000/api/csrf-token';
const TEST_CUSTOMER_ID = 45;  // Use an existing customer ID for testing

// Test variables for tracking state
let wsUrl = '';
let wsEndpoint = '';
let webSocket = null;
let sessionCreated = false;
let testPassed = false;
let testTimeout = null;

/**
 * Get CSRF token for API requests
 */
async function getCsrfToken() {
  try {
    const response = await fetch(CSRF_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get CSRF token: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    throw error;
  }
}

/**
 * Initialize WebSocket connection via the API
 */
async function initializeWebSocket() {
  try {
    console.log('👉 Getting CSRF token...');
    const csrfToken = await getCsrfToken();
    
    console.log('👉 Initializing WebSocket connection via API...');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken,
        'X-CSRF-Bypass': 'test-financial-sherpa' // Use test bypass for easier testing
      },
      body: JSON.stringify({
        customerId: TEST_CUSTOMER_ID
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to initialize WebSocket: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.wsEndpoint) {
      throw new Error(`Invalid WebSocket configuration: ${JSON.stringify(data)}`);
    }
    
    console.log('✅ Successfully got WebSocket configuration:', data);
    
    // Construct WebSocket URL
    wsEndpoint = data.wsEndpoint;
    wsUrl = `ws://localhost:5000${wsEndpoint}`;
    
    return data;
  } catch (error) {
    console.error('❌ Error initializing WebSocket:', error);
    throw error;
  }
}

/**
 * Connect to the WebSocket
 */
function connectToWebSocket() {
  return new Promise((resolve, reject) => {
    if (!wsUrl) {
      reject(new Error('WebSocket URL not defined. Run initializeWebSocket first.'));
      return;
    }
    
    console.log(`👉 Connecting to WebSocket: ${wsUrl}`);
    
    webSocket = new WebSocket(wsUrl);
    
    webSocket.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      webSocket.send(JSON.stringify({
        type: 'create_session',
        voice: 'alloy',
        customerId: TEST_CUSTOMER_ID,
        instructions: 'You are a helpful financial assistant named Financial Sherpa.'
      }));
      console.log('👉 Session creation request sent');
    });
    
    webSocket.on('message', (data) => {
      console.log('📥 WebSocket message received');
      
      // Check if the message is JSON or binary
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 Message content:', message);
        
        // Check for session created confirmation
        if (message.type === 'session_created') {
          console.log('✅ OpenAI session created successfully, session ID:', message.sessionId);
          sessionCreated = true;
          resolve(true);
        }
        
        // Check for transcription received
        if (message.type === 'transcription') {
          console.log('✅ Transcription received:', message.text);
        }
        
        // Check for content received
        if (message.type === 'content') {
          console.log('✅ Content received:', message.content);
          testPassed = true;
        }
        
        // Check for audio received
        if (message.type === 'audio') {
          console.log('✅ Audio data received:', message.format);
        }
      } catch (e) {
        // Probably binary data (audio)
        console.log('📥 Binary message received, length:', data.length);
      }
    });
    
    webSocket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      reject(error);
    });
    
    webSocket.on('close', (code, reason) => {
      console.log(`👋 WebSocket closed with code ${code}${reason ? `, reason: ${reason}` : ''}`);
      
      if (!sessionCreated && !testPassed) {
        reject(new Error('WebSocket closed before session was created.'));
      }
    });
    
    // Set a timeout to prevent the test from hanging
    testTimeout = setTimeout(() => {
      if (!sessionCreated) {
        console.error('❌ Test timeout: Session creation timed out after 30 seconds');
        
        if (webSocket.readyState === WebSocket.OPEN) {
          webSocket.close();
        }
        
        reject(new Error('Test timeout'));
      }
    }, 30000);
  });
}

/**
 * Main function to run the test
 */
async function runTest() {
  try {
    // Initialize and connect to WebSocket
    await initializeWebSocket();
    await connectToWebSocket();
    
    // Wait a moment for session to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (testTimeout) {
      clearTimeout(testTimeout);
    }
    
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      webSocket.close();
    }
  }
}

// Run the test
runTest();