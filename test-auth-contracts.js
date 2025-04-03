// Test script to authenticate and view merchant contracts
import axios from 'axios';

// Merchant credentials for testing
const merchantCredentials = {
  email: 'brandon@shilohfinance.com', // Merchant account for Shiloh Finance ID 49
  password: 'password123' // Simple password for testing
};

async function testMerchantContracts() {
  try {
    console.log('Attempting to authenticate as a merchant...');
    
    // Step 1: Get a session by logging in
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', merchantCredentials);
    
    if (!loginResponse.data.success) {
      console.error('Authentication failed:', loginResponse.data.message);
      return;
    }
    
    console.log('Authentication successful!');
    
    // Save cookies from the response
    const cookies = loginResponse.headers['set-cookie'];
    
    // Step 2: Get the merchant ID from the user session
    const userResponse = await axios.get('http://localhost:5000/api/auth/current', {
      headers: {
        Cookie: cookies
      }
    });
    
    if (!userResponse.data.success) {
      console.error('Failed to get current user:', userResponse.data.message);
      return;
    }
    
    const merchantId = userResponse.data.user.merchantId;
    console.log(`Current user's merchant ID: ${merchantId}`);
    
    // Step 3: Get contracts for the merchant
    const contractsResponse = await axios.get(`http://localhost:5000/api/merchants/${merchantId}/contracts`, {
      headers: {
        Cookie: cookies
      }
    });
    
    if (!contractsResponse.data.success) {
      console.error('Failed to get contracts:', contractsResponse.data.message);
      return;
    }
    
    const contracts = contractsResponse.data.contracts;
    console.log(`Successfully retrieved ${contracts.length} contracts for merchant ID ${merchantId}`);
    
    // Log the first few contracts with term details to verify the fix
    if (contracts.length > 0) {
      console.log('\nSample contracts:');
      contracts.slice(0, 3).forEach((contract, index) => {
        console.log(`Contract #${index + 1}:`);
        console.log(`- ID: ${contract.id}`);
        console.log(`- Contract Number: ${contract.contractNumber}`);
        console.log(`- Amount: $${contract.amount}`);
        console.log(`- Term (months): ${contract.term}`);
        console.log(`- termMonths: ${contract.termMonths}`);
        console.log(`- Status: ${contract.status}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('Error during test:', error.response ? error.response.data : error.message);
  }
}

testMerchantContracts();