/**
 * This script updates the Plaid credentials for a specific merchant
 * 
 * Usage: node update-merchant-plaid-credentials.cjs <merchantId> <clientId> <accessToken>
 */

// Import required modules
const pg = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get command line arguments
const merchantId = process.argv[2];
const clientId = process.argv[3];
const accessToken = process.argv[4];

// Validate input
if (!merchantId || !clientId || !accessToken) {
  console.error(`
Usage: node update-merchant-plaid-credentials.cjs <merchantId> <clientId> <accessToken>

Required:
  - merchantId: The merchant ID to update
  - clientId: The Plaid client ID for this merchant
  - accessToken: The Plaid access token for this merchant
  `);
  process.exit(1);
}

// Database connection setup
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

async function updateMerchantPlaidCredentials() {
  const client = new pg.Client(dbConfig);
  
  try {
    console.log(`Updating Plaid credentials for merchant ID ${merchantId}...`);
    
    // Connect to the database
    await client.connect();
    
    // Check if the merchant exists
    const merchantCheck = await client.query(
      'SELECT id FROM merchants WHERE id = $1',
      [merchantId]
    );
    
    if (merchantCheck.rowCount === 0) {
      throw new Error(`Merchant with ID ${merchantId} not found`);
    }
    
    // Check if a plaid_merchants record exists for this merchant
    const plaidMerchantCheck = await client.query(
      'SELECT id FROM plaid_merchants WHERE merchant_id = $1',
      [merchantId]
    );
    
    let result;
    
    if (plaidMerchantCheck.rowCount > 0) {
      // Update existing record
      result = await client.query(
        `UPDATE plaid_merchants 
         SET client_id = $1, 
             access_token = $2, 
             onboarding_status = 'completed',
             updated_at = NOW()
         WHERE merchant_id = $3
         RETURNING *`,
        [clientId, accessToken, merchantId]
      );
      console.log(`Updated existing Plaid credentials for merchant ID ${merchantId}`);
    } else {
      // Insert new record
      result = await client.query(
        `INSERT INTO plaid_merchants 
         (merchant_id, client_id, access_token, onboarding_status, created_at, updated_at)
         VALUES ($1, $2, $3, 'completed', NOW(), NOW())
         RETURNING *`,
        [merchantId, clientId, accessToken]
      );
      console.log(`Created new Plaid credentials for merchant ID ${merchantId}`);
    }
    
    // Display the updated/inserted record (without showing the full access token)
    const record = result.rows[0];
    const maskedAccessToken = accessToken.substring(0, 4) + '...' + accessToken.substring(accessToken.length - 4);
    
    console.log('\nUpdated Plaid Merchant Record:');
    console.log(`- ID: ${record.id}`);
    console.log(`- Merchant ID: ${record.merchant_id}`);
    console.log(`- Client ID: ${record.client_id}`);
    console.log(`- Access Token: ${maskedAccessToken}`);
    console.log(`- Onboarding Status: ${record.onboarding_status}`);
    console.log(`- Updated At: ${record.updated_at}`);
    
    console.log('\n✅ Merchant Plaid credentials updated successfully.');
    
    // Also update environment variables if missing
    ensurePlaidEnvironmentVariables();
    
    return record;
  } catch (error) {
    console.error('Error updating merchant Plaid credentials:', error.message);
    throw error;
  } finally {
    // Close the database connection
    await client.end();
  }
}

function ensurePlaidEnvironmentVariables() {
  // Check if all required Plaid environment variables are set
  const requiredVars = ['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log(`\nWarning: Missing Plaid environment variables: ${missingVars.join(', ')}`);
    console.log('You should set these with the setup-plaid-env.js script:');
    console.log('node setup-plaid-env.js <clientId> <secret> <environment>');
  } else {
    console.log('\nPlaid environment variables are properly configured.');
  }
}

// Run the script
updateMerchantPlaidCredentials()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });