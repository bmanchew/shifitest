/**
 * DataCrunch API Endpoint Testing Script
 * 
 * This script tries multiple endpoint variants with the OAuth token
 * to find the correct TTS endpoint.
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// DataCrunch OAuth endpoint that we know works
const OAUTH_URL = 'https://api.datacrunch.io/v1/oauth2/token';
const DATACRUNCH_CLIENT_ID = process.env.DATACRUNCH_CLIENT_ID;
const DATACRUNCH_CLIENT_SECRET = process.env.DATACRUNCH_CLIENT_SECRET;

// API base URL
const API_BASE = 'https://api.datacrunch.io';

// Test text
const TEST_TEXT = "Hello, this is a test of the DataCrunch API.";

// Endpoint variants to try
const endpointVariants = [
  '/v1/tts',
  '/tts',
  '/v1/text-to-speech',
  '/text-to-speech',
  '/v1/speech',
  '/speech',
  '/v1/synthesize',
  '/synthesize',
  '/v1/audio',
  '/audio',
  '/v1/voices/tts',
  '/voices/tts',
  '/v1/api/tts',
  '/api/tts',
  '/v1/inference/tts',
  '/inference/tts',
  '/voice/tts',
  '/v1/voice/tts'
];

// Voice ID variants to try
const voiceVariants = [
  'speaker_0',
  'default',
  'en_speaker_0',
  'en_US_speaker_0',
  '0',
  'male_1',
  'female_1'
];

/**
 * Get OAuth token using client credentials
 */
async function getOAuthToken() {
  console.log('Getting OAuth token...');
  
  try {
    const payload = {
      grant_type: 'client_credentials',
      client_id: DATACRUNCH_CLIENT_ID,
      client_secret: DATACRUNCH_CLIENT_SECRET
    };
    
    const response = await axios.post(OAUTH_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (response.status === 200 && response.data && response.data.access_token) {
      console.log('✅ OAuth token obtained successfully');
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
 * Test a specific TTS endpoint with OAuth token
 */
async function testEndpoint(token, endpoint, voice) {
  const url = `${API_BASE}${endpoint}`;
  console.log(`\nTesting ${url} with voice_id: ${voice}`);
  
  // Prepare auth header
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  
  // Prepare request payload
  const payload = {
    text: TEST_TEXT,
    voice_id: voice
  };
  
  try {
    const response = await axios.post(url, payload, {
      headers,
      timeout: 10000,
      validateStatus: null // Don't throw errors on non-2xx status codes
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ SUCCESS - Found working endpoint!');
      console.log(`Working endpoint: ${url}`);
      console.log(`Working voice_id: ${voice}`);
      
      // Show truncated response
      if (response.data) {
        const responseData = JSON.stringify(response.data).slice(0, 100) + '...';
        console.log(`Response: ${responseData}`);
      }
      
      return { success: true, endpoint, voice, response };
    } else if (response.status !== 404) {
      // If not a 404, might be a promising direction
      console.log('⚠️ Got non-404 response, might be a promising endpoint');
      if (response.data) {
        console.log('Response data:', JSON.stringify(response.data, null, 2));
      }
    }
    
    return { success: false };
  } catch (error) {
    console.log(`Error: ${error.message}`);
    return { success: false };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('DataCrunch API Endpoint Test');
  console.log('==========================\n');
  
  // Step 1: Get OAuth token
  const token = await getOAuthToken();
  if (!token) {
    console.error('Failed to get OAuth token. Cannot proceed.');
    return;
  }
  
  // Try top-level API endpoints
  console.log('\nChecking API root endpoints...');
  try {
    const rootResponses = await Promise.all([
      axios.get(`${API_BASE}`, { 
        headers: { 'Authorization': `Bearer ${token}` }, 
        validateStatus: null
      }),
      axios.get(`${API_BASE}/v1`, { 
        headers: { 'Authorization': `Bearer ${token}` }, 
        validateStatus: null
      }),
      axios.get(`${API_BASE}/api`, { 
        headers: { 'Authorization': `Bearer ${token}` }, 
        validateStatus: null
      })
    ]);
    
    rootResponses.forEach((response, index) => {
      const url = index === 0 ? API_BASE : index === 1 ? `${API_BASE}/v1` : `${API_BASE}/api`;
      console.log(`${url}: ${response.status}`);
      
      if (response.status === 200 && response.data) {
        console.log('API info response:');
        console.log(JSON.stringify(response.data, null, 2));
      }
    });
  } catch (error) {
    console.log('Error checking root endpoints:', error.message);
  }
  
  // Step 2: Try all endpoint combinations
  console.log('\nTesting all TTS endpoint variants...');
  
  let foundWorkingEndpoint = false;
  let workingEndpoint = null;
  let workingVoice = null;
  
  // Try with default voice first
  for (const endpoint of endpointVariants) {
    const result = await testEndpoint(token, endpoint, 'speaker_0');
    if (result.success) {
      foundWorkingEndpoint = true;
      workingEndpoint = endpoint;
      workingVoice = 'speaker_0';
      break;
    }
  }
  
  // If default voice didn't work, try other voice variants
  if (!foundWorkingEndpoint) {
    console.log('\nTrying with different voice IDs...');
    
    // Try each endpoint with each voice variant
    for (const endpoint of endpointVariants) {
      for (const voice of voiceVariants) {
        // Skip the already tested default combination
        if (endpoint === '/v1/tts' && voice === 'speaker_0') continue;
        
        const result = await testEndpoint(token, endpoint, voice);
        if (result.success) {
          foundWorkingEndpoint = true;
          workingEndpoint = endpoint;
          workingVoice = voice;
          break;
        }
      }
      
      if (foundWorkingEndpoint) break;
    }
  }
  
  // Summary
  if (foundWorkingEndpoint) {
    console.log('\n✅ Successfully found working TTS endpoint!');
    console.log(`Endpoint: ${API_BASE}${workingEndpoint}`);
    console.log(`Voice ID: ${workingVoice}`);
  } else {
    console.log('\n❌ Could not find a working TTS endpoint');
    console.log('You may need to contact DataCrunch support for API documentation');
  }
}

// Run main function
main().catch(error => {
  console.error('Unhandled error:', error.message);
});