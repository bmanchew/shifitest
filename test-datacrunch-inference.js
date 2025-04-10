/**
 * DataCrunch API Inference Endpoint Test
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
const TTS_ENDPOINT = '/inference/tts';

// Test text
const TEST_TEXT = "Hello, this is a test of the DataCrunch inference API.";

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
 * Test the inference/tts endpoint
 */
async function testInferenceEndpoint(token) {
  const url = `${API_BASE}${TTS_ENDPOINT}`;
  console.log(`\nTesting inference endpoint: ${url}`);
  
  // Try different header combinations
  const headerVariants = [
    {
      name: 'OAuth Bearer',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'OAuth Bearer + Project ID',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Project-ID': 'e1452033-8763-4e59-98a5-1691ebaadf35', // From the JWT token
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
  ];
  
  // Try different payload variants
  const payloadVariants = [
    {
      name: 'Simple payload',
      data: {
        text: TEST_TEXT,
        voice_id: "speaker_0"
      }
    },
    {
      name: 'With model_id',
      data: {
        text: TEST_TEXT,
        voice_id: "speaker_0",
        model_id: "tts1"
      }
    },
    {
      name: 'Default voice',
      data: {
        text: TEST_TEXT,
        voice_id: "default"
      }
    },
    {
      name: 'No voice_id',
      data: {
        text: TEST_TEXT
      }
    }
  ];
  
  for (const headerVariant of headerVariants) {
    for (const payloadVariant of payloadVariants) {
      console.log(`\nTrying ${headerVariant.name} with ${payloadVariant.name}`);
      console.log(`Payload: ${JSON.stringify(payloadVariant.data, null, 2)}`);
      
      try {
        const response = await axios.post(url, payloadVariant.data, {
          headers: headerVariant.headers,
          timeout: 15000,
          validateStatus: null // Don't throw errors on non-2xx status codes
        });
        
        console.log(`Status: ${response.status}`);
        
        if (response.status === 200) {
          console.log('✅ SUCCESS - Found working endpoint configuration!');
          
          // Show response data
          if (response.data) {
            console.log('Response data:', JSON.stringify(response.data, null, 2));
          }
          
          return true;
        } else {
          // Show error response
          if (response.data) {
            console.log('Response data:', JSON.stringify(response.data, null, 2));
          }
        }
      } catch (error) {
        console.log(`Error: ${error.message}`);
      }
    }
  }
  
  return false;
}

/**
 * Main function
 */
async function main() {
  console.log('DataCrunch API Inference Test');
  console.log('===========================\n');
  
  // Step 1: Get OAuth token
  const token = await getOAuthToken();
  if (!token) {
    console.error('Failed to get OAuth token. Cannot proceed.');
    return;
  }
  
  // Step 2: Test the inference endpoint
  const success = await testInferenceEndpoint(token);
  
  if (!success) {
    console.log('\n❌ Could not find working configuration for inference endpoint');
    console.log('You may need to contact DataCrunch support for API documentation');
  }
}

// Run main function
main().catch(error => {
  console.error('Unhandled error:', error.message);
});