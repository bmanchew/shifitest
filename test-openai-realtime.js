/**
 * Test script to directly test the OpenAI Realtime API
 * This checks if our API key is valid and working with the Realtime API
 */

import 'dotenv/config';
import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function testOpenAIRealtimeAPI() {
  try {
    console.log('Testing OpenAI Realtime API with API key...');
    console.log('API Key available:', !!OPENAI_API_KEY);
    console.log('API Key length:', OPENAI_API_KEY ? OPENAI_API_KEY.length : 0);
    
    // First test a simple completion to verify basic API access
    console.log('\nTesting basic API access with a simple completion...');
    const completionResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello, this is a test message. Please respond with "API is working!" if you receive this.' }],
        max_tokens: 100
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );
    
    console.log('Basic API test successful!');
    console.log('Response:', completionResponse.data.choices[0].message.content);
    
    // Now test the Realtime API specifically
    console.log('\nTesting OpenAI Realtime API session creation...');
    const realtimeResponse = await axios.post(
      'https://api.openai.com/v1/realtime/sessions',
      {
        model: 'gpt-4o-realtime-preview',
        modalities: ['audio', 'text'],
        instructions: 'You are a test assistant. Please respond with a short message confirming the API is working.',
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
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );
    
    console.log('Realtime API test successful!');
    console.log('Session ID:', realtimeResponse.data.id);
    console.log('Session Client Secret:', 
      realtimeResponse.data.client_secret ? 
      `Available (expiry: ${new Date(realtimeResponse.data.client_secret.expires_at * 1000).toISOString()})` : 
      'Not available'
    );
    
    return {
      success: true,
      message: 'OpenAI Realtime API tests passed successfully',
      sessionId: realtimeResponse.data.id
    };
    
  } catch (error) {
    console.error('Error testing OpenAI Realtime API:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Response Error:');
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from API:');
      console.error(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
    }
    
    return {
      success: false,
      message: 'OpenAI Realtime API tests failed',
      error: error.response ? error.response.data : error.message
    };
  }
}

async function main() {
  const result = await testOpenAIRealtimeAPI();
  console.log('\nTest Result:', result.success ? 'SUCCESS' : 'FAILED');
  console.log(result.message);
  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error('Unhandled error in main:', err);
  process.exit(1);
});