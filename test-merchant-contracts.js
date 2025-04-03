// Test script to retrieve contracts for a merchant
import axios from 'axios';
import { exec } from 'child_process';

// Merchant credentials
const merchantCredentials = {
  email: 'brandon@shilohfinance.com',
  password: 'Password123!' // Updated to match the reset password
};

// Get authentication token
async function getAuthToken() {
  try {
    const baseUrl = 'https://1825e65f-101b-467b-bee7-c29733668cc0-00-9psqa3aypt1d.janeway.replit.dev';
    const response = await axios.post(`${baseUrl}/api/auth/login`, merchantCredentials);
    console.log('Authentication response:', response.data);
    
    // Check if authentication was successful
    if (response.data.success === true) {
      // Look for token in response or get it from headers
      let token = response.data.token;
      
      // Check if the token is in the response headers (as a cookie)
      if (!token && response.headers['set-cookie']) {
        const cookies = response.headers['set-cookie'];
        console.log('Cookie headers received:', cookies);
        // Try to extract token from cookies
        for (const cookie of cookies) {
          if (cookie.includes('token=')) {
            const match = cookie.match(/token=([^;]+)/);
            if (match) {
              token = match[1];
              console.log('Token extracted from cookie:', token);
            }
          }
        }
      }
      
      if (!token) {
        // If still no token found, we need to generate a JWT token for testing
        // This is a fallback approach - in a real app, the server should provide the token
        console.log('Generating a test JWT token from user data since no token was returned');
        // For testing purposes only - would normally come from server
        return `test_token_${response.data.user.id}_${Date.now()}`;
      }
      
      return token;
    } else {
      console.error('Authentication failed:', response.data.message || 'Unknown error');
      return null;
    }
  } catch (error) {
    console.error('Authentication error:', error.response?.data || error.message);
    return null;
  }
}

// Get merchant contracts
async function getContracts(token) {
  try {
    const baseUrl = 'https://1825e65f-101b-467b-bee7-c29733668cc0-00-9psqa3aypt1d.janeway.replit.dev';
    const response = await axios.get(`${baseUrl}/api/contracts`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('Contract response structure:', JSON.stringify(response.data, null, 2));
    
    // Check if the response has the expected structure
    if (response.data && response.data.success === true) {
      // Return the contracts array from the response
      return response.data.contracts || [];
    }
    
    // Fallback if the response doesn't have the expected structure
    return response.data || [];
  } catch (error) {
    console.error('Error fetching contracts:', error.response?.data || error.message);
    return [];
  }
}

// Main function
async function main() {
  console.log('Attempting to authenticate with merchant account...');
  const token = await getAuthToken();
  
  if (!token) {
    console.error('Failed to authenticate. Exiting...');
    return;
  }
  
  console.log('Authentication successful. Fetching contracts...');
  const contracts = await getContracts(token);
  
  if (!contracts) {
    console.error('Failed to fetch contracts. Exiting...');
    return;
  }
  
  console.log(`Retrieved ${contracts.length} contracts:`);
  console.log(JSON.stringify(contracts, null, 2));
  
  // Verify if the contracts match the expected merchant ID
  const merchantId = 49; // SHILOH FINANCE INC
  const matchingContracts = contracts.filter(contract => contract.merchantId === merchantId);
  
  console.log(`\nFound ${matchingContracts.length} contracts matching merchant ID ${merchantId} (SHILOH FINANCE INC)`);
  
  // Sample first 3 contracts with selected fields for better readability
  if (matchingContracts.length > 0) {
    console.log('\nSample contracts (first 3):');
    const sampleContracts = matchingContracts.slice(0, 3).map(contract => ({
      id: contract.id,
      merchantId: contract.merchantId,
      amount: contract.amount,
      term: contract.term, // Should be aliased from termMonths in the API
      interestRate: contract.interestRate,
      status: contract.status,
      contractNumber: contract.contractNumber
    }));
    
    console.log(JSON.stringify(sampleContracts, null, 2));
  }
}

main().catch(console.error);