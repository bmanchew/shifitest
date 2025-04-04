/**
 * This script tests if contracts for merchant ID 49 are correctly retrieved
 * which was one of the specific issues we fixed in the ticket system.
 */

import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

// Create cookie jar
const cookieJar = new CookieJar();

// Create axios instance with cookie jar support
const api = wrapper(axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
  jar: cookieJar
}));

// Credentials for brandon@shilohfinance.com (merchant ID 49)
const EMAIL = 'brandon@shilohfinance.com';
const PASSWORD = 'password123';

async function runTest() {
  try {
    console.log('=== Testing Contract Fetch for Merchant ID 49 ===');
    
    // 1. Get CSRF Token
    console.log('\n--- Step 1: Get CSRF Token ---');
    const csrfResponse = await api.get('/api/csrf-token');
    const csrfToken = csrfResponse.data.csrfToken;
    console.log('CSRF Token acquired:', csrfToken ? 'Yes' : 'No');
    
    // 2. Login as brandon@shilohfinance.com
    console.log('\n--- Step 2: Login as brandon@shilohfinance.com ---');
    const loginResponse = await api.post('/api/auth/login', {
      email: EMAIL,
      password: PASSWORD
    }, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    console.log('Login status:', loginResponse.data.success ? 'Success' : 'Failed');
    
    // 3. Get merchant profile
    console.log('\n--- Step 3: Get Merchant Profile ---');
    const merchantResponse = await api.get('/api/current-merchant');
    const merchant = merchantResponse.data.merchant;
    
    console.log(`Logged in as Merchant: ${merchant.name} (ID: ${merchant.id})`);
    
    if (merchant.id !== 49) {
      console.warn('⚠️ Warning: Expected merchant ID 49, but got:', merchant.id);
    }
    
    // 4. Fetch contracts for the merchant
    console.log('\n--- Step 4: Fetch Contracts ---');
    console.log(`Fetching contracts for merchant ID: ${merchant.id}`);
    
    // Test both endpoints for contract fetching
    const directContractsResponse = await api.get(`/api/contracts?merchantId=${merchant.id}`);
    console.log('Direct contracts API response format:', Object.keys(directContractsResponse.data));
    
    let contracts;
    if (Array.isArray(directContractsResponse.data)) {
      contracts = directContractsResponse.data;
      console.log('Response is a direct array of contracts');
    } else if (directContractsResponse.data.success && Array.isArray(directContractsResponse.data.contracts)) {
      contracts = directContractsResponse.data.contracts;
      console.log('Response is an object with success and contracts properties');
    } else {
      console.log('Unexpected response format:', directContractsResponse.data);
      contracts = [];
    }
    
    console.log(`Found ${contracts.length} contracts for merchant ID ${merchant.id}`);
    
    if (contracts.length > 0) {
      console.log('✅ Successfully retrieved contracts for merchant ID 49');
      console.log('\nSample contract data:');
      console.log(JSON.stringify(contracts[0], null, 2));
    } else {
      console.log('❌ No contracts found for merchant ID 49');
    }
    
    // 5. Try to create a test ticket with contract selection
    if (contracts.length > 0) {
      console.log('\n--- Step 5: Create Test Ticket with Contract Reference ---');
      
      const selectedContract = contracts[0];
      
      const ticketData = {
        subject: 'Test Ticket with Contract Reference',
        category: 'technical_issue',
        priority: 'normal',
        description: 'This is a test ticket created by the API test script with a contract reference',
        merchantId: merchant.id,
        contractId: selectedContract.id,
        createdBy: merchant.id
      };
      
      try {
        const ticketResponse = await api.post('/api/communications/tickets', ticketData);
        console.log('✅ Successfully created ticket with contract reference');
        console.log(`Ticket ID: ${ticketResponse.data.id}, Number: ${ticketResponse.data.ticketNumber}`);
      } catch (error) {
        console.log('❌ Failed to create ticket with contract reference');
        console.error('Error:', error.response?.data || error.message);
      }
    }
    
    console.log('\n=== Test Completed ===');
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
runTest()
  .then(() => {
    console.log('Contract test completed');
  })
  .catch(err => {
    console.error('Contract test failed:', err);
  });