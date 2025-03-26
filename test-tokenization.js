/**
 * Test script to verify contract tokenization functionality
 * 
 * This script tests the automatic tokenization of contracts when they are marked
 * as purchased by ShiFi.
 */

import fetch from 'node-fetch';
// In Replit environment, we need to use this URL format
const SERVER_URL = 'http://localhost:5001';

async function testContractTokenization() {
  try {
    console.log('Starting contract tokenization test...');
    
    // Step 1: Create a new contract
    console.log('\n1. Creating a new contract...');
    const contractData = {
      merchantId: 1,
      amount: 10000,
      downPayment: 2000,
      financedAmount: 8000,
      termMonths: 24,
      interestRate: 0.08,
      monthlyPayment: 362.05,
      status: 'pending',
      currentStep: 'terms'
    };
    
    const createResponse = await fetch(`${SERVER_URL}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contractData)
    });
    
    if (!createResponse.ok) {
      throw new Error(`Failed to create contract: ${createResponse.status} ${createResponse.statusText}`);
    }
    
    const contract = await createResponse.json();
    console.log(`Contract created successfully with ID: ${contract.id}`);
    
    // Step 2: Mark the contract as purchased by ShiFi
    console.log('\n2. Marking contract as purchased by ShiFi...');
    const purchaseResponse = await fetch(`${SERVER_URL}/api/contracts/${contract.id}/purchase-by-shifi`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!purchaseResponse.ok) {
      throw new Error(`Failed to mark contract as purchased by ShiFi: ${purchaseResponse.status} ${purchaseResponse.statusText}`);
    }
    
    const purchaseResult = await purchaseResponse.json();
    console.log('Purchase result:', JSON.stringify(purchaseResult, null, 2));
    
    // Step 3: Wait a moment for tokenization to process (it happens asynchronously)
    console.log('\n3. Waiting for tokenization to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Fetch the contract to check tokenization status
    console.log('\n4. Checking tokenization status...');
    const checkResponse = await fetch(`${SERVER_URL}/api/contracts/${contract.id}`);
    
    if (!checkResponse.ok) {
      throw new Error(`Failed to retrieve contract: ${checkResponse.status} ${checkResponse.statusText}`);
    }
    
    const updatedContract = await checkResponse.json();
    console.log('Contract tokenization details:');
    console.log(`- Purchased by ShiFi: ${updatedContract.purchasedByShifi}`);
    console.log(`- Tokenization Status: ${updatedContract.tokenizationStatus}`);
    console.log(`- Token ID: ${updatedContract.tokenId || 'Not yet assigned'}`);
    
    if (updatedContract.tokenizationStatus === 'tokenized') {
      console.log(`- Smart Contract Address: ${updatedContract.smartContractAddress}`);
      console.log(`- Blockchain Transaction: ${updatedContract.blockchainTransactionHash}`);
      console.log(`- Block Number: ${updatedContract.blockNumber}`);
      console.log('\n✅ Test PASSED: Contract was successfully tokenized!');
    } else if (updatedContract.tokenizationStatus === 'processing') {
      console.log('\n⏳ Test INCONCLUSIVE: Tokenization is still processing. Check logs for details.');
    } else if (updatedContract.tokenizationStatus === 'failed') {
      console.log(`\n❌ Test FAILED: Tokenization failed with error: ${updatedContract.tokenizationError}`);
    } else {
      console.log(`\n❓ Test INCONCLUSIVE: Unexpected tokenization status: ${updatedContract.tokenizationStatus}`);
    }
    
    return updatedContract;
    
  } catch (error) {
    console.error('\n❌ Test ERROR:', error.message);
    throw error;
  }
}

// Run the test
testContractTokenization()
  .then(() => {
    console.log('\nTest completed.');
  })
  .catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });