/**
 * DataCrunch API Test Script - Comprehensive Authentication Testing
 * 
 * This script tries every possible combination of authentication methods for DataCrunch:
 * 1. Direct API key with various header formats
 * 2. OAuth client credentials flow
 * 3. Different URL variants and endpoint patterns
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
console.log('DATACRUNCH_URL:', process.env.DATACRUNCH_URL || 'Not found');
console.log('DATACRUNCH_API_KEY:', process.env.DATACRUNCH_API_KEY ? 'Found (masked)' : 'Not found');
console.log('DATACRUNCH_CLIENT_ID:', process.env.DATACRUNCH_CLIENT_ID ? 'Found (masked)' : 'Not found');
console.log('DATACRUNCH_CLIENT_SECRET:', process.env.DATACRUNCH_CLIENT_SECRET ? 'Found (masked)' : 'Not found');

// Check required environment variables
const DATACRUNCH_URL = process.env.DATACRUNCH_URL;
const DATACRUNCH_API_KEY = process.env.DATACRUNCH_API_KEY;
const DATACRUNCH_CLIENT_ID = process.env.DATACRUNCH_CLIENT_ID;
const DATACRUNCH_CLIENT_SECRET = process.env.DATACRUNCH_CLIENT_SECRET;

// Creating a shared state object to replace global variables in ES modules
const sharedState = {
  successfulAuth: null,
  ttsEndpoint: '/tts',
  oauthToken: null
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
 * Get OAuth token using client credentials
 */
async function getOAuthToken() {
  console.log('\nAttempting to get OAuth token with client credentials...');
  
  if (!DATACRUNCH_CLIENT_ID || !DATACRUNCH_CLIENT_SECRET) {
    console.log('Missing client ID or secret, skipping OAuth flow');
    return null;
  }
  
  try {
    // Try different OAuth token endpoint patterns
    const tokenEndpoints = [
      '/oauth/token',
      '/oauth2/token',
      '/v1/oauth/token',
      '/v1/oauth2/token',
      '/auth/token',
      '/token'
    ];
    
    // Try different base URLs
    const baseUrls = [
      'https://api.datacrunch.io',
      'https://api.datacrunch.io/v1',
      'https://auth.datacrunch.io',
      DATACRUNCH_URL
    ];
    
    // Try different payload formats
    const payloadFormats = [
      // Standard OAuth2 format
      {
        grant_type: 'client_credentials',
        client_id: DATACRUNCH_CLIENT_ID,
        client_secret: DATACRUNCH_CLIENT_SECRET
      },
      // Format with underscores
      {
        grant_type: 'client_credentials',
        client_id: DATACRUNCH_CLIENT_ID,
        client_secret: DATACRUNCH_CLIENT_SECRET
      },
      // Format with camelCase
      {
        grantType: 'client_credentials',
        clientId: DATACRUNCH_CLIENT_ID,
        clientSecret: DATACRUNCH_CLIENT_SECRET
      }
    ];
    
    // Try all combinations
    for (const baseUrl of baseUrls) {
      for (const endpoint of tokenEndpoints) {
        for (const payload of payloadFormats) {
          const tokenUrl = `${baseUrl}${endpoint}`;
          console.log(`Trying OAuth endpoint: ${tokenUrl}`);
          
          try {
            const response = await axios.post(tokenUrl, payload, {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              timeout: 5000,
              validateStatus: null // Don't throw on error status codes
            });
            
            console.log(`Response: ${response.status} ${response.statusText}`);
            
            if (response.status === 200 && response.data) {
              // Look for access_token or token in the response
              const token = response.data.access_token || 
                            response.data.token || 
                            response.data.accessToken;
              
              if (token) {
                console.log('✅ Successfully obtained OAuth token!');
                return token;
              } else {
                console.log('⚠️ Response status 200 but no token found');
                console.log('Response data:', JSON.stringify(response.data, null, 2));
              }
            } else if (response.status === 401 || response.status === 403) {
              // Authentication issue - log more details for debugging
              console.log('⚠️ Authentication error');
              if (response.data) {
                console.log('Error details:', JSON.stringify(response.data, null, 2));
              }
            }
          } catch (error) {
            console.log(`Error with ${tokenUrl}: ${error.message}`);
          }
        }
      }
    }
    
    console.log('❌ Failed to obtain OAuth token from any endpoint');
    return null;
  } catch (error) {
    console.error('❌ OAuth flow error:', error.message);
    return null;
  }
}

