// Test script for the simple-twilio-server.js API
import fetch from 'node-fetch';

// Configuration
const SERVER_URL = 'http://localhost:3000';
const TEST_PHONE_NUMBER = '+15072620373'; // Replace with your test phone number

// Utility function to handle API requests
async function makeRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${SERVER_URL}${endpoint}`, options);
    const data = await response.json();
    return { success: true, status: response.status, data };
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      isConnectionError: error.code === 'ECONNREFUSED'
    };
  }
}

// Test server status
async function testServerStatus() {
  console.log('\n✨ Testing server status...');
  const result = await makeRequest('/status');
  
  if (!result.success) {
    console.error('❌ Failed to connect to the server!');
    console.error(`Error: ${result.error}`);
    
    if (result.isConnectionError) {
      console.log('\n💡 Make sure the server is running with:');
      console.log('   node simple-twilio-server.js');
    }
    
    return false;
  }
  
  console.log(`✅ Server status: ${result.status === 200 ? 'OK' : 'Error'}`);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  return true;
}

// Test Twilio configuration
async function testTwilioConfig() {
  console.log('\n✨ Testing Twilio configuration...');
  const result = await makeRequest('/twilio/check');
  
  if (!result.success) {
    console.error('❌ Failed to check Twilio configuration!');
    console.error(`Error: ${result.error}`);
    return false;
  }
  
  console.log(`✅ Twilio config check: ${result.status === 200 ? 'OK' : 'Error'}`);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  return result.data.twilioConfigured;
}

// Test sending SMS
async function testSendSms() {
  console.log(`\n✨ Testing SMS sending to ${TEST_PHONE_NUMBER}...`);
  
  const payload = {
    phoneNumber: TEST_PHONE_NUMBER,
    message: `ShiFi Test Message - ${new Date().toLocaleTimeString()}`
  };
  
  console.log('Sending payload:', JSON.stringify(payload, null, 2));
  
  const result = await makeRequest('/twilio/send-sms', 'POST', payload);
  
  if (!result.success) {
    console.error('❌ Failed to send SMS!');
    console.error(`Error: ${result.error}`);
    return false;
  }
  
  console.log(`✅ SMS send result: ${result.status === 200 ? 'Success' : 'Failed'}`);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  return result.data.success;
}

// Run all tests
async function runTests() {
  console.log('🔍 TESTING TWILIO SMS SERVICE 🔍');
  console.log('===============================');
  
  // Test 1: Server status
  const serverRunning = await testServerStatus();
  if (!serverRunning) {
    console.error('\n❌ Server test failed. Stopping tests.');
    process.exit(1);
  }
  
  // Test 2: Twilio configuration
  const twilioConfigured = await testTwilioConfig();
  console.log(`\n${twilioConfigured ? '✅' : '⚠️'} Twilio ${twilioConfigured ? 'is configured' : 'is NOT fully configured. SMS will be simulated.'}`);
  
  // Test 3: Send SMS
  const smsSent = await testSendSms();
  if (!smsSent) {
    console.error('\n❌ SMS sending test failed.');
    process.exit(1);
  }
  
  console.log('\n🎉 All tests completed successfully!');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Unexpected error during testing:', error);
  process.exit(1);
});