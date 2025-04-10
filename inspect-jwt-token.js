/**
 * This script decodes and inspects the JWT token from DataCrunch
 * to understand the permissions and details encoded in it.
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// DataCrunch OAuth endpoint
const OAUTH_URL = 'https://api.datacrunch.io/v1/oauth2/token';
const DATACRUNCH_CLIENT_ID = process.env.DATACRUNCH_CLIENT_ID;
const DATACRUNCH_CLIENT_SECRET = process.env.DATACRUNCH_CLIENT_SECRET;

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
    
    const response = await axios.post(OAUTH_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (response.status === 200 && response.data && response.data.access_token) {
      console.log('✅ Token obtained successfully');
      return response.data;
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
 * Decode JWT token without a library (to avoid dependencies)
 */
function decodeJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT token format');
  }
  
  // Decode header
  const headerBase64 = parts[0];
  const headerJson = Buffer.from(headerBase64, 'base64').toString('utf8');
  const header = JSON.parse(headerJson);
  
  // Decode payload
  const payloadBase64 = parts[1];
  const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
  const payload = JSON.parse(payloadJson);
  
  return { header, payload };
}

/**
 * Try alternative endpoints based on token claims
 */
async function testEndpointsBasedOnClaims(token, claims) {
  console.log('\nTesting endpoints based on token claims...');
  
  // Extract useful info from claims
  const projectId = claims.project_id;
  const userId = claims.uid;
  
  // Create authorization header
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  
  // Generate potential endpoints
  const endpoints = [
    // Project-specific endpoints
    `https://api.datacrunch.io/v1/projects/${projectId}/tts`,
    `https://api.datacrunch.io/projects/${projectId}/tts`,
    `https://api.datacrunch.io/v1/projects/${projectId}/synthesize`,
    `https://api.datacrunch.io/v1/projects/${projectId}/inference`,
    `https://api.datacrunch.io/v1/projects/${projectId}/inference/tts`,
    
    // User-specific endpoints
    `https://api.datacrunch.io/v1/users/${userId}/tts`,
    `https://api.datacrunch.io/users/${userId}/tts`,
    
    // Additional project endpoints
    `https://api.datacrunch.io/v1/project/${projectId}/tts`,
    `https://api.datacrunch.io/project/${projectId}/tts`,
    
    // Voice endpoint formats
    `https://api.datacrunch.io/v1/voice/tts?project=${projectId}`,
    `https://api.datacrunch.io/v1/voice/synthesize?project=${projectId}`,
    
    // Different root domain
    `https://inference.datacrunch.io/v1/tts`,
    `https://tts.datacrunch.io/v1/synthesize`
  ];
  
  // Simple payload for testing
  const payload = {
    text: "Hello, this is a test",
    voice_id: "speaker_0"
  };
  
  // Test each endpoint with GET and POST
  for (const endpoint of endpoints) {
    try {
      console.log(`\nTesting ${endpoint}`);
      
      // Try GET first
      console.log('GET request...');
      const getResponse = await axios.get(endpoint, {
        headers,
        validateStatus: null,
        timeout: 5000
      });
      
      console.log(`Status: ${getResponse.status}`);
      if (getResponse.status !== 404) {
        console.log('Response:', getResponse.data);
      }
      
      // Then try POST
      console.log('POST request...');
      const postResponse = await axios.post(endpoint, payload, {
        headers,
        validateStatus: null,
        timeout: 5000
      });
      
      console.log(`Status: ${postResponse.status}`);
      if (postResponse.status !== 404) {
        console.log('Response:', postResponse.data);
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('DataCrunch JWT Token Inspection');
  console.log('=============================\n');
  
  // Get token details
  const tokenData = await getOAuthToken();
  if (!tokenData) {
    console.error('Failed to get OAuth token. Cannot proceed.');
    return;
  }
  
  const { access_token, refresh_token, expires_in, token_type, scope } = tokenData;
  
  console.log('\nToken details:');
  console.log(`Type: ${token_type}`);
  console.log(`Expires in: ${expires_in} seconds`);
  console.log(`Scope: ${scope}`);
  
  // Decode JWT
  try {
    const decoded = decodeJwt(access_token);
    
    console.log('\nHeader:');
    console.log(JSON.stringify(decoded.header, null, 2));
    
    console.log('\nPayload:');
    console.log(JSON.stringify(decoded.payload, null, 2));
    
    // Check expiration
    const expiryDate = new Date(decoded.payload.exp * 1000);
    console.log(`\nToken expires at: ${expiryDate.toLocaleString()}`);
    
    // Test endpoints based on claims
    await testEndpointsBasedOnClaims(access_token, decoded.payload);
    
  } catch (error) {
    console.error('Error decoding JWT:', error.message);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error.message);
});