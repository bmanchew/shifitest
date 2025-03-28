/**
 * Enhanced test script to verify the Janeway domain handler
 * 
 * This script makes requests to various paths with simulated Janeway domain host headers
 * to ensure our middleware correctly serves index.html for all client-side routes.
 */
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';

// Helper to get the server URL
function getServerUrl() {
  // Default to localhost:5000 if running locally
  const baseUrl = 'http://localhost:5000';
  return baseUrl;
}

// Force logging to console for debugging
console.log('Starting Janeway domain tests at', new Date().toISOString());
console.log('========================');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('========================');

/**
 * Test the Janeway handler with simulated Janeway requests for multiple paths
 */
async function testJanewayHandler() {
  const serverUrl = getServerUrl();
  console.log(`Testing Janeway domain handler at ${serverUrl}...`);

  // Define Janeway request headers
  const janewayHeaders = {
    'Host': 'someapp-00-12345.janeway.replit.dev',
    'User-Agent': 'Janeway Test Client'
  };
  
  // Define test paths to check
  const testPaths = [
    '/',              // Root path
    '/login',         // Login page
    '/dashboard',     // Dashboard page
    '/settings',      // Settings page
    '/notfound',      // Non-existing page
    '/api/csrf-token' // API endpoint - should still work
  ];
  
  // Test each path
  for (const testPath of testPaths) {
    console.log(`\nTesting path: ${testPath}`);
    
    try {
      const url = `${serverUrl}${testPath}`;
      const isApiPath = testPath.startsWith('/api/');
      
      // Make the request
      const response = await axios.get(url, {
        headers: janewayHeaders
      });
      
      console.log(`Response status: ${response.status}`);
      
      if (isApiPath) {
        // For API paths, check if the response contains expected API data
        console.log(`API response: ${JSON.stringify(response.data).substring(0, 100)}...`);
        if (response.status === 200) {
          console.log('✅ SUCCESS: API endpoint works properly');
        } else {
          console.log('❌ FAILED: API endpoint returned non-200 status');
        }
      } else {
        // For non-API paths, check if the response is the index.html file
        const containsHtmlDoctype = response.data.includes('<!DOCTYPE html>');
        const containsReactRoot = response.data.includes('id="root"');
        
        console.log(`Content length: ${response.data.length} bytes`);
        console.log(`Contains HTML doctype: ${containsHtmlDoctype}`);
        console.log(`Contains React root element: ${containsReactRoot}`);
        
        if (containsHtmlDoctype && containsReactRoot) {
          console.log(`✅ SUCCESS: Janeway handler correctly served index.html for path: ${testPath}`);
        } else {
          console.log(`❌ FAILED: Response for path ${testPath} does not appear to be index.html`);
        }
      }
    } catch (error) {
      console.error(`Error testing path ${testPath}:`, error.message);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error('Response headers:', error.response.headers);
        console.error('Response data:', error.response.data);
      }
    }
  }
  
  console.log('\nAll tests completed!');
}

// Run the test
testJanewayHandler().catch(console.error);