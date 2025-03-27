/**
 * Test script for the notification API endpoints
 * This script provides a direct way to test notification endpoints
 * without the complexity of the Twilio service test scripts
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const DEFAULT_PHONE = '+15072620373'; // Default test phone number

/**
 * Test the status API endpoint
 */
async function testStatusEndpoint() {
  console.log('\n=== Testing /api/status endpoint ===');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/status`);
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ Status API test successful');
    } else {
      console.log('❌ Status API test failed');
    }
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Test the notifications/check endpoint
 */
async function testNotificationsCheckEndpoint() {
  console.log('\n=== Testing /api/notifications/check endpoint ===');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/notifications/check`);
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ Notifications check API test successful');
      console.log(`Twilio enabled: ${response.data.twilioEnabled}`);
      console.log(`SendGrid enabled: ${response.data.sendGridEnabled}`);
    } else {
      console.log('❌ Notifications check API test failed');
    }
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Test the notifications/test-sms endpoint
 */
async function testSmsEndpoint(phoneNumber) {
  console.log('\n=== Testing /api/notifications/test-sms endpoint ===');
  console.log(`Target phone: ${phoneNumber}`);
  
  try {
    const response = await axios.post(`${BASE_URL}/api/notifications/test-sms`, {
      phoneNumber,
      message: 'Test message from notification API test script'
    });
    
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ SMS test API successful');
      
      if (response.data.isSimulated) {
        console.log('⚠️ Note: This was a simulated SMS (Twilio is in test mode)');
      } else {
        console.log(`Message ID: ${response.data.messageId}`);
      }
    } else {
      console.log('❌ SMS test API failed:');
      console.log(response.data.error || 'Unknown error');
    }
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Handle API errors in a consistent way
 */
function handleApiError(error) {
  console.error('❌ Error calling API:');
  
  if (error.response) {
    // The request was made and the server responded with an error status
    console.error(`Status: ${error.response.status}`);
    console.error('Response:', error.response.data);
  } else if (error.request) {
    // The request was made but no response was received
    console.error('No response received from server. Is the server running?');
  } else {
    // Something happened in setting up the request
    console.error('Error:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  // Get phone number from command line args or use default
  const phoneNumber = process.argv[2] || DEFAULT_PHONE;
  
  console.log('ShiFi Notification API Tester');
  console.log('============================');
  console.log(`Server URL: ${BASE_URL}`);
  console.log(`Testing with phone number: ${phoneNumber}`);
  
  try {
    // Test the status endpoint
    await testStatusEndpoint();
    
    // Test the notifications check endpoint
    await testNotificationsCheckEndpoint();
    
    // Test the SMS endpoint
    await testSmsEndpoint(phoneNumber);
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('\nUnhandled error:', error);
  }
}

// Run the script
main();