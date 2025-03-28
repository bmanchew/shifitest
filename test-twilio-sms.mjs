/**
 * Test Twilio SMS functionality
 * 
 * This script tests the Twilio SMS service by sending a test message
 * to a specified phone number.
 */

import dotenv from 'dotenv';
import pkg from 'twilio';
const { Twilio } = pkg;

// Load environment variables
dotenv.config();

/**
 * Tests sending an SMS via Twilio directly
 * @param {string} phoneNumber - Target phone number
 */
async function testTwilioSMS(phoneNumber) {
  console.log(`\nTesting Twilio SMS service...`);
  console.log(`Target phone number: ${phoneNumber}`);
  
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    
    console.log('Twilio configuration:');
    console.log(`- Account SID: ${accountSid ? '✅ Set' : '❌ Missing'}`);
    console.log(`- Auth Token: ${authToken ? '✅ Set' : '❌ Missing'}`);
    console.log(`- From Number: ${fromNumber || '❌ Not configured'}`);
    
    if (!accountSid || !authToken || !fromNumber) {
      console.error('\n❌ Twilio is not fully configured. Check your environment variables.');
      return;
    }
    
    // Create Twilio client
    const client = new Twilio(accountSid, authToken);
    
    // Format the phone number for Twilio if it doesn't start with +
    let formattedTo = phoneNumber;
    if (!formattedTo.startsWith('+')) {
      // If it already starts with "1", just add the + prefix
      if (formattedTo.startsWith('1')) {
        formattedTo = `+${formattedTo}`;
      } else {
        // Otherwise add +1 prefix
        formattedTo = `+1${formattedTo}`;
      }
    }
    
    // Send a test message
    const message = "This is a test message from the ShiFi platform. Timestamp: " + new Date().toISOString();
    console.log(`\nSending message: "${message}"`);
    console.log(`From: ${fromNumber}`);
    console.log(`To: ${formattedTo}`);
    
    // Send the message
    const result = await client.messages.create({
      body: message,
      to: formattedTo,
      from: fromNumber
    });
    
    console.log('\nSMS sending result:');
    console.log(`SID: ${result.sid}`);
    console.log(`Status: ${result.status}`);
    console.log(`Error Code: ${result.errorCode || 'None'}`);
    console.log(`Error Message: ${result.errorMessage || 'None'}`);
    
    if (result.errorCode) {
      console.log('\n❌ SMS sending had an error.');
    } else {
      console.log('\n✅ SMS sent successfully!');
    }
  } catch (error) {
    console.error('\n❌ Error in Twilio SMS test:');
    console.error(error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  // Get phone number from command line or use default
  const phoneNumber = process.argv[2] || '19493223824';
  
  try {
    await testTwilioSMS(phoneNumber);
  } catch (error) {
    console.error('Unhandled error in test:', error);
  }
}

// Run the test
main();