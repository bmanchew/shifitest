/**
 * Test script to verify the OpenAI Realtime service with improved fixes
 */

import { WebSocket } from 'ws';

// Verify OpenAI API key is loaded from environment
function checkApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.');
    process.exit(1);
  }
  return apiKey;
}

// Directly test session creation without the server
async function testDirectApiCall() {
  console.log('🔄 Testing direct API call to create an OpenAI Realtime session...');
  
  const apiKey = checkApiKey();
  
  try {
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        modalities: ['audio', 'text'],
        instructions: 'You are a friendly and helpful assistant.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        temperature: 0.7,
        max_response_output_tokens: 'inf'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed to create session: ${response.status} ${response.statusText}`);
      console.error(`Error details: ${error}`);
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ Session created successfully!');
    console.log(`Session ID: ${data.id}`);
    console.log(`Session Object: ${data.object}`);
    console.log(`Model: ${data.model}`);
    console.log(`Voice: ${data.voice}`);
    
    console.log(`Client Secret: ${data.client_secret.value}`);
    
    // Test WebSocket connection
    return testWebSocketConnection(data.id, data.client_secret.value);
  } catch (error) {
    console.error('❌ Error creating session:', error.message);
  }
}

// Test WebSocket connection to OpenAI Realtime API
async function testWebSocketConnection(sessionId, clientSecret) {
  console.log(`\n🔄 Testing WebSocket connection to session ${sessionId}...`);
  
  return new Promise((resolve, reject) => {
    try {
      // Construct WebSocket URL and token
      const wsUrl = `wss://api.openai.com/v1/realtime/${sessionId}`;
      
      // Create WebSocket connection
      // WebSocket protocol doesn't support sending custom headers in the initial handshake
      // For OpenAI, the token should be in the query string
      const wsUrlWithToken = `${wsUrl}?token=${encodeURIComponent(clientSecret)}`;
      const socket = new WebSocket(wsUrlWithToken);
      
      // Set up event handlers
      socket.on('open', () => {
        console.log('✅ WebSocket connection opened successfully!');
        
        // After successful connection, wait a bit for session initialization
        setTimeout(() => {
          console.log('🔄 Closing WebSocket connection after successful test...');
          socket.close();
          resolve(true);
        }, 3000);
      });
      
      socket.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log(`📨 Received message: ${data.type}`);
          
          if (data.type === 'transcription_session.created') {
            console.log('✅ Received transcription_session.created event - session is fully ready!');
          }
        } catch (error) {
          console.warn('⚠️ Received non-JSON message:', message);
        }
      });
      
      socket.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });
      
      socket.on('close', (code, reason) => {
        console.log(`WebSocket closed: ${code} ${reason}`);
        resolve(true);
      });
      
      // Set timeout to avoid hanging forever
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          console.log('⚠️ Test timeout reached, closing connection...');
          socket.close();
          resolve(false);
        }
      }, 10000);
    } catch (error) {
      console.error('❌ Error in WebSocket test:', error);
      reject(error);
    }
  });
}

// Test WebSocket connection to our server
async function testServerWebSocketConnection() {
  console.log('\n🔄 Testing WebSocket connection to our server...');
  
  // Try to connect to our server WebSocket endpoint
  const protocol = 'ws://';
  const host = 'localhost:3000'; // Adjust port if needed
  const wsUrl = `${protocol}${host}/api/openai/realtime`;
  
  return new Promise((resolve, reject) => {
    try {
      const socket = new WebSocket(wsUrl);
      
      socket.on('open', () => {
        console.log('✅ Connected to server WebSocket!');
        
        console.log('🔄 Sending session creation request...');
        socket.send(JSON.stringify({
          type: 'create_session',
          model: 'gpt-4o-realtime-preview',
          voice: 'alloy',
          instructions: 'You are a helpful financial assistant.'
        }));
      });
      
      socket.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log(`📨 Received message from server: ${data.type}`);
          
          if (data.type === 'session_created') {
            console.log('✅ Session created successfully with ID:', data.sessionId);
          } else if (data.type === 'error') {
            console.error('❌ Server error:', data.message, data.details);
          } else if (data.type === 'transcription_session.created') {
            console.log('✅ Received transcription_session.created event - session is fully ready!');
            
            setTimeout(() => {
              console.log('🔄 Test completed successfully, closing connection...');
              socket.close();
              resolve(true);
            }, 1000);
          }
        } catch (error) {
          console.warn('⚠️ Received non-JSON message:', message);
        }
      });
      
      socket.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });
      
      socket.on('close', (code, reason) => {
        console.log(`WebSocket closed: ${code} ${reason}`);
        resolve(true);
      });
      
      // Set timeout to avoid hanging forever
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          console.log('⚠️ Test timeout reached, closing connection...');
          socket.close();
          resolve(false);
        }
      }, 30000);
    } catch (error) {
      console.error('❌ Error in server WebSocket test:', error);
      reject(error);
    }
  });
}

// Run tests
async function runTests() {
  try {
    // First test direct API call for session creation
    const directApiSuccess = await testDirectApiCall();
    
    if (directApiSuccess) {
      console.log('\n✅ Direct API test completed successfully!');
    } else {
      console.log('\n⚠️ Direct API test completed with issues.');
    }
    
    // Then test our server implementation
    console.log('\n🔄 Starting server WebSocket test (make sure server is running)...');
    const serverSuccess = await testServerWebSocketConnection();
    
    if (serverSuccess) {
      console.log('\n✅ Server WebSocket test completed successfully!');
    } else {
      console.log('\n⚠️ Server WebSocket test completed with issues.');
    }
    
    console.log('\n🏁 All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Tests failed with error:', error);
  }
}

// Run tests
runTests();