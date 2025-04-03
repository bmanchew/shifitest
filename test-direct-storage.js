// Test script to directly test the storage layer's contract retrieval function
import { storage } from './server/storage.js';

async function testContractRetrieval() {
  try {
    console.log('Testing contract retrieval for merchant ID 49...');
    const contracts = await storage.getContractsByMerchantId(49);
    
    console.log(`Retrieved ${contracts.length} contracts for merchant ID 49`);
    
    // Print a sample of the contracts
    if (contracts.length > 0) {
      console.log('Sample contract:');
      const sample = contracts[0];
      console.log(JSON.stringify(sample, null, 2));

      // Specifically check if both term and termMonths fields exist and match
      if (sample.term !== undefined && sample.termMonths !== undefined) {
        console.log('\nVerifying term fields:');
        console.log(`term: ${sample.term}, termMonths: ${sample.termMonths}`);
        console.log(`Fields match: ${sample.term === sample.termMonths ? 'YES' : 'NO'}`);
      } else {
        console.log('\nMissing term fields:');
        console.log(`term exists: ${sample.term !== undefined ? 'YES' : 'NO'}`);
        console.log(`termMonths exists: ${sample.termMonths !== undefined ? 'YES' : 'NO'}`);
      }
    }
  } catch (error) {
    console.error('Error testing contract retrieval:', error);
  }
}

// Run the test
testContractRetrieval();