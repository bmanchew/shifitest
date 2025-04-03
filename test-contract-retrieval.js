import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Create new pool instance
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Required for Neon serverless
  webSocketConstructor: ws 
});

/**
 * Direct test for the SQL query approach to retrieving contracts by merchant ID
 */
async function testGetContractsByMerchantId(merchantId) {
  try {
    console.log(`Testing contracts retrieval for merchant ID ${merchantId}`);
    
    const rawQuery = `
      SELECT 
        id, 
        contract_number as "contractNumber", 
        merchant_id as "merchantId", 
        customer_id as "customerId", 
        amount, 
        interest_rate as "interestRate", 
        status, 
        term_months as "termMonths", 
        created_at as "createdAt"
      FROM contracts 
      WHERE merchant_id = $1
      ORDER BY created_at DESC;
    `;
    
    const result = await pool.query(rawQuery, [merchantId]);
    const contracts = result.rows;
    
    console.log(`Found ${contracts.length} contracts`);
    console.log(JSON.stringify(contracts, null, 2));

    // Test the mapping function that adds default fields
    const contractsWithDefaults = contracts.map(contract => {
      return {
        ...contract,
        // Add the term field that maps to termMonths for backwards compatibility
        term: contract.termMonths || 0,
        // Add default values for fields not in our minimal query
        completedAt: null,
        downPayment: 0,
        financedAmount: contract.amount || 0,
        monthlyPayment: 0,
        currentStep: "completed",
        archived: false,
        archivedAt: null,
        archivedReason: null,
        phoneNumber: null,
        salesRepId: null,
        purchasedByShifi: false,
        tokenizationStatus: "pending",
        tokenId: null,
        smartContractAddress: null,
        tokenizationError: null,
        blockchainTransactionHash: null, 
        blockNumber: null,
        tokenizationDate: null,
        tokenMetadata: null,
        // Additional frontend expected fields
        updatedAt: null,
        startDate: null,
        endDate: null,
        type: 'custom'
      };
    });

    console.log("Mapped contracts with defaults:");
    console.log(JSON.stringify(contractsWithDefaults, null, 2));

    return contracts;
  } catch (error) {
    console.error(`Error testing contracts for merchant ID ${merchantId}:`, error);
    return [];
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Test with merchant ID 49
await testGetContractsByMerchantId(49);