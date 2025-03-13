
// Test script to check phone number validation for KYC
const fetch = require('node-fetch');

async function testPhoneNumberKyc() {
  const phoneNumber = '19493223824';
  const baseUrl = process.env.BASE_URL || 'https://8dc3f57a-133b-45a5-ba2b-9e2b16042657-00-572nlsfm974b.janeway.replit.dev';
  
  console.log(`Testing phone number ${phoneNumber} for KYC validation`);
  
  try {
    // First, try to find a contract with this phone number
    const findContractResponse = await fetch(`${baseUrl}/api/contracts/by-phone/${phoneNumber}`);
    if (!findContractResponse.ok) {
      console.error(`Error finding contract by phone: ${findContractResponse.status} ${findContractResponse.statusText}`);
      console.error(await findContractResponse.text());
      return;
    }
    
    const contractData = await findContractResponse.json();
    console.log('Contract found:', contractData);
    
    if (!contractData.contract?.id) {
      console.error('No contract found with this phone number.');
      return;
    }
    
    const contractId = contractData.contract.id;
    
    // Now try to create a KYC session
    const kycSessionResponse = await fetch(`${baseUrl}/api/kyc/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId,
        phoneNumber
      })
    });
    
    if (!kycSessionResponse.ok) {
      console.error(`Error creating KYC session: ${kycSessionResponse.status} ${kycSessionResponse.statusText}`);
      const errorText = await kycSessionResponse.text();
      console.error(errorText);
      return;
    }
    
    const sessionData = await kycSessionResponse.json();
    console.log('KYC session created successfully:', sessionData);
    
  } catch (error) {
    console.error('Error testing phone KYC:', error);
  }
}

testPhoneNumberKyc().catch(console.error);
