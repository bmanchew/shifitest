/**
 * Validate Plaid Credentials Script
 * 
 * This script checks if a merchant has valid Plaid credentials
 * and verifies if they can use the Transfer product.
 */

const dotenv = require('dotenv');
const { getPlaidClientForMerchant } = require('../server/services/plaid-transfer.js');

// Load environment variables
dotenv.config();

// Configuration
const MERCHANT_ID = process.argv[2] || 46; // Default to Strategic Enterprises Inc.

/**
 * Validate Plaid credentials for a merchant
 */
async function validateCredentials() {
  try {
    console.log(`\n=== Validating Plaid Credentials for Merchant ID: ${MERCHANT_ID} ===\n`);
    
    // Step 1: Get the merchant's Plaid client and information
    console.log('Step 1: Getting merchant Plaid client...');
    const { plaidClient, merchantInfo } = await getPlaidClientForMerchant(MERCHANT_ID);
    
    console.log(`Merchant Name: ${merchantInfo.merchant_name || 'Unknown'}`);
    console.log(`Using client_id: ${merchantInfo.client_id ? merchantInfo.client_id.substring(0, 8) + '...' : 'ShiFi Platform'}`);
    console.log(`Access Token: ${merchantInfo.access_token ? 'Available' : 'Not available'}`);
    
    if (!merchantInfo.access_token) {
      console.error('Error: No access token available for this merchant.');
      console.error('Please use Plaid Link to obtain a valid access token first.');
      return;
    }
    
    // Step 2: Check if the access token is valid by getting item info
    console.log('\nStep 2: Validating access token...');
    try {
      const itemResponse = await plaidClient.itemGet({
        access_token: merchantInfo.access_token
      });
      
      const itemData = itemResponse.data;
      console.log(`Item ID: ${itemData.item.item_id}`);
      console.log(`Institution ID: ${itemData.item.institution_id}`);
      console.log(`Available Products: ${itemData.item.available_products.join(', ')}`);
      console.log(`Billed Products: ${itemData.item.billed_products.join(', ')}`);
      
      // Check if Transfer product is available
      const hasTransferProduct = 
        itemData.item.available_products.includes('transfer') || 
        itemData.item.billed_products.includes('transfer');
      
      if (hasTransferProduct) {
        console.log('\n✓ Transfer product is available for this merchant.');
      } else {
        console.log('\n✗ Transfer product is NOT available for this merchant.');
        console.log('The merchant needs to upgrade their Plaid account to use transfers.');
      }
      
      console.log('\nAccess token is valid.');
    } catch (error) {
      console.error('\n✗ Access token validation failed.');
      console.error(`Error: ${error.message}`);
      
      if (error.response && error.response.data) {
        console.error('Plaid API Error Details:');
        console.error(JSON.stringify(error.response.data, null, 2));
      }
      
      console.log('\nPossible solutions:');
      console.log('1. Refresh the access token using Plaid Link');
      console.log('2. Check if the Plaid API credentials are correct');
      console.log('3. Verify that the access token is for the correct environment');
      return;
    }
    
    // Step 3: Check account information if available
    if (merchantInfo.account_id) {
      console.log('\nStep 3: Checking account information...');
      try {
        const accountsResponse = await plaidClient.accountsGet({
          access_token: merchantInfo.access_token
        });
        
        const accounts = accountsResponse.data.accounts;
        const targetAccount = accounts.find(account => account.account_id === merchantInfo.account_id);
        
        if (targetAccount) {
          console.log(`Account Name: ${targetAccount.name}`);
          console.log(`Account Type: ${targetAccount.type}`);
          console.log(`Account Subtype: ${targetAccount.subtype}`);
          console.log(`Current Balance: $${targetAccount.balances.current.toFixed(2)}`);
          console.log(`Available Balance: $${targetAccount.balances.available ? targetAccount.balances.available.toFixed(2) : 'N/A'}`);
          
          // Check if account is suitable for transfers
          const isTransferableAccountType = 
            (targetAccount.type === 'depository' && 
            ['checking', 'savings'].includes(targetAccount.subtype));
          
          if (isTransferableAccountType) {
            console.log('\n✓ Account type is suitable for transfers.');
          } else {
            console.log('\n✗ Account type may not be suitable for transfers.');
            console.log('Transfers typically require a checking or savings account.');
          }
        } else {
          console.error('\n✗ The specified account_id was not found.');
          console.log(`Account ID in database: ${merchantInfo.account_id}`);
          console.log('Available accounts:');
          accounts.forEach(account => {
            console.log(`- ${account.account_id}: ${account.name} (${account.type}/${account.subtype})`);
          });
        }
      } catch (error) {
        console.error('\n✗ Failed to retrieve account information.');
        console.error(`Error: ${error.message}`);
        
        if (error.response && error.response.data) {
          console.error('Plaid API Error Details:');
          console.error(JSON.stringify(error.response.data, null, 2));
        }
      }
    } else {
      console.log('\nStep 3: Skipped - No account_id available for this merchant.');
      console.log('An account_id is required for transfers.');
    }
    
    console.log('\n=== Validation Complete ===\n');
    
  } catch (error) {
    console.error('Error validating credentials:');
    console.error(error.message);
    
    if (error.response && error.response.data) {
      console.error('Plaid API Error Details:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the script
validateCredentials()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });