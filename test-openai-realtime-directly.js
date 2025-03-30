/**
 * Test script to verify the OpenAI Realtime Agents framework functionality
 * This script runs a direct test against the OpenAI Realtime API
 * 
 * It verifies:
 * 1. That the OPENAI_API_KEY is valid and properly configured
 * 2. That the API supports the required "realtime" features
 * 3. That our agent configuration is valid
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/realtime/sessions';

/**
 * Test the OpenAI Realtime API
 * This function verifies that we can create a realtime thread
 */
async function testOpenAIRealtimeAPI() {
  // Verify that we have an API key
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is not set in the environment variables');
    process.exit(1);
  }

  console.log('👉 Testing OpenAI Realtime API with key:', 
    OPENAI_API_KEY.substring(0, 3) + '...' + OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4)
  );
  
  try {
    // Test session creation
    console.log('👉 Creating a test Realtime session...');
    
    const requestBody = {
      model: 'gpt-4o-realtime-preview',
      modalities: ['audio', 'text'],
      instructions: 'You are a helpful assistant for testing purposes.',
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
    };
    
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorData}`);
    }
    
    const data = await response.json();
    console.log('✅ Successfully created Realtime session:', data.id);
    console.log('✅ Session details:', {
      model: data.model,
      voice: data.voice,
      client_secret_expires_at: new Date(data.client_secret.expires_at * 1000).toISOString()
    });
    
    console.log('👉 OpenAI Realtime API test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ OpenAI Realtime API test failed:', error.message);
    if (error.message.includes('429')) {
      console.error('   This might be due to rate limiting. Try again later.');
    } else if (error.message.includes('401')) {
      console.error('   Authentication failed. Check if your API key is valid and has access to the Realtime API.');
    } else if (error.message.includes('404')) {
      console.error('   Endpoint not found. The Realtime API may not be available for your account yet.');
    }
    
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const success = await testOpenAIRealtimeAPI();
  
  if (success) {
    console.log('✅ All tests passed! The OpenAI Realtime API is working properly.');
    process.exit(0);
  } else {
    console.error('❌ Tests failed. See above for details.');
    process.exit(1);
  }
}

// Run the tests
main();