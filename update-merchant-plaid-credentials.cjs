#!/usr/bin/env node

/**
 * Script to update a merchant's Plaid credentials directly in the database
 * Usage: node update-merchant-plaid-credentials.cjs <merchantId> <accessToken> [clientId]
 * 
 * Example: node update-merchant-plaid-credentials.cjs 123 access-sandbox-xxxx client-id-xxxx
 */

// Database configuration
const { db } = require('./server/db.cjs');
require('dotenv').config();

// Get arguments from command line
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node update-merchant-plaid-credentials.cjs <merchantId> <accessToken> [clientId]');
  process.exit(1);
}

const merchantId = parseInt(args[0]);
const accessToken = args[1];
const clientId = args[2] || null; // Optional client ID

if (isNaN(merchantId)) {
  console.error('Error: Merchant ID must be a number');
  process.exit(1);
}

async function updatePlaidCredentials() {
  try {
    console.log(`Looking up merchant with ID: ${merchantId}`);
    // First check if the merchant exists
    const merchantResult = await db.query(
      'SELECT id, name FROM merchants WHERE id = $1',
      [merchantId]
    );

    if (merchantResult.rows.length === 0) {
      console.error(`Error: No merchant found with ID ${merchantId}`);
      process.exit(1);
    }

    const merchant = merchantResult.rows[0];
    console.log(`Found merchant: ${merchant.name} (ID: ${merchant.id})`);

    // Check if a Plaid merchant record already exists
    const plaidMerchantResult = await db.query(
      'SELECT id, "merchantId", "accessToken", "clientId", "onboardingStatus" FROM plaid_merchants WHERE "merchantId" = $1',
      [merchantId]
    );

    let updatedRecord;

    if (plaidMerchantResult.rows.length > 0) {
      // Update existing record
      const existingRecord = plaidMerchantResult.rows[0];
      console.log(`Found existing Plaid record for merchant ID ${merchantId}`);
      console.log(`Current status: ${existingRecord.onboardingStatus}`);
      console.log(`Current access token: ${existingRecord.accessToken ? '****' + existingRecord.accessToken.slice(-4) : 'None'}`);
      
      // Only update the onboarding status to completed if it's not already completed
      const newStatus = existingRecord.onboardingStatus !== 'completed' ? 'completed' : existingRecord.onboardingStatus;
      
      const updateResult = await db.query(
        'UPDATE plaid_merchants SET "accessToken" = $1, "clientId" = $2, "onboardingStatus" = $3, "updatedAt" = NOW() WHERE id = $4 RETURNING *',
        [accessToken, clientId || existingRecord.clientId, newStatus, existingRecord.id]
      );
      
      updatedRecord = updateResult.rows[0];
      console.log(`Updated Plaid credentials for merchant ID ${merchantId}`);
    } else {
      // Create new record
      console.log(`No existing Plaid record found for merchant ID ${merchantId}. Creating new record...`);
      
      const insertResult = await db.query(
        'INSERT INTO plaid_merchants ("merchantId", "accessToken", "clientId", "onboardingStatus", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
        [merchantId, accessToken, clientId, 'completed']
      );
      
      updatedRecord = insertResult.rows[0];
      console.log(`Created new Plaid credentials for merchant ID ${merchantId}`);
    }

    console.log('\nPlaid Credentials Updated Successfully:');
    console.log('----------------------------------------');
    console.log(`Merchant ID:       ${updatedRecord.merchantId}`);
    console.log(`Plaid Record ID:   ${updatedRecord.id}`);
    console.log(`Status:            ${updatedRecord.onboardingStatus}`);
    console.log(`Access Token:      ${updatedRecord.accessToken ? '****' + updatedRecord.accessToken.slice(-4) : 'None'}`);
    console.log(`Client ID:         ${updatedRecord.clientId || 'Not set'}`);
    console.log(`Last Updated:      ${updatedRecord.updatedAt}`);
    console.log('----------------------------------------');
    
  } catch (error) {
    console.error('Error updating Plaid credentials:', error.message);
    process.exit(1);
  } finally {
    // Close the database connection
    await db.end();
  }
}

updatePlaidCredentials();