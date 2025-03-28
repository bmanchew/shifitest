/**
 * Test script to verify the Janeway domain handler
 * 
 * This script makes a request to the root path with a simulated Janeway domain host header
 * to ensure our middleware correctly serves index.html.
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

/**
 * Test the Janeway handler with simulated Janeway requests
 */
async function testJanewayHandler() {
  const serverUrl = getServerUrl();
  console.log(`Testing Janeway domain handler at ${serverUrl}...`);

  try {
    // Get the server URL
    const url = `${serverUrl}/`;
    
    // Create a simulated Janeway request
    const response = await axios.get(url, {
      headers: {
        // Simulate a request coming from a Janeway domain
        'Host': 'someapp-00-12345.janeway.replit.dev',
        'User-Agent': 'Janeway Test Client'
      }
    });

    // Check if the response appears to be the index.html content
    const containsHtmlDoctype = response.data.includes('<!DOCTYPE html>');
    const containsReactRoot = response.data.includes('id="root"');
    
    console.log(`Response status: ${response.status}`);
    console.log(`Content length: ${response.data.length} bytes`);
    console.log(`Contains HTML doctype: ${containsHtmlDoctype}`);
    console.log(`Contains React root element: ${containsReactRoot}`);

    if (containsHtmlDoctype && containsReactRoot) {
      console.log('✅ SUCCESS: Janeway handler correctly served index.html for root path');
    } else {
      console.log('❌ FAILED: Response does not appear to be index.html');
    }
    
    // Test a non-root path to make sure regular middleware still works
    const apiResponse = await axios.get(`${serverUrl}/api/csrf-token`);
    console.log(`API Response status: ${apiResponse.status}`);
    
    if (apiResponse.status === 200 && apiResponse.data && apiResponse.data.csrfToken) {
      console.log('✅ SUCCESS: API endpoint still works properly');
    } else {
      console.log('❌ FAILED: API endpoint not working correctly');
    }
    
  } catch (error) {
    console.error('Error testing Janeway handler:', error.message);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testJanewayHandler().catch(console.error);