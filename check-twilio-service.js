// Simple script to test the Twilio service directly
import dotenv from 'dotenv';
import pkg from 'twilio';
const { Twilio } = pkg;

// Load environment variables
dotenv.config();

// Get Twilio credentials from environment
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Target phone number from command line or default
const toNumber = process.argv[2] || '+15072620373';

// Message to send
const message = "Test message from ShiFi platform - Direct Twilio Test";

console.log('ShiFi Twilio Direct Test');
console.log('=======================');
console.log(`From: ${fromNumber || 'Not configured'}`);
console.log(`To: ${toNumber}`);
console.log(`Message: ${message}`);

// Check if Twilio is configured
if (!accountSid || !authToken || !fromNumber) {
  console.error('\n❌ Twilio is not fully configured.');
  console.log('Required environment variables:');
  console.log(`- TWILIO_ACCOUNT_SID: ${accountSid ? '✅ Set' : '❌ Missing'}`);
  console.log(`- TWILIO_AUTH_TOKEN: ${authToken ? '✅ Set' : '❌ Missing'}`);
  console.log(`- TWILIO_PHONE_NUMBER: ${fromNumber ? '✅ Set' : '❌ Missing'}`);
  process.exit(1);
}

// Create Twilio client
const client = new Twilio(accountSid, authToken);

// Send message
async function sendSms() {
  try {
    console.log('\nSending SMS...');
    
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber
    });
    
    console.log('\n✅ SMS sent successfully!');
    console.log('Message details:');
    console.log(`- SID: ${result.sid}`);
    console.log(`- Status: ${result.status}`);
    console.log(`- Date sent: ${result.dateCreated}`);
    
    return true;
  } catch (error) {
    console.error('\n❌ Failed to send SMS:');
    console.error(`- Error code: ${error.code}`);
    console.error(`- Error message: ${error.message}`);
    
    if (error.moreInfo) {
      console.error(`- More info: ${error.moreInfo}`);
    }
    
    return false;
  }
}

// Run the test
sendSms().then(success => {
  console.log('\nTest completed.');
  process.exit(success ? 0 : 1);
});