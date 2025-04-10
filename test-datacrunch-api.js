/**
 * Test script for DataCrunch API integration
 * 
 * This script tests the connection to DataCrunch API and attempts to 
 * generate a voice sample using the configured API credentials.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables with path to .env
dotenv.config({ path: '.env' });

// Debug loaded environment variables
console.log('Environment variables loaded from .env');
console.log('Original DATACRUNCH_URL:', process.env.DATACRUNCH_URL || 'Not found');
console.log('DATACRUNCH_CLIENT_ID:', process.env.DATACRUNCH_CLIENT_ID ? 'Found (masked)' : 'Not found');
console.log('DATACRUNCH_CLIENT_SECRET:', process.env.DATACRUNCH_CLIENT_SECRET ? 'Found (masked)' : 'Not found');

// Override with the correct URL regardless of what's in the environment
// From our tests, we know that the base URL is correct and returns 401, not 404
process.env.DATACRUNCH_URL = 'https://api.datacrunch.io/v1';
console.log('Updated DATACRUNCH_URL:', process.env.DATACRUNCH_URL);

// Check required environment variables
const DATACRUNCH_URL = process.env.DATACRUNCH_URL;
const DATACRUNCH_CLIENT_ID = process.env.DATACRUNCH_CLIENT_ID;
const DATACRUNCH_CLIENT_SECRET = process.env.DATACRUNCH_CLIENT_SECRET;

// Variable to store the access token once we get it
let accessToken = null;

// Test constants
const TEST_TEXT = "Hello, this is a test of the DataCrunch API integration. If you hear this message, the integration is working correctly.";
const OUTPUT_FOLDER = path.join(__dirname, 'audio_test_outputs');
const OUTPUT_FILE = path.join(OUTPUT_FOLDER, `test_datacrunch_${Date.now()}.wav`);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
}

/**
 * Test the DataCrunch API connection
 */
