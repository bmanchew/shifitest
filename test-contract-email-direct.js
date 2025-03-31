import axios from 'axios';
import pkg from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

const { CookieJar } = pkg;

// Define the contract information
const contractId = 179; // This is a high number that likely exists in the database
const customerEmail = 'brandon@calimited.com';
const customerName = 'Brandon Customer';
const merchantName = 'Test Merchant';
const contractNumber = 'RIC-10001';

// Create a cookie jar and configure axios to use it
const cookieJar = new CookieJar();
const client = wrapper(axios.create({ jar: cookieJar }));

// Start the test with proper CSRF token
async function testEmailDirectly() {
  try {
    console.log('Testing contract signed email with the following information:');
    console.log('Customer Email:', customerEmail);
    console.log('Customer Name:', customerName);
    console.log('Merchant Name:', merchantName);
    console.log('Contract Number:', contractNumber);
    
    // First, get a CSRF token
    console.log('Getting CSRF token...');
    const csrfResponse = await client.get('http://localhost:5000/api/csrf-token');
    
    if (!csrfResponse.data.success || !csrfResponse.data.csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    
    const csrfToken = csrfResponse.data.csrfToken;
    console.log('CSRF token obtained:', csrfToken);
    
    // Now make the actual request with the token
    console.log('Sending test email request...');
    const response = await client.post('http://localhost:5000/api/test-email', {
      contractId,
      customerEmail,
      customerName,
      merchantName,
      contractNumber
    }, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    console.log('Email test response:', response.data);
    
    if (response.data.success) {
      console.log('Test email sent successfully to:', customerEmail);
    } else {
      console.error('Failed to send test email:', response.data.message);
    }
  } catch (error) {
    console.error('Error testing email:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testEmailDirectly();