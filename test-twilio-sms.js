/**
 * Test Twilio SMS functionality
 * 
 * This script tests the Twilio SMS service by sending a test message
 * to a specified phone number.
 */

// This script needs to use CommonJS to work with our TypeScript imports
const { twilioService } = require('./server/services/twilio');
const dotenv = require('dotenv');
const { logger } = require('./server/services/logger');

// Load environment variables
dotenv.config();

/**
 * Tests sending an SMS via Twilio
 * @param {string} phoneNumber - Target phone number
 */
async function testTwilioSMS(phoneNumber) {
  console.log(`\nTesting Twilio SMS service...`);
  console.log(`Target phone number: ${phoneNumber}`);
  
  try {
    // First, check if Twilio is initialized
    const isInitialized = twilioService.isInitialized();
    console.log(`Twilio service initialized: ${isInitialized}`);
    console.log(`Twilio phone number: ${process.env.TWILIO_PHONE_NUMBER || 'Not configured'}`);
    
    // Send a test message
    const message = "This is a test message from the ShiFi platform. Timestamp: " + new Date().toISOString();
    console.log(`Sending message: "${message}"`);
    
    const result = await twilioService.sendSMS({
      to: phoneNumber,
      body: message
    });
    
    console.log('\nSMS sending result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      if (result.isSimulated) {
        console.log('\n⚠️  This was a SIMULATED message (not actually sent).');
        console.log('Check that TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are properly configured.');
      } else {
        console.log('\n✅ SMS sent successfully!');
        console.log(`Message ID: ${result.messageId}`);
      }
    } else {
      console.log('\n❌ Failed to send SMS:');
      console.log(result.error);
    }
  } catch (error) {
    console.error('Error in Twilio SMS test:', error);
  }
}

/**
 * Main function
 */
async function main() {
  // Get phone number from command line or use default
  const phoneNumber = process.argv[2] || '+15072620373';
  
  try {
    await testTwilioSMS(phoneNumber);
  } catch (error) {
    console.error('Unhandled error in test:', error);
  }
}

// Run the test
main();