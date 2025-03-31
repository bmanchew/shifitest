/**
 * Test script for the Financial Sherpa WebSocket connection
 * 
 * This script:
 * 1. Connects to the Financial Sherpa WebSocket endpoint
 * 2. Sends a create session request
 * 3. Logs all messages received from the server
 * 4. Handles pings and errors
 */

import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const SERVER_URL = 'ws://localhost:5001/financial-sherpa-ws';
const PING_INTERVAL = 30000; // 30 seconds
const CLIENT_ID = randomUUID();

// Track WebSocket state
let wsOpen = false;
let pingInterval = null;

console.log(`🚀 Financial Sherpa WebSocket Test Client (ID: ${CLIENT_ID})`);
console.log(`Connecting to: ${SERVER_URL}\n`);

// Create WebSocket connection
const ws = new WebSocket(SERVER_URL);

// Set up event handlers
ws.on('open', () => {
  wsOpen = true;
  console.log('✅ Connected to Financial Sherpa WebSocket server');
  
  // Send create session request
  const createSessionRequest = {
    type: 'create_session',
    customerId: 1234,
    customerName: 'Test Customer',
    financialData: {
      accountBalances: [
        { accountType: 'Checking', balance: 1500.75 },
        { accountType: 'Savings', balance: 5200.50 },
        { accountType: 'Credit Card', balance: -450.25 }
      ],
      recentTransactions: [
        { date: '2023-03-28', description: 'Grocery Store', amount: -75.42 },
        { date: '2023-03-27', description: 'Paycheck', amount: 1250.00 },
        { date: '2023-03-25', description: 'Restaurant', amount: -45.80 }
      ],
      upcomingPayments: [
        { date: '2023-04-01', description: 'Rent', amount: 1200.00 },
        { date: '2023-04-05', description: 'Car Payment', amount: 350.00 }
      ]
    }
  };
  
  console.log('📤 Sending create session request...');
  ws.send(JSON.stringify(createSessionRequest));
  
  // Set up ping interval
  pingInterval = setInterval(() => {
    if (wsOpen) {
      console.log('📤 Sending ping...');
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, PING_INTERVAL);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    const timestamp = new Date().toISOString();
    console.log(`📥 [${timestamp}] Received message: ${message.type || 'unknown'}`);
    
    // Pretty-print the message
    console.log(JSON.stringify(message, null, 2));
    console.log('-----------------------------------');
    
    // Handle specific message types
    switch (message.type) {
      case 'session_created':
        console.log('✅ Session created successfully');
        break;
        
      case 'session_ready':
        console.log('✅ OpenAI session is ready for audio');
        
        // Send test audio if available
        setTimeout(() => sendTestAudio(), 2000);
        break;
        
      case 'error':
        console.error(`❌ Error: ${message.message || 'Unknown error'}`);
        if (message.details) {
          console.error(`Details: ${message.details}`);
        }
        break;
        
      case 'pong':
        // Silently acknowledge pong
        break;
    }
  } catch (err) {
    console.error('❌ Error parsing message:', err);
    console.error('Raw message:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  wsOpen = false;
  console.log(`❌ Connection closed: ${code} - ${reason || 'No reason provided'}`);
  
  // Clear ping interval
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  
  // Exit after a short delay
  setTimeout(() => {
    console.log('Exiting...');
    process.exit(0);
  }, 1000);
});

// Function to send a test audio file
function sendTestAudio() {
  if (!wsOpen) return;
  
  try {
    // Check if we have a test audio file
    const testAudioPath = path.join(__dirname, 'test.mp3');
    
    if (fs.existsSync(testAudioPath)) {
      console.log('📤 Sending test audio file...');
      
      // Read the audio file
      const audioBuffer = fs.readFileSync(testAudioPath);
      
      // Send the audio file as binary data
      ws.send(audioBuffer);
      
      // Send end of stream marker
      setTimeout(() => {
        if (wsOpen) {
          console.log('📤 Sending end of stream...');
          ws.send(JSON.stringify({ type: 'end_of_stream' }));
        }
      }, 1000);
    } else {
      console.log('❌ Test audio file not found:', testAudioPath);
    }
  } catch (err) {
    console.error('❌ Error sending test audio:', err);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down...');
  
  if (wsOpen) {
    console.log('Closing WebSocket connection...');
    ws.close(1000, 'Client terminated');
  }
  
  // Clear ping interval
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// Create a sample audio file if it doesn't exist
const createSampleAudioFile = () => {
  const testAudioPath = path.join(__dirname, 'test.mp3');
  
  if (!fs.existsSync(testAudioPath)) {
    console.log('Creating sample audio file...');
    
    // Create a minimal valid audio file (just header data)
    const minimalMP3Header = Buffer.from([
      0xFF, 0xFB, 0x50, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    
    fs.writeFileSync(testAudioPath, minimalMP3Header);
    console.log('✅ Created sample audio file');
  }
};

// Create sample audio file
createSampleAudioFile();