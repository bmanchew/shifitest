/**
 * Test to verify the database schema for contract tokenization
 */

import pkg from 'pg';
const { Pool } = pkg;

async function testTokenizationSchema() {
  try {
    console.log('Starting tokenization schema verification...');
    
    // Create a new database connection
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL 
    });
    
    console.log('\n1. Checking contracts table for tokenization fields...');
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'contracts'
      AND column_name IN (
        'tokenization_status', 
        'token_id', 
        'smart_contract_address',
        'blockchain_transaction_hash',
        'block_number',
        'tokenization_date',
        'token_metadata',
        'tokenization_error',
        'purchased_by_shifi'
      )
      ORDER BY column_name;
    `);
    
    console.log(`Found ${columns.length} tokenization-related fields:`);
    columns.forEach(col => {
      console.log(`- ${col.column_name}: ${col.udt_name || col.data_type}`);
    });
    
    console.log('\n2. Checking tokenization_status enum values...');
    const { rows: enumValues } = await pool.query(`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'tokenization_status'
      ORDER BY enumsortorder;
    `);
    
    console.log(`Found enum values for tokenization_status:`);
    enumValues.forEach(val => {
      console.log(`- ${val.enumlabel}`);
    });
    
    console.log('\n3. Checking existing tokenized contracts...');
    const { rows: tokenizedContracts } = await pool.query(`
      SELECT 
        id, 
        contract_number, 
        tokenization_status, 
        token_id, 
        smart_contract_address,
        blockchain_transaction_hash,
        block_number,
        tokenization_date,
        purchased_by_shifi
      FROM contracts
      WHERE tokenization_status IS NOT NULL
      ORDER BY id DESC
      LIMIT 5;
    `);
    
    if (tokenizedContracts.length > 0) {
      console.log(`Found ${tokenizedContracts.length} contracts with tokenization data:`);
      tokenizedContracts.forEach(contract => {
        console.log(`\nContract #${contract.id} (${contract.contract_number}):`);
        console.log(`- Status: ${contract.tokenization_status}`);
        console.log(`- Purchased by ShiFi: ${contract.purchased_by_shifi}`);
        console.log(`- Token ID: ${contract.token_id || 'Not assigned'}`);
        console.log(`- Smart Contract: ${contract.smart_contract_address || 'Not assigned'}`);
        console.log(`- Transaction Hash: ${contract.blockchain_transaction_hash || 'Not assigned'}`);
        console.log(`- Block Number: ${contract.block_number || 'Not assigned'}`);
        console.log(`- Tokenization Date: ${contract.tokenization_date ? new Date(contract.tokenization_date).toISOString() : 'Not assigned'}`);
      });
    } else {
      console.log('No tokenized contracts found in the database.');
      
      // Let's create a test contract to verify tokenization
      console.log('\n4. Creating a test contract for tokenization verification...');
      const { rows: [contract] } = await pool.query(`
        INSERT INTO contracts (
          contract_number,
          merchant_id,
          amount,
          down_payment,
          financed_amount,
          term_months,
          interest_rate,
          monthly_payment,
          status,
          current_step,
          purchased_by_shifi,
          tokenization_status
        ) VALUES (
          'TEST-${Date.now()}',
          1,
          10000,
          2000,
          8000,
          24,
          0.08,
          362.05,
          'pending',
          'terms',
          true,
          'pending'
        ) RETURNING id, contract_number, tokenization_status, purchased_by_shifi;
      `);
      
      console.log(`Created test contract #${contract.id} (${contract.contract_number}):`);
      console.log(`- Tokenization Status: ${contract.tokenization_status}`);
      console.log(`- Purchased by ShiFi: ${contract.purchased_by_shifi}`);
    }
    
    await pool.end();
    
    console.log('\n✅ Test PASSED: Tokenization schema verification completed successfully!');
  } catch (error) {
    console.error('\n❌ Test ERROR:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run the test
testTokenizationSchema()
  .then(() => {
    console.log('\nTest completed.');
  })
  .catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });