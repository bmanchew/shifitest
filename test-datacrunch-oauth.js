/**
 * DataCrunch API Test Script - OAuth Authentication Test
 * 
 * This script focuses on testing the OAuth authentication with DataCrunch
 * based on the successful token retrieval we observed.
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

console.log('Environment variables loaded');
console.log('DATACRUNCH_URL:', process.env.DATACRUNCH_URL || 'Not found');
console.log('DATACRUNCH_CLIENT_ID:', process.env.DATACRUNCH_CLIENT_ID ? 'Found (masked)' : 'Not found');
console.log('DATACRUNCH_CLIENT_SECRET:', process.env.DATACRUNCH_CLIENT_SECRET ? 'Found (masked)' : 'Not found');

// Check required environment variables
const DATACRUNCH_URL = process.env.DATACRUNCH_URL;
// Make sure URL has proper format with protocol
const formattedUrl = DATACRUNCH_URL && DATACRUNCH_URL.startsWith('http') 
  ? DATACRUNCH_URL 
  : `https://${DATACRUNCH_URL || 'api.datacrunch.io/v1'}`;
const DATACRUNCH_CLIENT_ID = process.env.DATACRUNCH_CLIENT_ID;
const DATACRUNCH_CLIENT_SECRET = process.env.DATACRUNCH_CLIENT_SECRET;

// Test constants
const TEST_TEXT = "Hello, this is a test of the DataCrunch API OAuth integration.";
const OUTPUT_FOLDER = path.join(__dirname, 'audio_test_outputs');
const OUTPUT_FILE = path.join(OUTPUT_FOLDER, `test_datacrunch_oauth_${Date.now()}.wav`);

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
    console.error('Missing client ID or secret, cannot proceed');
    return null;
  }
  
  try {
    // Based on our testing, this endpoint worked
    const tokenUrl = 'https://api.datacrunch.io/v1/oauth2/token';
    console.log(`Using OAuth endpoint: ${tokenUrl}`);
    
    // Standard OAuth2 client credentials flow payload
    const payload = {
      grant_type: 'client_credentials',
      client_id: DATACRUNCH_CLIENT_ID,
      client_secret: DATACRUNCH_CLIENT_SECRET
    };
    
    console.log('Requesting token...');
    const response = await axios.post(tokenUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 200 && response.data) {
      // Look for access_token in the response
      const token = response.data.access_token || 
                    response.data.token || 
                    response.data.accessToken;
      
      if (token) {
        console.log('✅ Successfully obtained OAuth token!');
        console.log('Token response:', JSON.stringify(response.data, null, 2));
        return token;
      } else {
        console.log('⚠️ Response status 200 but no token found');
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        return null;
      }
    } else {
      console.error('Failed to obtain token');
      console.error('Response:', response.status, response.statusText);
      if (response.data) {
        console.error('Response data:', JSON.stringify(response.data, null, 2));
      }
      return null;
    }
  } catch (error) {
    console.error('❌ OAuth flow error:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

/**
 * Test using the OAuth token to generate a voice sample
 */
async function testOAuthVoiceGeneration(token) {
  console.log('\nTesting voice generation with OAuth token...');
  
  if (!token) {
    console.error('No OAuth token available. Cannot proceed with voice generation.');
    return false;
  }
  
  // Use the known working API base URL 
  // DATACRUNCH_URL may be an IP address that doesn't support TTS
  const baseUrl = 'https://api.datacrunch.io/v1';
  const ttsEndpoint = '/tts';
  
  // Set up OAuth Bearer authentication
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  
  console.log(`Using API URL: ${baseUrl}${ttsEndpoint}`);
  console.log('Using OAuth Bearer token authentication');
  
  try {
    // Basic payload for TTS
    const payload = {
      text: TEST_TEXT,
      voice_id: "speaker_0"  // Default voice
    };
    
    console.log(`Generating voice for text: "${TEST_TEXT}"`);
    console.log('Request payload:', JSON.stringify(payload, null, 2));
    
    // Make API request
    const response = await axios.post(`${baseUrl}${ttsEndpoint}`, payload, {
      headers,
      timeout: 15000,  // 15 second timeout for voice generation
      responseType: 'json'
    });
    
    // Process response
    if (response.status === 200) {
      console.log('✅ Voice generation request successful!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      
      // Extract audio data if available
      const data = response.data;
      let audioData = null;
      
      // Try different patterns for audio data in response
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
        return false;
      }
      
      // Save audio file
      const buffer = Buffer.from(audioData, 'base64');
      fs.writeFileSync(OUTPUT_FILE, buffer);
      
      console.log(`✅ Audio file saved to: ${OUTPUT_FILE}`);
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
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('DataCrunch API OAuth Authentication Test');
  console.log('=====================================\n');
  
  console.log('Current configuration:');
  console.log(`DataCrunch URL: ${DATACRUNCH_URL}`);
  console.log(`Formatted URL: ${formattedUrl}`);
  console.log(`DataCrunch Client ID: ${DATACRUNCH_CLIENT_ID ? 'Set (masked)' : 'Not set'}`);
  console.log(`DataCrunch Client Secret: ${DATACRUNCH_CLIENT_SECRET ? 'Set (masked)' : 'Not set'}`);
  console.log('');
  
  // Step 1: Get OAuth token
  const token = await getOAuthToken();
  if (!token) {
    console.error('\n❌ Failed to obtain OAuth token. Cannot proceed.');
    return;
  }
  
  // Step 2: Test voice generation with OAuth token
  const success = await testOAuthVoiceGeneration(token);
  if (!success) {
    console.error('\n❌ Voice generation with OAuth token failed.');
    return;
  }
  
  console.log('\n✅ OAuth authentication and voice generation successful!');
  console.log('Implementation notes:');
  console.log('1. Use the /v1/oauth2/token endpoint to get an OAuth token');
  console.log('2. Use Bearer token authentication for API requests');
  console.log('3. The token likely expires, so implement token refresh logic');
}

// Run the main function
main().catch(error => {
  console.error('\nUnhandled error:', error.message);
});