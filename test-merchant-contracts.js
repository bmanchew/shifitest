// Test script to retrieve contracts for a merchant
import axios from 'axios';
import { exec } from 'child_process';

// Merchant credentials
const merchantCredentials = {
  email: 'brandon@shilohfinance.com',
  password: 'password123'
};

// Get authentication token
async function getAuthToken() {
  try {
    const response = await axios.post('http://localhost:3000/api/auth/login', merchantCredentials);
    return response.data.token;
  } catch (error) {
    console.error('Authentication error:', error.response?.data || error.message);
    return null;
  }
}

// Get merchant contracts
async function getContracts(token) {
  try {
    const response = await axios.get('http://localhost:3000/api/contracts', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching contracts:', error.response?.data || error.message);
    return null;
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