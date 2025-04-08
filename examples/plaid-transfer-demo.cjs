/**
 * Plaid Transfer Demo Script
 * 
 * This script demonstrates how to use the Plaid Transfer service
 * to initiate a transfer for a merchant.
 */

const dotenv = require('dotenv');
const { getPlaidClientForMerchant, createTransferAuthorization, createTransfer, getTransfer } = require('../server/services/plaid-transfer.js');

// Load environment variables
dotenv.config();

// Configuration
const MERCHANT_ID = process.argv[2] || 46; // Default to Strategic Enterprises Inc.
const AMOUNT = 1000; // $10.00 in cents
const DESCRIPTION = 'Demo transfer';

/**
 * Process a transfer for a merchant
 */
async function processTransfer() {
  try {
    console.log(`\n=== Processing Transfer for Merchant ID: ${MERCHANT_ID} ===\n`);
    
    // Step 1: Get the merchant's Plaid client and information
    console.log('Step 1: Getting merchant Plaid client...');
    const { merchantInfo } = await getPlaidClientForMerchant(MERCHANT_ID);
    
    console.log(`Merchant Name: ${merchantInfo.merchant_name || 'Unknown'}`);
    console.log(`Using client_id: ${merchantInfo.client_id ? merchantInfo.client_id.substring(0, 8) + '...' : 'ShiFi Platform'}`);
    console.log(`Access Token: ${merchantInfo.access_token ? 'Available' : 'Not available'}`);
    
    if (!merchantInfo.access_token) {
      console.error('Error: No access token available for this merchant.');
      console.error('Please use Plaid Link to obtain a valid access token first.');
      return;
    }
    
    if (!merchantInfo.account_id) {
      console.error('Error: No account ID available for this merchant.');
      console.error('A valid account ID is required for transfers.');
      return;
    }
    
    // Step 2: Create a transfer authorization
    console.log('\nStep 2: Creating transfer authorization...');
    const authorization = await createTransferAuthorization(
      MERCHANT_ID,
      merchantInfo.account_id,
      'credit', // transfer money to the account
      AMOUNT,
      DESCRIPTION
    );
    
    console.log(`Authorization ID: ${authorization.authorization_id}`);
    console.log(`Decision: ${authorization.decision}`);
    
    if (authorization.decision !== 'approved') {
      console.error(`Error: Transfer authorization not approved. Decision: ${authorization.decision}`);
      console.error(`Reason: ${authorization.decision_rationale?.description || 'Unknown'}`);
      return;
    }
    
    // Step 3: Create the actual transfer
    console.log('\nStep 3: Creating transfer...');
    const transfer = await createTransfer(
      MERCHANT_ID,
      authorization.authorization_id,
      DESCRIPTION,
      { demo: 'true' }
    );
    
    console.log(`Transfer ID: ${transfer.transfer_id}`);
    console.log(`Status: ${transfer.status}`);
    console.log(`Amount: $${(parseInt(transfer.amount) / 100).toFixed(2)}`);
    
    // Step 4: Get transfer details
    console.log('\nStep 4: Retrieving transfer details...');
    const transferDetails = await getTransfer(MERCHANT_ID, transfer.transfer_id);
    
    console.log(`Transfer Details:`);
    console.log(`- ID: ${transferDetails.transfer_id}`);
    console.log(`- Status: ${transferDetails.status}`);
    console.log(`- Type: ${transferDetails.type}`);
    console.log(`- Amount: $${(parseInt(transferDetails.amount) / 100).toFixed(2)}`);
    console.log(`- Description: ${transferDetails.description}`);
    console.log(`- Created at: ${new Date(transferDetails.created).toLocaleString()}`);
    
    console.log('\n=== Transfer Process Complete ===\n');
    console.log('Note: In a sandbox environment, transfers will be simulated.');
    console.log('In production, actual ACH transfers will be initiated.');
    
  } catch (error) {
    console.error('Error processing transfer:');
    console.error(error.message);
    
    if (error.response && error.response.data) {
      console.error('Plaid API Error Details:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the script
processTransfer()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });