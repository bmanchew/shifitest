/**
 * DataCrunch Final Test Script
 * 
 * This tries one more set of endpoint patterns with project ID in headers and URL.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current filename and directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Constants from our JWT inspection
const PROJECT_ID = 'e1452033-8763-4e59-98a5-1691ebaadf35';
const USER_ID = 'a84d3099-b1ee-4bf0-b1f5-3e616acfdfef';

// API keys and client info
const DATACRUNCH_API_KEY = process.env.DATACRUNCH_API_KEY;
const DATACRUNCH_CLIENT_ID = process.env.DATACRUNCH_CLIENT_ID;
const DATACRUNCH_CLIENT_SECRET = process.env.DATACRUNCH_CLIENT_SECRET;

// OAuth token endpoint
const OAUTH_ENDPOINT = 'https://api.datacrunch.io/v1/oauth2/token';

// Test text
const TEST_TEXT = "Hello, this is a final test of the DataCrunch API.";

// Output folder for audio files
const OUTPUT_FOLDER = path.join(__dirname, 'audio_test_outputs');
const OUTPUT_FILE = path.join(OUTPUT_FOLDER, `test_datacrunch_final_${Date.now()}.wav`);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
}

/**
 * Get OAuth token
 */
async function getOAuthToken() {
  console.log('Getting OAuth token...');
  
  try {
    const payload = {
      grant_type: 'client_credentials',
      client_id: DATACRUNCH_CLIENT_ID,
      client_secret: DATACRUNCH_CLIENT_SECRET
    };
    
    const response = await axios.post(OAUTH_ENDPOINT, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (response.status === 200 && response.data && response.data.access_token) {
      console.log('✅ Token obtained successfully');
      return response.data.access_token;
    } else {
      console.error('Failed to get token');
      return null;
    }
  } catch (error) {
    console.error('OAuth error:', error.message);
    return null;
  }
}

/**
 * Test endpoints with all possible combinations
 */
async function testEndpoints(token) {
  console.log('\nTesting final set of endpoints...');
  
  // API base URL variations
  const baseUrls = [
    'https://api.datacrunch.io',
    'https://api.datacrunch.io/v1',
    'https://31.22.104.29',
    'https://31.22.104.29/v1',
    'https://api.datacrunch.io/v1/api',
    `https://api.datacrunch.io/v1/projects/${PROJECT_ID}`
  ];
  
  // Endpoint path variations
  const endpoints = [
    '/tts',
    '/synthesize',
    '/speech/synthesize',
    '/text-to-speech',
    '/inference/tts',
    '/voice/tts',
    '/generate',
    '/audio/tts'
  ];
  
  // Authentication header variations
  const authHeaders = [
    // OAuth token only
    {
      name: 'OAuth Bearer',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    },
    // OAuth token with project ID
    {
      name: 'OAuth + Project ID header',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Project-ID': PROJECT_ID,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    },
    // API key variations
    {
      name: 'X-API-KEY',
      headers: {
        'X-API-KEY': DATACRUNCH_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    },
    // Combined OAuth and API Key
    {
      name: 'OAuth + API Key',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-API-KEY': DATACRUNCH_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
  ];
  
  // Payload variations
  const payloadVariations = [
    // Base payload
    {
      name: 'Standard',
      payload: {
        text: TEST_TEXT,
        voice_id: "speaker_0"
      }
    },
    // With project ID
    {
      name: 'With Project ID',
      payload: {
        text: TEST_TEXT,
        voice_id: "speaker_0",
        project_id: PROJECT_ID
      }
    },
    // With model
    {
      name: 'With Model',
      payload: {
        text: TEST_TEXT,
        voice_id: "speaker_0",
        model_id: "tts1"
      }
    }
  ];
  
  // Track working combinations
  let successCount = 0;
  
  // Try combinations systematically but with intelligent prioritization
  for (const authHeader of authHeaders) {
    // OAuth should have priority
    if (authHeader.name.includes('OAuth')) {
      for (const baseUrl of baseUrls) {
        for (const endpoint of endpoints) {
          for (const payloadVar of payloadVariations) {
            const result = await tryRequest(
              baseUrl, 
              endpoint, 
              authHeader, 
              payloadVar
            );
            
            if (result.success) {
              successCount++;
              // Save the successful combination
              writeSuccessfulConfig(baseUrl, endpoint, authHeader, payloadVar);
            }
          }
        }
      }
    }
    // Only try API key if OAuth didn't work
    else if (successCount === 0) {
      for (const baseUrl of baseUrls) {
        for (const endpoint of endpoints) {
          for (const payloadVar of payloadVariations) {
            const result = await tryRequest(
              baseUrl, 
              endpoint, 
              authHeader, 
              payloadVar
            );
            
            if (result.success) {
              successCount++;
              writeSuccessfulConfig(baseUrl, endpoint, authHeader, payloadVar);
            }
          }
        }
      }
    }
  }
  
  return successCount > 0;
}

/**
 * Try a single request combination
 */
async function tryRequest(baseUrl, endpoint, authHeader, payloadVar) {
  const url = `${baseUrl}${endpoint}`;
  console.log(`\nTrying ${authHeader.name} with ${payloadVar.name} payload at ${url}`);
  
  try {
    const response = await axios.post(url, payloadVar.payload, {
      headers: authHeader.headers,
      timeout: 10000,
      validateStatus: null
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ SUCCESS');
      
      if (response.data) {
        // Limit output size
        const responsePreview = JSON.stringify(response.data).slice(0, 100) + '...';
        console.log(`Response: ${responsePreview}`);
        
        // Try to save audio if available
        if (
          response.data.audio_data || 
          response.data.data?.audio_data || 
          response.data.audio
        ) {
          const audioData = response.data.audio_data || 
                           response.data.data?.audio_data || 
                           response.data.audio;
          
          if (audioData) {
            const buffer = Buffer.from(audioData, 'base64');
            fs.writeFileSync(OUTPUT_FILE, buffer);
            console.log(`✅ Audio file saved to: ${OUTPUT_FILE}`);
          }
        }
      }
      
      return { success: true, data: response.data };
    } 
    else if (response.status !== 404) {
      console.log('⚠️ Non-404 response, possibly promising:');
      if (response.data) {
        console.log(JSON.stringify(response.data, null, 2));
      }
    }
    
    return { success: false };
  } catch (error) {
    console.log(`Error: ${error.message}`);
    return { success: false };
  }
}

/**
 * Write successful configuration to a file
 */
function writeSuccessfulConfig(baseUrl, endpoint, authHeader, payloadVar) {
  const config = {
    url: `${baseUrl}${endpoint}`,
    headers: authHeader.headers,
    payload: payloadVar.payload,
    authName: authHeader.name,
    payloadName: payloadVar.name
  };
  
  const configFile = path.join(__dirname, 'datacrunch-successful-config.json');
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  console.log(`Successful configuration saved to: ${configFile}`);
}

/**
 * Main function
 */
async function main() {
  console.log('DataCrunch Final Test');
  console.log('===================\n');
  
  // Get OAuth token
  const token = await getOAuthToken();
  if (!token) {
    console.error('Failed to get OAuth token. Cannot proceed.');
    return;
  }
  
  // Test all endpoint combinations
  const success = await testEndpoints(token);
  
  if (success) {
    console.log('\n✅ Found working endpoint combination!');
    console.log('Check datacrunch-successful-config.json for details');
  } else {
    console.log('\n❌ Could not find a working endpoint');
    console.log('You will need to:');
    console.log('1. Contact DataCrunch support for API documentation');
    console.log('2. Verify your account has the necessary permissions for TTS');
    console.log('3. Consider using a fallback like Hugging Face or other TTS service');
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error.message);
});