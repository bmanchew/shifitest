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

// Try without the /v1 suffix first, as many OAuth implementations have token endpoints at root level
process.env.DATACRUNCH_URL = 'https://api.datacrunch.io';
console.log('Updated DATACRUNCH_URL:', process.env.DATACRUNCH_URL);

// Check required environment variables
const DATACRUNCH_URL = process.env.DATACRUNCH_URL;
const DATACRUNCH_API_KEY = process.env.DATACRUNCH_API_KEY;

// Keeping client ID and secret variables for backward compatibility
const DATACRUNCH_CLIENT_ID = process.env.DATACRUNCH_CLIENT_ID;
const DATACRUNCH_CLIENT_SECRET = process.env.DATACRUNCH_CLIENT_SECRET;

// Test constants
const TEST_TEXT = "Hello, this is a test of the DataCrunch API integration. If you hear this message, the integration is working correctly.";
const OUTPUT_FOLDER = path.join(__dirname, 'audio_test_outputs');
const OUTPUT_FILE = path.join(OUTPUT_FOLDER, `test_datacrunch_${Date.now()}.wav`);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
}

/**
 * Get OAuth access token using client credentials flow
 */
async function getOAuthAccessToken() {
  console.log('Obtaining OAuth access token using client credentials...');
  
  if (!DATACRUNCH_CLIENT_ID || !DATACRUNCH_CLIENT_SECRET) {
    console.error('ERROR: DATACRUNCH_CLIENT_ID and/or DATACRUNCH_CLIENT_SECRET environment variables are not set');
    return null;
  }
  
  try {
    // OAuth token endpoint is typically at /oauth/token or /v1/oauth/token
    const tokenEndpoints = [
      '/oauth/token',
      '/token',
      '/auth/token',
      '/v1/oauth/token',
      '/auth/v1/token'
    ];
    
    let tokenResponse = null;
    let successfulEndpoint = null;
    
    for (const endpoint of tokenEndpoints) {
      const tokenUrl = `${DATACRUNCH_URL}${endpoint}`;
      console.log(`Trying OAuth token endpoint: ${tokenUrl}`);
      
      try {
        // Standard OAuth 2.0 client credentials grant
        const payload = {
          grant_type: 'client_credentials',
          client_id: DATACRUNCH_CLIENT_ID,
          client_secret: DATACRUNCH_CLIENT_SECRET
        };
        
        // Some APIs expect form-urlencoded content type for OAuth requests
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', DATACRUNCH_CLIENT_ID);
        params.append('client_secret', DATACRUNCH_CLIENT_SECRET);
        
        // Try both JSON and form-urlencoded formats
        const formHeaders = {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        };
        
        const jsonHeaders = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        
        // Try form-urlencoded first (most common for OAuth)
        tokenResponse = await axios.post(tokenUrl, params, { 
          headers: formHeaders,
          timeout: 5000,
          validateStatus: null
        });
        
        // If that fails with a 415 Unsupported Media Type, try JSON
        if (tokenResponse.status === 415) {
          console.log('Trying JSON format for token request...');
          tokenResponse = await axios.post(tokenUrl, payload, { 
            headers: jsonHeaders,
            timeout: 5000,
            validateStatus: null
          });
        }
        
        console.log(`Response: ${tokenResponse.status} ${tokenResponse.statusText}`);
        
        if (tokenResponse.status === 200) {
          console.log('✅ Successfully obtained access token!');
          successfulEndpoint = endpoint;
          break;
        } else {
          // Show a snippet of the response data for debugging
          const shortResponseData = JSON.stringify(tokenResponse.data).substring(0, 100);
          console.log(`Response data snippet: ${shortResponseData}...`);
        }
      } catch (error) {
        console.log(`Error with ${tokenUrl}: ${error.message}`);
      }
      
      console.log('-----------------------');
    }
    
    if (!successfulEndpoint) {
      // Try one more approach - some APIs use a different format or endpoint
      console.log('Trying alternative token request format...');
      
      try {
        // Some APIs put client ID/secret in Basic Auth header
        const authString = Buffer.from(`${DATACRUNCH_CLIENT_ID}:${DATACRUNCH_CLIENT_SECRET}`).toString('base64');
        const headers = {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        };
        
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        
        tokenResponse = await axios.post(`${DATACRUNCH_URL}/oauth/token`, params, { 
          headers,
          timeout: 5000,
          validateStatus: null
        });
        
        console.log(`Response: ${tokenResponse.status} ${tokenResponse.statusText}`);
        
        if (tokenResponse.status === 200) {
          console.log('✅ Successfully obtained access token using Basic Auth!');
        } else {
          const shortResponseData = JSON.stringify(tokenResponse.data).substring(0, 100);
          console.log(`Response data snippet: ${shortResponseData}...`);
        }
      } catch (error) {
        console.log(`Error with basic auth approach: ${error.message}`);
      }
    }
    
    // Extract the access token if available
    if (tokenResponse && tokenResponse.status === 200 && tokenResponse.data) {
      const tokenData = tokenResponse.data;
      
      // Different APIs use different field names for the token
      const token = tokenData.access_token || tokenData.token || tokenData.id_token;
      
      if (token) {
        console.log(`Access token obtained (first 10 chars): ${token.substring(0, 10)}...`);
        
        // Save the token for other functions to use
        accessToken = token;
        return token;
      } else {
        console.error('Response did not contain a valid access token field');
        console.error('Response data:', tokenData);
        return null;
      }
    } else {
      console.error('Failed to obtain access token');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to obtain OAuth access token:');
    console.error(`Error: ${error.message}`);
    return null;
  }
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
  
  if (!DATACRUNCH_CLIENT_ID || !DATACRUNCH_CLIENT_SECRET) {
    console.error('ERROR: DATACRUNCH_CLIENT_ID and/or DATACRUNCH_CLIENT_SECRET environment variables are not set');
    return false;
  }
  
  try {
    // Step 1: Get OAuth access token
    const token = await getOAuthAccessToken();
    
    if (!token) {
      throw new Error('Failed to obtain access token');
    }
    
    console.log('\nTesting API endpoints with access token...');
    
    // Try API endpoints with access token
    const authHeader = { 'Authorization': `Bearer ${token}` };
    
    // Try basic info endpoint first
    console.log('Testing API info endpoint...');
    
    const infoEndpoints = [
      '/',
      '/info',
      '/api',
      '/v1',
      '/models'
    ];
    
    let response = null;
    let successfulEndpoint = null;
    
    for (const endpoint of infoEndpoints) {
      const fullUrl = `${DATACRUNCH_URL}${endpoint}`;
      console.log(`Trying ${fullUrl}...`);
      
      try {
        response = await axios.get(fullUrl, { 
          headers: authHeader,
          timeout: 5000,
          validateStatus: null
        });
        
        console.log(`Response: ${response.status} ${response.statusText}`);
        
        if (response.status === 200) {
          console.log('✅ Found valid API endpoint!');
          successfulEndpoint = endpoint;
          
          // Show a snippet of the response data
          const shortResponseData = JSON.stringify(response.data).substring(0, 100);
          console.log(`Response data snippet: ${shortResponseData}...`);
          
          break;
        } else {
          // Show the response data for debugging
          const shortResponseData = JSON.stringify(response.data).substring(0, 100);
          console.log(`Response data snippet: ${shortResponseData}...`);
        }
      } catch (error) {
        console.log(`Error with ${fullUrl}: ${error.message}`);
      }
      
      console.log('-----------------------');
    }
    
    // Now try TTS-specific endpoints
    console.log('\nTesting TTS endpoints with access token...');
    
    const ttsEndpoints = [
      '/tts',
      '/api/tts', 
      '/v1/tts',
      '/text-to-speech',
      '/synthesize'
    ];
    
    let ttsSucessfulEndpoint = null;
    
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
          headers: { 
            ...authHeader, 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 5000,
          validateStatus: null
        });
        
        console.log(`Response: ${response.status} ${response.statusText}`);
        
        // Any non-404 response might indicate this is a valid endpoint
        if (response.status !== 404) {
          console.log('⚠️ Found potential TTS endpoint (non-404 response)');
          ttsSucessfulEndpoint = endpoint;
          
          // Show the response data for debugging
          const shortResponseData = JSON.stringify(response.data).substring(0, 100);
          console.log(`Response data snippet: ${shortResponseData}...`);
          
          if (response.status === 200) {
            console.log('✅ TTS endpoint returned success!');
            break;
          }
        }
      } catch (error) {
        console.log(`Error with ${fullUrl}: ${error.message}`);
      }
      
      console.log('-----------------------');
    }
    
    // Success criteria - we either found an info endpoint or a TTS endpoint
    if (successfulEndpoint || ttsSucessfulEndpoint) {
      console.log('✅ Successfully connected to DataCrunch API');
      
      // If we have an info endpoint response with models, display them
      if (response && response.status === 200 && response.data) {
        const models = response.data.data || response.data.models || [];
        if (Array.isArray(models) && models.length > 0) {
          console.log(`Found ${models.length} available models:`);
          models.forEach((model, index) => {
            console.log(`  ${index + 1}. ${model.id || model.name || 'Unknown model'}`);
          });
        }
      }
      
      // Store the successful TTS endpoint for later use
      if (ttsSucessfulEndpoint) {
        global.ttsEndpoint = ttsSucessfulEndpoint;
      }
      
      return true;
    } else {
      console.error('❌ Could not find a working API endpoint');
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
    console.log(' - Verify DATACRUNCH_URL is correct (should be https://api.datacrunch.io)');
    console.log(' - Check your client ID and secret and make sure they have the correct permissions');
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
    // Verify we have an access token from previous steps
    if (!accessToken) {
      console.log('No access token available, trying to obtain one...');
      accessToken = await getOAuthAccessToken();
      
      if (!accessToken) {
        throw new Error('Failed to obtain access token for voice generation');
      }
    }
    
    // Using OAuth Bearer token authentication
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };
    
    // Prepare request payload
    const payload = {
      text: TEST_TEXT,
      voice_id: "speaker_0",  // Default female voice
      model_id: "tts1"  // Change this to a model ID from your available models
    };
    
    // Add optional settings if needed
    const settings = {
      stability: 0.5,
      similarity: 0.75,
      style: 0.0,
      speaker_boost: true,
      temperature: 0.9,
      top_k: 50,
      max_duration_seconds: 30
    };
    
    // Some APIs expect settings at the root level, others nested
    // Let's try both formats to be safe
    const payloadWithNestedSettings = {
      ...payload,
      settings
    };
    
    const payloadWithFlatSettings = {
      ...payload,
      ...settings
    };
    
    // Determine which TTS endpoint to use
    let ttsEndpoint = '/tts';
    if (global.ttsEndpoint) {
      ttsEndpoint = global.ttsEndpoint;
      console.log(`Using discovered TTS endpoint: ${ttsEndpoint}`);
    }
    
    // Make the API request
    console.log(`Generating voice sample for text: "${TEST_TEXT.substring(0, 50)}..."`);
    
    // Try first with nested settings
    let response = null;
    try {
      console.log('Trying with nested settings format...');
      response = await axios.post(`${DATACRUNCH_URL}${ttsEndpoint}`, payloadWithNestedSettings, { 
        headers,
        timeout: 10000,  // Increased timeout for TTS generation
        responseType: 'json',
        validateStatus: null
      });
    } catch (nestedError) {
      console.log(`Error with nested settings: ${nestedError.message}`);
      
      // If the first attempt fails, try with flat settings
      console.log('Trying with flat settings format...');
      response = await axios.post(`${DATACRUNCH_URL}${ttsEndpoint}`, payloadWithFlatSettings, { 
        headers,
        timeout: 10000,
        responseType: 'json',
        validateStatus: null
      });
    }
    
    if (response.status === 200) {
      console.log('✅ Voice generation request successful');
      
      // Process response
      const data = response.data;
      
      // Check for success flag if present
      if (data.success === false) {
        console.error(`❌ API returned success=false: ${data.message || 'Unknown error'}`);
        return false;
      }
      
      // Extract audio data - different APIs return data in different formats
      let audioData = null;
      
      // Common patterns for audio data in API responses
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
      
      if (!audioData) {
        console.error('❌ No audio data found in response');
        console.error('Response data:', JSON.stringify(data).substring(0, 200) + '...');
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
      if (response.data) {
        console.error(JSON.stringify(response.data).substring(0, 200) + '...');
      }
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
  console.log('DataCrunch API Integration Test (OAuth Version)');
  console.log('=============================================\n');
  
  console.log('Current configuration:');
  console.log(`DataCrunch URL: ${DATACRUNCH_URL || 'Not set'}`);
  console.log(`DataCrunch Client ID: ${DATACRUNCH_CLIENT_ID ? DATACRUNCH_CLIENT_ID.substring(0, 3) + '...' + DATACRUNCH_CLIENT_ID.substring(DATACRUNCH_CLIENT_ID.length - 3) : 'Not set'}`);
  console.log(`DataCrunch Client Secret: ${DATACRUNCH_CLIENT_SECRET ? '********' : 'Not set'}`);
  console.log('');
  
  // Step 1: Test API Connection
  const connectionSuccess = await testDataCrunchConnection();
  if (!connectionSuccess) {
    console.error('\n❌ DataCrunch API connection test failed. Cannot proceed with voice generation test.');
    console.log('\nTroubleshooting suggestions:');
    console.log(' - Check if the DataCrunch service is accessible from your network');
    console.log(' - Verify that your client ID and client secret are correct');
    console.log(' - Check if your DataCrunch account has access to the TTS features');
    console.log(' - Try accessing the DataCrunch dashboard directly in a browser to verify your credentials');
    return;
  }
  
  // Step 2: Test Voice Generation
  const generationSuccess = await testVoiceGeneration();
  if (!generationSuccess) {
    console.error('\n❌ Voice generation test failed.');
    console.log('\nPossible reasons:');
    console.log(' - The TTS endpoint may be different than what we\'re testing');
    console.log(' - Your account may not have access to voice generation features');
    console.log(' - The voice model or settings may need to be adjusted');
    console.log(' - There might be a rate limit or quota issue');
    return;
  }
  
  console.log('\n✅ All tests completed successfully!');
  console.log('The DataCrunch API integration is working correctly using OAuth authentication.');
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error.message);
});