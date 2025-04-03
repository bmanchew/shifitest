// ES Module test script to check contracts with fixed term field

// Import required modules
import pg from 'pg';
import dotenv from 'dotenv';

// Extract Pool from pg
const { Pool } = pg;

// Load environment variables
dotenv.config();

// Create a database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Function to get contracts for a merchant
async function getContractsByMerchantId(merchantId) {
  try {
    // Query to get contracts for the merchant
    const result = await pool.query(
      `SELECT * FROM contracts WHERE merchant_id = $1 ORDER BY created_at DESC`,
      [merchantId]
    );
    
    // Log the raw data
    console.log(`Found ${result.rows.length} contracts for merchant ID ${merchantId}`);
    
    // Map the results to ensure term and termMonths are both present
    const contractsWithDefaults = result.rows.map(contract => {
      return {
        // Basic fields
        id: contract.id,
        contractNumber: contract.contract_number || '',
        merchantId: contract.merchant_id,
        customerId: contract.customer_id || null,
        amount: contract.amount || 0,
        interestRate: contract.interest_rate || 0,
        status: contract.status || 'pending',
        
        // Term fields - both present now
        termMonths: contract.term_months || 0,
        term: contract.term_months || 0, // Add term field that maps to termMonths for backwards compatibility
        
        // Additional info for verification
        createdAt: contract.created_at,
        archived: contract.archived || false,
      };
    });
    
    // Print out terms specifically for verification
    contractsWithDefaults.forEach(contract => {
      console.log(`Contract ${contract.id} (${contract.contractNumber}): term=${contract.term}, termMonths=${contract.termMonths}, amount=${contract.amount}`);
    });
    
    return contractsWithDefaults;
  } catch (error) {
    console.error(`Error getting contracts for merchant ID ${merchantId}:`, error);
    return [];
  }
}

// Main function that self-executes (IIFE)
(async function() {
  try {
    console.log('Testing contract retrieval with fixed term field mapping...');
    
    // Get contracts for merchant ID 49
    const merchantId = 49;
    console.log(`Getting contracts for merchant ID ${merchantId}...`);
    const contracts = await getContractsByMerchantId(merchantId);
    
    console.log(`Successfully retrieved ${contracts.length} contracts`);
    
    // Get active contracts for summary
    const activeContracts = contracts.filter(c => c.status === 'active' && !c.archived);
    const activeTotal = activeContracts.reduce((sum, c) => sum + c.amount, 0);
    
    console.log(`\nSummary for merchant ID ${merchantId}:`);
    console.log(`Total contracts: ${contracts.length}`);
    console.log(`Active contracts: ${activeContracts.length}`);
    console.log(`Active contracts total value: $${activeTotal.toFixed(2)}`);
    
    // Get tokenized contracts
    const tokenizedContracts = contracts.filter(c => c.tokenId);
    console.log(`Tokenized contracts: ${tokenizedContracts.length || 'N/A'}`);
    
    // Exit cleanly after closing the pool
    await pool.end();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Unhandled error:', error);
    try {
      // Try to close the pool in case of error
      await pool.end();
    } catch (err) {
      console.error('Error closing database pool:', err);
    }
    process.exit(1);
  }
})();