// Test script to verify contract retrieval fix
import { DbStorage } from './server/storage.js';

async function testContractRetrieval() {
  try {
    console.log('Creating database storage instance...');
    const storage = new DbStorage();
    
    // Test getting contracts by merchant ID
    console.log('\nTesting getContractsByMerchantId:');
    const merchantId = 49;
    const contracts = await storage.getContractsByMerchantId(merchantId);
    console.log(`Found ${contracts.length} contracts for merchant ID ${merchantId}`);
    
    if (contracts.length > 0) {
      // Print details of the first contract to verify term field
      const contract = contracts[0];
      console.log(`\nSample contract details:`);
      console.log(`- ID: ${contract.id}`);
      console.log(`- Contract Number: ${contract.contractNumber}`);
      console.log(`- Amount: $${contract.amount}`);
      console.log(`- Term (months): ${contract.term}`); // This should show the termMonths value
      console.log(`- termMonths: ${contract.termMonths}`); // Directly from database
      console.log(`- Status: ${contract.status}`);
    }
    
    // Try getting a specific contract
    console.log('\nTesting getContract:');
    const contractId = contracts.length > 0 ? contracts[0].id : 180; // Fall back to ID 180 based on SQL results
    const singleContract = await storage.getContract(contractId);
    if (singleContract) {
      console.log(`Found contract with ID ${contractId}`);
      console.log(`- Term (months): ${singleContract.term}`);
      console.log(`- termMonths: ${singleContract.termMonths}`);
    } else {
      console.log(`Contract with ID ${contractId} not found`);
    }
    
    // Test getting all contracts
    console.log('\nTesting getAllContracts:');
    const allContracts = await storage.getAllContracts();
    console.log(`Found ${allContracts.length} total contracts`);
    
  } catch (error) {
    console.error('Error testing contract retrieval:', error);
  }
}

testContractRetrieval();