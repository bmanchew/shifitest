// Simple script to check Twilio initialization status
import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

console.log('Checking Twilio configuration:');
console.log(`Account SID exists: ${!!accountSid}`);
console.log(`Auth Token exists: ${!!authToken}`);
console.log(`Phone Number exists: ${!!phoneNumber}`);

if (accountSid && authToken) {
  const client = twilio(accountSid, authToken);
  
  // Verify account and phone number
  async function checkTwilio() {
    try {
      console.log('\nTesting Twilio API connection...');
      const accounts = await client.api.v2010.accounts.list({limit: 1});
      console.log(`Account validated: ${accounts.length > 0}`);
      
      const phoneNumbers = await client.incomingPhoneNumbers.list({limit: 10});
      console.log(`Found ${phoneNumbers.length} phone numbers associated with account`);
      
      const matchingNumber = phoneNumbers.find(p => p.phoneNumber === phoneNumber);
      console.log(`Configured phone number found in account: ${!!matchingNumber}`);
      
      if (matchingNumber) {
        console.log(`Phone number details: ${matchingNumber.friendlyName} (${matchingNumber.phoneNumber})`);
      } else {
        console.log('Available phone numbers in account:');
        phoneNumbers.forEach(p => {
          console.log(`- ${p.friendlyName} (${p.phoneNumber})`);
        });
      }
      
      console.log('\nTwilio will run in REAL mode (not simulation)');
    } catch (error) {
      console.error('\nError validating Twilio credentials:');
      console.error(error.message);
      console.log('\nTwilio will run in SIMULATION mode');
    }
  }
  
  checkTwilio();
} else {
  console.log('\nMissing required Twilio credentials');
  console.log('Twilio will run in SIMULATION mode');
}