/**
 * Test the DataCrunch API connection using multiple auth approaches
 */
async function testDataCrunchConnection() {
  console.log('\nTesting DataCrunch API connection with multiple auth approaches...');
  
  // Validate required env vars
  if (!DATACRUNCH_URL) {
    console.error('ERROR: DATACRUNCH_URL environment variable is not set');
    return false;
  }
  
  // Try to get OAuth token first
  const oauthToken = await getOAuthToken();
  if (oauthToken) {
    sharedState.oauthToken = oauthToken;
    console.log('✅ Successfully obtained OAuth token, will try this first');
  }
  
  try {
    // Collection of auth approaches to test
    const authTests = [];
    
    // Add OAuth token approaches if we have a token
    if (oauthToken) {
      authTests.push({
        name: 'OAuth Bearer Token',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${oauthToken}`
        }
      });
    }
    
    // Add direct API key approaches if we have an API key
    if (DATACRUNCH_API_KEY) {
      authTests.push(
        {
          name: 'X-API-KEY header',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-API-KEY': DATACRUNCH_API_KEY
          }
        },
        {
          name: 'Authorization Bearer with API Key',
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
          name: 'API-Key header',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'API-Key': DATACRUNCH_API_KEY
          }
        },
        {
          name: 'api-key header',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': DATACRUNCH_API_KEY
          }
        }
      );
    }
    
    // If we have both OAuth token and API key, try combined approach
    if (oauthToken && DATACRUNCH_API_KEY) {
      authTests.push({
        name: 'OAuth Bearer + X-API-KEY',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${oauthToken}`,
          'X-API-KEY': DATACRUNCH_API_KEY
        }
      });
    }
    
    // URL variants to try
    const urlVariants = [
      DATACRUNCH_URL,
      'https://api.datacrunch.io',
      'https://api.datacrunch.io/v1'
    ];
    
    // API endpoint patterns to try
    const endpointPatterns = [
      '', // Base URL
      '/tts',
      '/v1/tts',
      '/api/tts',
      '/speech/tts',
      '/text-to-speech',
      '/synthesize',
      '/speak'
    ];
    
    let successfulAuth = null;
    let successfulUrl = null;
    let successfulEndpoint = null;
    
    // Try each URL variant
    for (const baseUrl of urlVariants) {
      console.log(`\nTrying base URL: ${baseUrl}`);
      
      // Try each endpoint pattern
      for (const endpoint of endpointPatterns) {
        const fullUrl = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
        console.log(`\nTesting endpoint: ${fullUrl}`);
        
        // Try each auth approach
        for (const auth of authTests) {
          console.log(`\nTesting auth format: ${auth.name}`);
          
          try {
            // Try GET request first on base endpoints, POST on TTS endpoints
            let response = null;
            const isBasePath = !endpoint || endpoint === '';
            
            if (isBasePath) {
              // Test with GET for base API info
              response = await axios.get(fullUrl, { 
                headers: auth.headers,
                timeout: 5000,
                validateStatus: null
              });
              
              console.log(`GET Response: ${response.status} ${response.statusText}`);
              
              if (response.status === 200) {
                console.log('✅ Successfully connected to API endpoint!');
                successfulAuth = auth;
                successfulUrl = baseUrl;
                successfulEndpoint = endpoint;
                break;
              }
            } else {
              // For TTS endpoints, try a POST request
              const testPayload = {
                text: "Hello world",
                voice_id: "speaker_0"
              };
              
              response = await axios.post(fullUrl, testPayload, { 
                headers: auth.headers,
                timeout: 5000,
                validateStatus: null
              });
              
              console.log(`POST Response: ${response.status} ${response.statusText}`);
              
              if (response.status === 200) {
                console.log('✅ Successfully connected to API endpoint!');
                successfulAuth = auth;
                successfulUrl = baseUrl;
                successfulEndpoint = endpoint;
                break;
              }
              else if (response.status !== 404) {
                // A non-404 response might indicate we're on the right track
                console.log('⚠️ Received a non-404 response, this might be the right endpoint');
                
                // Show a snippet of the response data for debugging
                if (response.data) {
                  const shortResponseData = JSON.stringify(response.data).substring(0, 150);
                  console.log(`Response data: ${shortResponseData}...`);
                }
              }
            }
          } catch (error) {
            console.log(`Error with ${auth.name}: ${error.message}`);
          }
        }
        
        if (successfulAuth) break;
      }
      
      if (successfulAuth) break;
    }
    
    if (successfulAuth) {
      console.log(`\n✅ Found successful configuration:`);
      console.log(`URL: ${successfulUrl}`);
      console.log(`Endpoint: ${successfulEndpoint}`);
      console.log(`Auth: ${successfulAuth.name}`);
      
      // Store the successful auth in shared state
      sharedState.successfulAuth = successfulAuth;
      sharedState.baseUrl = successfulUrl;
      sharedState.ttsEndpoint = successfulEndpoint || '/tts';
      
      return true;
    } else {
      console.error('❌ No successful authentication and endpoint combination found');
      
      // Try a last-ditch approach with everything combined
      console.log('\nTrying last approach with combined headers...');
      
      const combinedHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-API-KEY': DATACRUNCH_API_KEY,
        'x-api-key': DATACRUNCH_API_KEY,
        'API-Key': DATACRUNCH_API_KEY,
        'api-key': DATACRUNCH_API_KEY
      };
      
      if (sharedState.oauthToken) {
        combinedHeaders['Authorization'] = `Bearer ${sharedState.oauthToken}`;
      } else if (DATACRUNCH_API_KEY) {
        combinedHeaders['Authorization'] = `Bearer ${DATACRUNCH_API_KEY}`;
      }
      
      for (const baseUrl of urlVariants) {
        for (const endpoint of ['/tts', '']) {
          const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
          console.log(`Testing URL: ${url}`);
          
          try {
            // Try both GET and POST depending on endpoint
            let resp = null;
            if (endpoint && endpoint.includes('tts')) {
              // For TTS, try POST
              const minimalPayload = { text: "Test", voice_id: "speaker_0" };
              resp = await axios.post(url, minimalPayload, {
                headers: combinedHeaders,
                timeout: 5000,
                validateStatus: null
              });
            } else {
              // For base URLs, try GET
              resp = await axios.get(url, { 
                headers: combinedHeaders,
                timeout: 5000,
                validateStatus: null
              });
            }
            
            console.log(`Response: ${resp.status} ${resp.statusText}`);
            
            if (resp.status === 200) {
              console.log('✅ Found working configuration!');
              sharedState.successfulAuth = { name: 'Combined Headers', headers: combinedHeaders };
              sharedState.baseUrl = baseUrl;
              sharedState.ttsEndpoint = endpoint || '/tts';
              return true;
            } else if (resp.status !== 404) {
              // Show a snippet of the response data for non-404 responses
              if (resp.data) {
                const shortResponseData = JSON.stringify(resp.data).substring(0, 150);
                console.log(`Response data: ${shortResponseData}...`);
              }
            }
          } catch (error) {
            console.log(`Error with ${url}: ${error.message}`);
          }
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
  
  const baseUrl = sharedState.baseUrl || DATACRUNCH_URL;
  const ttsEndpoint = sharedState.ttsEndpoint || '/tts';
  const headers = sharedState.successfulAuth.headers;
  
  console.log(`Using URL: ${baseUrl}${ttsEndpoint}`);
  console.log(`Using auth format: ${sharedState.successfulAuth.name}`);
  
  try {
    // Collection of payload formats to try
    const payloadFormats = [
      // Format 1: Basic with voice_id
      {
        text: TEST_TEXT,
        voice_id: "speaker_0"
      },
      // Format 2: With model_id
      {
        text: TEST_TEXT,
        voice_id: "speaker_0",
        model_id: "tts1"
      },
      // Format 3: With nested settings
      {
        text: TEST_TEXT,
        voice_id: "speaker_0",
        settings: {
          stability: 0.5,
          similarity: 0.75,
          style: 0.0,
          speaker_boost: true
        }
      },
      // Format 4: With flat settings
      {
        text: TEST_TEXT,
        voice_id: "speaker_0",
        stability: 0.5,
        similarity: 0.75,
        style: 0.0,
        speaker_boost: true
      },
      // Format 5: Alternate naming
      {
        text: TEST_TEXT,
        voiceId: "speaker_0",
        speakerId: "speaker_0",
        voice: "speaker_0"
      }
    ];
    
    // Try each payload format
    for (const payload of payloadFormats) {
      console.log(`\nTrying payload format: ${JSON.stringify(payload, null, 2)}`);
      
      try {
        // Make API request
        const response = await axios.post(`${baseUrl}${ttsEndpoint}`, payload, {
          headers,
          timeout: 15000,  // 15 second timeout for voice generation
          responseType: 'json'
        });
        
        // Process response
        if (response.status === 200) {
          console.log('✅ Voice generation request successful!');
          
          // Process response data
          const data = response.data;
          
          // Check for errors in response
          if (data.error) {
            console.error(`❌ API returned error: ${data.error}`);
            continue;
          }
          
          if (data.success === false) {
            console.error(`❌ API returned success: false. Message: ${data.message || 'No message provided'}`);
            continue;
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
            continue;
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
        }
      } catch (error) {
        console.log(`Error with payload: ${error.message}`);
        
        if (error.response) {
          // Server responded with an error
          console.error(`Status: ${error.response.status}`);
          console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }
    
    console.error('❌ All payload formats failed');
    return false;
    
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
  console.log('DataCrunch API Comprehensive Test');
  console.log('================================\n');
  
  console.log('Current configuration:');
  console.log(`DataCrunch URL: ${DATACRUNCH_URL || 'Not set'}`);
  console.log(`DataCrunch API Key: ${DATACRUNCH_API_KEY ? DATACRUNCH_API_KEY.substring(0, 3) + '...' + DATACRUNCH_API_KEY.substring(DATACRUNCH_API_KEY.length - 3) : 'Not set'}`);
  console.log(`DataCrunch Client ID: ${DATACRUNCH_CLIENT_ID ? 'Set (masked)' : 'Not set'}`);
  console.log(`DataCrunch Client Secret: ${DATACRUNCH_CLIENT_SECRET ? 'Set (masked)' : 'Not set'}`);
  console.log('');
  
  // Step 1: Test the API Connection
  const connectionSuccess = await testDataCrunchConnection();
  if (!connectionSuccess) {
    console.error('\n❌ DataCrunch API connection test failed. Cannot proceed with voice generation.');
    console.log('\nTroubleshooting suggestions:');
    console.log(' - Verify your API credentials are correct and have access to TTS features');
    console.log(' - Check if the DataCrunch API endpoint URL is correct');
    console.log(' - Ensure you have internet connectivity and can reach the DataCrunch servers');
    console.log(' - Try accessing the DataCrunch dashboard directly to verify your credentials');
    console.log(' - Contact DataCrunch support for specific API integration instructions');
    return;
  }
  
  // Step 2: Test Voice Generation
  const generationSuccess = await testVoiceGeneration();
  if (!generationSuccess) {
    console.error('\n❌ Voice generation test failed.');
    console.log('\nPossible reasons:');
    console.log(' - The credentials may not have permission to generate voices');
    console.log(' - The TTS endpoint or required parameters may be different than expected');
    console.log(' - There might be a rate limit or quota issue with your account');
    console.log(' - Try examining the API documentation for correct voice_id and model_id values');
    return;
  }
  
  console.log('\n✅ All tests completed successfully!');
  console.log('The DataCrunch API integration is working correctly.');
  
  console.log('\nSuccessful configuration for future implementation:');
  console.log(`Base URL: ${sharedState.baseUrl}`);
  console.log(`TTS Endpoint: ${sharedState.ttsEndpoint}`);
  console.log(`Auth Type: ${sharedState.successfulAuth.name}`);
  
  // Prepare code snippets for implementation
  const pythonSnippet = `
# Python implementation
import requests
import base64

base_url = "${sharedState.baseUrl}"
tts_endpoint = "${sharedState.ttsEndpoint}"
headers = ${JSON.stringify(sharedState.successfulAuth.headers, null, 2)}

payload = {
    "text": "Hello, this is a test",
    "voice_id": "speaker_0"
}

response = requests.post(f"{base_url}{tts_endpoint}", json=payload, headers=headers)
if response.status_code == 200:
    audio_data = response.json().get("audio_data")  # adjust based on actual response format
    if audio_data:
        with open("output.wav", "wb") as f:
            f.write(base64.b64decode(audio_data))
        print("Audio file saved to output.wav")
  `;
  
  console.log('\nPython implementation snippet:');
  console.log(pythonSnippet);
}

// Run the main function
main().catch(error => {
  console.error('\nUnhandled error:', error.message);
  console.error('Stack trace:', error.stack);
});