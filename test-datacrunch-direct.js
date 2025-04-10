/**
 * DataCrunch API Test Script - Direct API Key Authentication
 * 
 * This script tests the DataCrunch API integration using direct API key authentication
 * as documented in the DataCrunch API documentation. This version doesn't use OAuth.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

// Get current filename and directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables with path to .env
dotenv.config({ path: '.env' });

// Debug loaded environment variables
console.log('Environment variables loaded from .env');
console.log('Original DATACRUNCH_URL:', process.env.DATACRUNCH_URL || 'Not found');
console.log('DATACRUNCH_API_KEY:', process.env.DATACRUNCH_API_KEY ? 'Found (masked)' : 'Not found');

// Try standard URL format with v1 path included
process.env.DATACRUNCH_URL = 'https://api.datacrunch.io/v1';
console.log('Updated DATACRUNCH_URL:', process.env.DATACRUNCH_URL);

// Check required environment variables
const DATACRUNCH_URL = process.env.DATACRUNCH_URL;
const DATACRUNCH_API_KEY = process.env.DATACRUNCH_API_KEY;

// Creating a shared state object to replace global variables in ES modules
const sharedState = {
  successfulAuth: null,
  ttsEndpoint: '/tts'
};

// Test constants
const TEST_TEXT = "Hello, this is a test of the DataCrunch API integration. If you hear this message, the integration is working correctly.";
const OUTPUT_FOLDER = path.join(__dirname, 'audio_test_outputs');
const OUTPUT_FILE = path.join(OUTPUT_FOLDER, `test_datacrunch_${Date.now()}.wav`);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
}

/**
 * Test the DataCrunch API connection using direct API key
 */
