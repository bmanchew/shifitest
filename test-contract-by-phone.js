/**
 * Test script for finding contract data by phone number
 */
const fetch = require('node-fetch');

async function testContractByPhone() {
  try {
    // Replace with the actual phone number you want to test
    const phoneNumber = '9493223824'; // This should be the phone number for contract 67
    
    // First, get the user ID by phone number
    const userResponse = await fetch(`http://localhost:3000/api/user-by-phone?phone=${phoneNumber}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const userData = await userResponse.json();
    console.log('User data:', JSON.stringify(userData, null, 2));
    
    if (!userData.success) {
      console.error('ERROR: Failed to find user by phone number');
      return;
    }
    
    const userId = userData.user.id;
    console.log(`Found user with ID ${userId} for phone ${phoneNumber}`);
    
    // Now get contracts by user ID
    const contractsResponse = await fetch(`http://localhost:3000/api/contracts/by-customer/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const contractsData = await contractsResponse.json();
    console.log('Contracts data:', JSON.stringify(contractsData, null, 2));
    
    if (!contractsData.success) {
      console.error('ERROR: Failed to find contracts for user');
      return;
    }
    
    if (contractsData.contracts.length === 0) {
      console.log('No contracts found for this user');
    } else {
      console.log(`Found ${contractsData.contracts.length} contracts for this user`);
      console.log('Contract IDs:', contractsData.contracts.map(c => c.id).join(', '));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Execute the test
testContractByPhone();