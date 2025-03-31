/**
 * Test script to verify OpenAI API key permissions for Realtime API
 * 
 * This script checks:
 * 1. If the OPENAI_API_KEY is valid
 * 2. If it has access to the required models
 * 3. If it can create a realtime session
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Verify OpenAI API key exists
function checkApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY environment variable is not set');
    process.exit(1);
  }
  console.log(`✅ OPENAI_API_KEY environment variable is set (length: ${apiKey.length})`);
  return apiKey;
}

// Check available models
async function checkModels(apiKey) {
  try {
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    console.log(`✅ Successfully connected to OpenAI API`);
    
    // Check if the required model is available
    const requiredModel = 'gpt-4o-realtime-preview';
    const models = response.data.data.map(model => model.id);
    
    if (models.includes(requiredModel)) {
      console.log(`✅ Required model '${requiredModel}' is available`);
    } else {
      console.log(`❌ Required model '${requiredModel}' is NOT available`);
      console.log('Available models:');
      // List all gpt-4 models to suggest alternatives
      const gpt4Models = models.filter(model => model.includes('gpt-4'));
      gpt4Models.forEach(model => console.log(`  - ${model}`));
    }
    
    return models;
  } catch (error) {
    console.error('❌ Failed to fetch models:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return [];
  }
}

// Test creating a realtime session
async function testRealtimeSession(apiKey) {
  try {
    console.log('🔄 Attempting to create a realtime session...');
    
    const response = await axios.post(
      'https://api.openai.com/v1/realtime/sessions',
      {
        model: 'gpt-4o-realtime-preview',
        modalities: ['audio', 'text'],
        instructions: 'You are a helpful assistant.',
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
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );
    
    console.log('✅ Successfully created realtime session!');
    console.log('Session ID:', response.data.id);
    console.log('Client Secret Value:', response.data.client_secret.value.slice(0, 10) + '...');
    
    // Construct the WebSocket URL
    const wsUrl = `wss://api.openai.com/v1/realtime/${response.data.id}?authorization=Bearer%20${encodeURIComponent(response.data.client_secret.value)}`;
    console.log('WebSocket URL should be:');
    console.log(wsUrl);
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create realtime session:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      
      if (error.response.status === 403) {
        console.error('\n🔑 PERMISSION ISSUE: Your API key does not have access to the Realtime API.');
        console.error('This is likely because:');
        console.error('1. Your OpenAI account is not enrolled in the Realtime API beta');
        console.error('2. Your API key does not have permission to access the gpt-4o-realtime-preview model\n');
        console.error('SOLUTION: Contact OpenAI to request access to the Realtime API beta');
      }
    }
    return null;
  }
}

// Main function
async function main() {
  console.log('🔍 Testing OpenAI API Key permissions for Realtime API...\n');
  
  const apiKey = checkApiKey();
  const models = await checkModels(apiKey);
  
  if (models.length > 0) {
    const sessionData = await testRealtimeSession(apiKey);
    
    if (sessionData) {
      console.log('\n✅ SUCCESS: Your API key has the necessary permissions for the Realtime API!');
    } else {
      console.log('\n❌ FAILED: Your API key does not have the necessary permissions for the Realtime API.');
      console.log('Please contact OpenAI to request access to the Realtime API beta.');
    }
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
});