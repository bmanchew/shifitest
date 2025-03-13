// Test script to check KYC verification status using only contract ID
const fetch = require('node-fetch');

// Set the contract ID to check
const contractId = process.argv[2] || '68'; // Default to contract 68 if none provided

async function checkKycStatus() {
  try {
    console.log(`Checking KYC status for contract ID: ${contractId}`);
    
    // Make the API call to check the status
    const response = await fetch('http://localhost:3000/api/kyc/check-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId })
    });
    
    const data = await response.json();
    
    console.log('API Response:', JSON.stringify(data, null, 2));
    console.log(`Status: ${data.success ? 'Success' : 'Failed'}`);
    console.log(`Verified: ${data.alreadyVerified ? 'Yes' : 'No'}`);
    console.log(`Message: ${data.message}`);
    
    if (data.verificationCount) {
      console.log(`Verification Count: ${data.verificationCount}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error checking KYC status:', error);
    throw error;
  }
}

// Run the test
checkKycStatus()
  .then(() => console.log('Test completed successfully'))
  .catch(err => console.error('Test failed:', err));