async function testDataCrunchConnection() {
  console.log('Testing DataCrunch API connection with direct API key...');
  
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
    // Try different authentication header formats
    console.log('Testing different authentication header formats...');
    
    const authTests = [
      {
        name: 'X-API-KEY header',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-KEY': DATACRUNCH_API_KEY
        }
      },
      {
        name: 'Authorization Bearer',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DATACRUNCH_API_KEY}`
        }
      },
      {
        name: 'x-api-key lowercase',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': DATACRUNCH_API_KEY
        }
      },
      {
        name: 'API-Key alternate format',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'API-Key': DATACRUNCH_API_KEY
        }
      }
    ];
    
    let successfulAuth = null;
    let infoResponse = null;
    let ttsResponse = null;
    
    // Try each auth format against the base URL endpoint
    for (const test of authTests) {
      console.log(`\nTesting auth format: ${test.name}`);
      
      try {
        // Test the base API endpoint first
        infoResponse = await axios.get(DATACRUNCH_URL, { 
          headers: test.headers,
          timeout: 5000,
          validateStatus: null
        });
        
        console.log(`Base URL Response: ${infoResponse.status} ${infoResponse.statusText}`);
        
        if (infoResponse.status === 200) {
          console.log('✅ Successfully connected to base API endpoint!');
          successfulAuth = test;
          break;
        }
        
        // If base endpoint fails, try the TTS endpoint directly since some APIs
        // don't have a base info endpoint
        const testPayload = {
          text: "Hello world",
          voice_id: "speaker_0"
        };
        
        ttsResponse = await axios.post(`${DATACRUNCH_URL}/tts`, testPayload, { 
          headers: test.headers,
          timeout: 5000,
          validateStatus: null
        });
        
        console.log(`TTS Endpoint Response: ${ttsResponse.status} ${ttsResponse.statusText}`);
        
        if (ttsResponse.status === 200) {
          console.log('✅ Successfully connected to TTS endpoint!');
          successfulAuth = test;
          break;
        }
        else if (ttsResponse.status !== 404) {
          // A non-404 response might indicate we're on the right track with this auth format
          // E.g., a 401 or 403 might mean the API key is incorrect but the auth format is right
          console.log('⚠️ Received a non-404 response, this auth format might be correct');
          
          // Show a snippet of the response data for debugging
          if (ttsResponse.data) {
            const shortResponseData = JSON.stringify(ttsResponse.data).substring(0, 100);
            console.log(`Response data snippet: ${shortResponseData}...`);
          }
        }
      } catch (error) {
        console.log(`Error with ${test.name}: ${error.message}`);
      }
    }
    
    if (successfulAuth) {
      console.log(`\n✅ Found successful authentication format: ${successfulAuth.name}`);
      
      // Store the successful auth for use in other functions
      sharedState.successfulAuth = successfulAuth;
      
      // Display info response data if available
      if (infoResponse && infoResponse.status === 200 && infoResponse.data) {
        console.log('API Info Response:');
        console.log(JSON.stringify(infoResponse.data, null, 2).substring(0, 500) + '...');
        
        // Extract and display available models if present
        const models = infoResponse.data.models || infoResponse.data.voices || infoResponse.data.data || [];
        if (Array.isArray(models) && models.length > 0) {
          console.log(`\nFound ${models.length} available models/voices:`);
          models.forEach((model, index) => {
            const id = model.id || model.name || model.voice_id || 'Unknown';
            console.log(`  ${index + 1}. ${id}`);
          });
        }
      }
      
      return true;
    } else {
      console.error('❌ No successful authentication format found');
      
      // Try a few more combinations for the path and URL
      console.log('\nTrying API with DATACRUNCH_URL variants...');
      
      const urlVariants = [
        'https://api.datacrunch.io',
        'https://api.datacrunch.io/v1',
        'https://api.datacrunch.io/api'
      ];
      
      // Use a combined auth headers approach with all formats
      const combinedHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-API-KEY': DATACRUNCH_API_KEY,
        'x-api-key': DATACRUNCH_API_KEY,
        'Authorization': `Bearer ${DATACRUNCH_API_KEY}`
      };
      
      for (const url of urlVariants) {
        console.log(`Testing URL: ${url}`);
        
        try {
          const resp = await axios.get(url, { 
            headers: combinedHeaders,
            timeout: 5000,
            validateStatus: null
          });
          
          console.log(`Response: ${resp.status} ${resp.statusText}`);
          
          if (resp.status === 200) {
            console.log('✅ Found working URL variant!');
            break;
          }
        } catch (error) {
          console.log(`Error with ${url}: ${error.message}`);
        }
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Failed to connect to DataCrunch API:');
    console.error(`Error: ${error.message}`);
    
    return false;
  }
}

/**
 * Generate a test voice sample using DataCrunch API
 */
async function testVoiceGeneration() {
  console.log('\nTesting voice generation with DataCrunch API...');
  
  if (!sharedState.successfulAuth) {
    console.error('No successful authentication method found. Cannot proceed with voice generation.');
    return false;
  }
  
  const headers = sharedState.successfulAuth.headers;
  console.log(`Using auth format: ${sharedState.successfulAuth.name}`);
  
  try {
    // Prepare request payload
    const payload = {
      text: TEST_TEXT,
      voice_id: "speaker_0",  // Default voice
      model_id: "tts1"        // Default model
    };
    
    // Add settings based on API documentation
    const settings = {
      stability: 0.5,
      similarity: 0.75,
      style: 0.0,
      speaker_boost: true
    };
    
    // Use two payload formats: with settings nested and with settings at root level
    const payloadWithNestedSettings = {
      ...payload,
      settings
    };
    
    console.log(`Generating voice for text: "${TEST_TEXT.substring(0, 50)}..."`);
    console.log('Request payload:', JSON.stringify(payloadWithNestedSettings, null, 2));
    
    // Make API request
    let response = null;
    
    // Try with nested settings first
    try {
      console.log('Trying with nested settings...');
      response = await axios.post(`${DATACRUNCH_URL}/tts`, payloadWithNestedSettings, {
        headers,
        timeout: 15000,  // 15 second timeout for voice generation
        responseType: 'json'
      });
    } catch (nestedError) {
      console.log(`Error with nested settings: ${nestedError.message}`);
      
      // If nested settings fail, try with flat settings
      console.log('Trying with flat settings...');
      
      const flatPayload = {
        ...payload,
        ...settings
      };
      
      response = await axios.post(`${DATACRUNCH_URL}/tts`, flatPayload, {
        headers,
        timeout: 15000,
        responseType: 'json'
      });
    }
    
    // Process response
    if (response.status === 200) {
      console.log('✅ Voice generation request successful!');
      
      // Process response data
      const data = response.data;
      
      // Check for errors in response
      if (data.error) {
        console.error(`❌ API returned error: ${data.error}`);
        return false;
      }
      
      if (data.success === false) {
        console.error(`❌ API returned success: false. Message: ${data.message || 'No message provided'}`);
        return false;
      }
      
      // Different APIs return audio data in different formats
      let audioData = null;
      
      // Common patterns for audio data
      if (data.audio_data) {
        audioData = data.audio_data;
      } else if (data.data?.audio_data) {
        audioData = data.data.audio_data;
      } else if (data.result?.audio_data) {
        audioData = data.result.audio_data;
      } else if (data.audio) {
        audioData = data.audio;
      } else if (typeof data === 'string' && data.startsWith('data:audio')) {
        // Handle data URI format
        const base64Data = data.split(',')[1];
        audioData = base64Data;
      }
      
      // Check if we found audio data
      if (!audioData) {
        console.error('❌ No audio data found in response');
        console.error('Response data:', JSON.stringify(data, null, 2));
        return false;
      }
      
      // Save audio file
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
        // Linux or other
        console.log(`Audio file saved at: ${OUTPUT_FILE}`);
        console.log('Use your system audio player to play the file.');
      }
      
      return true;
    } else {
      console.error(`❌ Voice generation failed with status code: ${response.status}`);
      
      if (response.data) {
        console.error('Response data:', JSON.stringify(response.data, null, 2));
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to generate voice sample:');
    
    if (error.response) {
      // Server responded with an error
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // No response received
      console.error('No response received from server');
    } else {
      // Request setup error
      console.error(`Error: ${error.message}`);
    }
    
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('DataCrunch API Integration Test (Direct API Key)');
  console.log('============================================\n');
  
  console.log('Current configuration:');
  console.log(`DataCrunch URL: ${DATACRUNCH_URL || 'Not set'}`);
  console.log(`DataCrunch API Key: ${DATACRUNCH_API_KEY ? DATACRUNCH_API_KEY.substring(0, 3) + '...' + DATACRUNCH_API_KEY.substring(DATACRUNCH_API_KEY.length - 3) : 'Not set'}`);
  console.log('');
  
  // Step 1: Test the API Connection
  const connectionSuccess = await testDataCrunchConnection();
  if (!connectionSuccess) {
    console.error('\n❌ DataCrunch API connection test failed. Cannot proceed with voice generation.');
    console.log('\nTroubleshooting suggestions:');
    console.log(' - Verify your API key is correct and has access to TTS features');
    console.log(' - Check if the DataCrunch API endpoint URL is correct (tried both with and without /v1)');
    console.log(' - Ensure you have internet connectivity and can reach the DataCrunch servers');
    console.log(' - Try accessing the DataCrunch dashboard directly to verify your credentials');
    return;
  }
  
  // Step 2: Test Voice Generation
  const generationSuccess = await testVoiceGeneration();
  if (!generationSuccess) {
    console.error('\n❌ Voice generation test failed.');
    console.log('\nPossible reasons:');
    console.log(' - The API key may not have permission to generate voices');
    console.log(' - The TTS endpoint or required parameters may be different than expected');
    console.log(' - There might be a rate limit or quota issue with your account');
    console.log(' - Try examining the API documentation for correct voice_id and model_id values');
    return;
  }
  
  console.log('\n✅ All tests completed successfully!');
  console.log('The DataCrunch API integration is working correctly with direct API key authentication.');
}

// Run the main function
main().catch(error => {
  console.error('\nUnhandled error:', error.message);
  console.error('Stack trace:', error.stack);
});