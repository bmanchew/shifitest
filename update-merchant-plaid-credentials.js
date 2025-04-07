/**
 * This script updates a merchant's Plaid client ID and access token
 * to enable asset report generation.
 * 
 * Usage: node update-merchant-plaid-credentials.js <merchantId> <clientId> <accessToken>
 */

const { db } = require('./server/db.cjs');

async function updateMerchantPlaidCredentials() {
  try {
    // Get command line arguments
    const merchantId = process.argv[2];
    const clientId = process.argv[3];
    const accessToken = process.argv[4];
    
    // Validate input
    if (!merchantId || !clientId || !accessToken) {
      console.error('Usage: node update-merchant-plaid-credentials.js <merchantId> <clientId> <accessToken>');
      process.exit(1);
    }
    
    // Parse merchant ID as integer
    const merchantIdInt = parseInt(merchantId, 10);
    if (isNaN(merchantIdInt)) {
      console.error('Error: Merchant ID must be a number');
      process.exit(1);
    }
    
    console.log(`Updating Plaid credentials for merchant ID ${merchantIdInt}...`);
    
    // Update the merchant's Plaid credentials
    const result = await db.query(
      `UPDATE plaid_merchants 
       SET client_id = $1, access_token = $2, updated_at = NOW() 
       WHERE merchant_id = $3 
       RETURNING merchant_id, onboarding_status, client_id, access_token`,
      [clientId, accessToken, merchantIdInt]
    );
    
    // Check if the merchant was found
    if (result.rowCount === 0) {
      console.error(`Error: No merchant found with ID ${merchantIdInt}`);
      process.exit(1);
    }
    
    console.log('Merchant Plaid credentials updated successfully:');
    console.log(`- Merchant ID: ${result.rows[0].merchant_id}`);
    console.log(`- Onboarding Status: ${result.rows[0].onboarding_status}`);
    console.log(`- Client ID: ${result.rows[0].client_id}`);
    console.log(`- Access Token: ${result.rows[0].access_token.substring(0, 5)}...`);
    
  } catch (error) {
    console.error('Error updating merchant Plaid credentials:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await db.end();
  }
}

// Run the script
updateMerchantPlaidCredentials();