async function testDataCrunchConnection() {
  console.log('Testing DataCrunch API connection...');
  
  // Validate required env vars
  if (!DATACRUNCH_URL) {
    console.error('ERROR: DATACRUNCH_URL environment variable is not set');
    return false;
  }
  
  if (!DATACRUNCH_API_KEY) {
    console.error('ERROR: DATACRUNCH_API_KEY environment variable is not set');
    return false;
  }
  
  try {
    // The root endpoint returned 401, which means it's the correct endpoint but our auth is wrong
    // Let's try different auth header combinations to see which one works
    
    console.log('Focusing on the root endpoint (/) which returned 401 Unauthorized');
    console.log('Testing different authentication header formats...');

    const authTests = [
      {
        name: 'X-API-KEY only',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-KEY': DATACRUNCH_API_KEY
        }
      },
      {
        name: 'Authorization: Bearer',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DATACRUNCH_API_KEY}`
        }
      },
      {
        name: 'Api-Key',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Api-Key': DATACRUNCH_API_KEY
        }
      },
      {
        name: 'x-api-key (lowercase)',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': DATACRUNCH_API_KEY
        }
      },
      {
        name: 'Custom format: X-API-KEY without prefix',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-KEY': DATACRUNCH_API_KEY.replace('em1pn6pq673kRwlz9ya7jbrdvRGd6ZDNfeDgaOhQkL', '')
        }
      }
    ];
    
    let response = null;
    let successfulAuth = null;
    // Use a global variable to share the successful auth between functions
    global.successfulAuth = null;
    
    // Try each auth combination
    for (const test of authTests) {
      console.log(`Testing auth format: ${test.name}`);
      
      try {
        // Make a request to the root endpoint
        response = await axios.get(DATACRUNCH_URL, { 
          headers: test.headers,
          timeout: 5000,
          validateStatus: null
        });
        
        console.log(`Response: ${response.status} ${response.statusText}`);
        
        // If we get a 200 response, we found the right auth format
        if (response.status === 200) {
          console.log('✅ Found working authentication format!');
          successfulAuth = test;
          global.successfulAuth = test;
          break;
        }
        else {
          // Show the response data for debugging
          const shortResponseData = JSON.stringify(response.data).substring(0, 100);
          console.log(`Response data snippet: ${shortResponseData}...`);
        }
      } catch (error) {
        console.log(`Error: ${error.message}`);
      }
      
      console.log('-----------------------');
    }
    
    // Try direct API endpoint tests for common TTS patterns
    console.log('\nTesting direct TTS endpoints...');
    
    const ttsEndpoints = [
      '/tts',
      '/api/tts', 
      '/v1/tts',
      '/text-to-speech',
      '/synthesize'
    ];
    
    let successfulEndpoint = null;
    
    // Use all auth headers to be safe
    const combinedHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-API-KEY': DATACRUNCH_API_KEY,
      'Authorization': `Bearer ${DATACRUNCH_API_KEY}`,
      'Api-Key': DATACRUNCH_API_KEY,
      'x-api-key': DATACRUNCH_API_KEY
    };
    
    for (const endpoint of ttsEndpoints) {
      const fullUrl = `${DATACRUNCH_URL}${endpoint}`;
      console.log(`Trying ${fullUrl}...`);
      
      try {
        // We'll try a post request since TTS endpoints typically use POST
        const testPayload = {
          text: "Hello world",
          voice_id: "speaker_0"
        };
        
        response = await axios.post(fullUrl, testPayload, { 
          headers: combinedHeaders,
          timeout: 5000,
          validateStatus: null
        });
        
        console.log(`Response: ${response.status} ${response.statusText}`);
        
        // Any non-404 response might indicate this is a valid endpoint
        if (response.status !== 404) {
          console.log('⚠️ Found potential TTS endpoint (non-404 response)');
          successfulEndpoint = endpoint;
          
          // Show the response data for debugging
          const shortResponseData = JSON.stringify(response.data).substring(0, 100);
          console.log(`Response data snippet: ${shortResponseData}...`);
        }
      } catch (error) {
        console.log(`Error with ${fullUrl}: ${error.message}`);
      }
    }
    
    if (!successfulAuth && !successfulEndpoint) {
      throw new Error('Could not find valid auth format or API endpoint');
    }
    
    // Use the successful headers or combined headers
    const bestHeaders = successfulAuth ? successfulAuth.headers : combinedHeaders;
    
    if (successfulEndpoint) {
      console.log(`Making request to successful endpoint: ${DATACRUNCH_URL}${successfulEndpoint}`);
      response = await axios.get(`${DATACRUNCH_URL}${successfulEndpoint}`, { headers: bestHeaders });
    } else {
      console.log('No successful endpoint found, but continuing with tests');
    }
    
    if (response.status === 200) {
      console.log('✅ Successfully connected to DataCrunch API');
      
      // Parse and display available models
      const models = response.data.data || [];
      console.log(`Found ${models.length} available models:`);
      models.forEach((model, index) => {
        console.log(`  ${index + 1}. ${model.id || model.name || 'Unknown model'}`);
      });
      
      return true;
    } else {
      console.error(`❌ API request failed with status code: ${response.status}`);
      console.error(response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to connect to DataCrunch API:');
    if (error.response) {
      // Server responded with error
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // Request made but no response received
      console.error('No response received from server');
    } else {
      // Error setting up request
      console.error(`Error: ${error.message}`);
    }
    
    // Provide troubleshooting suggestions
    console.log('\nPossible troubleshooting steps:');
    console.log(' - Verify DATACRUNCH_URL is correct (should be https://api.datacrunch.io/v1)');
    console.log(' - Check your API key and make sure it has the correct permissions');
    console.log(' - Ensure you have internet connectivity and can reach the DataCrunch servers');
    console.log(' - Check if there are any DataCrunch service status updates');
    
    return false;
  }
}

/**
 * Generate a test voice sample using DataCrunch API
 */
async function testVoiceGeneration() {
  console.log('\nTesting voice generation with DataCrunch API...');
  
  try {
    // Use the successful auth format if available, or try all formats
    let headers;
    if (global.successfulAuth) {
      console.log(`Using successful auth format: ${global.successfulAuth.name}`);
      headers = global.successfulAuth.headers;
    } else {
      console.log('No successful auth format found, trying all formats');
      headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-API-KEY': DATACRUNCH_API_KEY,
        'Authorization': `Bearer ${DATACRUNCH_API_KEY}`,
        'Api-Key': DATACRUNCH_API_KEY,
        'x-api-key': DATACRUNCH_API_KEY
      };
    }
    
    // Prepare request payload
    const payload = {
      text: TEST_TEXT,
      voice_id: "speaker_0",  // Default female voice
      model_id: "tts1",  // Change this to a model ID from your available models
      settings: {
        stability: 0.5,
        similarity: 0.75,
        style: 0.0,
        speaker_boost: true,
        temperature: 0.9,
        top_k: 50,
        max_duration_seconds: 30
      }
    };
    
    // Make the API request
    console.log(`Generating voice sample for text: "${TEST_TEXT.substring(0, 50)}..."`);
    const response = await axios.post(`${DATACRUNCH_URL}/tts`, payload, { 
      headers,
      responseType: 'json'
    });
    
    if (response.status === 200) {
      console.log('✅ Voice generation request successful');
      
      // Process response
      const data = response.data;
      if (!data.success) {
        console.error(`❌ API returned success=false: ${data.message || 'Unknown error'}`);
        return false;
      }
      
      // Extract audio data
      const audioData = data.audio_data || data.data?.audio_data;
      if (!audioData) {
        console.error('❌ No audio data found in response');
        return false;
      }
      
      // Save audio file (base64 decoded)
      const buffer = Buffer.from(audioData, 'base64');
      fs.writeFileSync(OUTPUT_FILE, buffer);
      
      console.log(`✅ Audio file saved to: ${OUTPUT_FILE}`);
      
      // Try to play the audio if on a supported platform
      if (process.platform === 'darwin') {
        // macOS
        console.log('Attempting to play audio file...');
        exec(`afplay "${OUTPUT_FILE}"`, (error) => {
          if (error) {
            console.error(`❌ Failed to play audio: ${error.message}`);
          }
        });
      } else if (process.platform === 'win32') {
        // Windows
        console.log('Attempting to play audio file...');
        exec(`start "${OUTPUT_FILE}"`, (error) => {
          if (error) {
            console.error(`❌ Failed to play audio: ${error.message}`);
          }
        });
      } else {
        // Linux or other platforms
        console.log(`Audio file is saved at: ${OUTPUT_FILE}`);
        console.log('Use your system audio player to play the file.');
      }
      
      return true;
    } else {
      console.error(`❌ Voice generation failed with status code: ${response.status}`);
      console.error(response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to generate voice sample:');
    if (error.response) {
      // Server responded with error
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // Request made but no response received
      console.error('No response received from server');
    } else {
      // Error setting up request
      console.error(`Error: ${error.message}`);
    }
    
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('DataCrunch API Integration Test');
  console.log('==============================\n');
  
  console.log('Current configuration:');
  console.log(`DataCrunch URL: ${DATACRUNCH_URL || 'Not set'}`);
  console.log(`DataCrunch API Key: ${DATACRUNCH_API_KEY ? DATACRUNCH_API_KEY.substring(0, 3) + '...' + DATACRUNCH_API_KEY.substring(DATACRUNCH_API_KEY.length - 3) : 'Not set'}`);
  console.log('');
  
  // Step 1: Test API Connection
  const connectionSuccess = await testDataCrunchConnection();
  if (!connectionSuccess) {
    console.error('\n❌ DataCrunch API connection test failed. Cannot proceed with voice generation test.');
    return;
  }
  
  // Step 2: Test Voice Generation
  const generationSuccess = await testVoiceGeneration();
  if (!generationSuccess) {
    console.error('\n❌ Voice generation test failed.');
    return;
  }
  
  console.log('\n✅ All tests completed successfully!');
  console.log('The DataCrunch API integration is working correctly.');
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error.message);
});