/**
 * This script attempts to create or exchange a Plaid token for a merchant
 * using their client ID and originator ID with the Plaid API
 */

const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get merchant ID from command line
const merchantId = process.argv[2] || 46; // Default to merchant ID 46 (Strategic Enterprises Inc.)

// Configure Plaid client
const clientId = process.env.PLAID_CLIENT_ID;
const secret = process.env.PLAID_SECRET;
const environment = 'production';

// Initialize Plaid client
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[environment],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': clientId,
      'PLAID-SECRET': secret,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

// Check if we have the necessary configuration
if (!clientId || !secret) {
  console.error('Error: PLAID_CLIENT_ID and PLAID_SECRET environment variables are required');
  process.exit(1);
}

// Set merchant-specific information
const originatorId = '64ff00173bc87600133e3876'; // Strategic Enterprises Inc.
const merchantClientId = '64ff00173bc87600133e3876'; // Also the client ID from the database

// Function to get access token information
async function getAccessTokenInfo() {
  try {
    console.log('Checking merchant client_id capabilities...');
    
    // Attempt to get information from Plaid API
    const response = await plaidClient.originatorInfo({
      originator_id: originatorId,
      originator_client_id: merchantClientId
    });
    
    console.log('Originator Info Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error getting originator info:', error.message);
    
    if (error.response && error.response.data) {
      console.error('Plaid API Error Details:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    throw error;
  }
}

// Function to attempt to create a processor token
async function createProcessorToken() {
  try {
    // This is just a placeholder - we would need an actual access token and account ID
    // which would typically come from the database or a previous Plaid Link integration
    
    console.log('Attempting to create a processor token for testing...');
    console.log('Note: This will likely fail without a valid access token and account ID');
    
    // Create a processor token 
    // Note: This requires an actual access token and account ID
    const response = await plaidClient.processorTokenCreate({
      access_token: 'placeholder_access_token', // This would need to be an actual token
      account_id: 'placeholder_account_id',     // This would need to be an actual account ID
      processor: 'plaid'                        // Or another supported processor
    });
    
    console.log('Processor Token Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error creating processor token:', error.message);
    
    if (error.response && error.response.data) {
      console.error('Plaid API Error Details:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    console.log('\nThis error is expected if we do not have a valid access token and account ID.');
    console.log('To get a valid access token, you would typically:');
    console.log('1. Initiate a Plaid Link flow to get a public token');
    console.log('2. Exchange the public token for an access token');
    console.log('3. Store the access token securely in your database');
    
    return null;
  }
}

// Function to try item/public_token/exchange if we had a public token
async function simulatePublicTokenExchange() {
  try {
    console.log('\nDemonstrating public_token/exchange flow (simulation)...');
    console.log('Note: In a real scenario, you would get the public token from Plaid Link');

    // This is a simulation - in reality you would have a real public token from Plaid Link
    const publicToken = 'public-sandbox-12345'; // This is a placeholder and won't work
    
    console.log(`Using client ID: ${clientId.substring(0, 6)}...`);
    
    // Attempt to exchange the public token for an access token
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken
    });
    
    console.log('Token Exchange Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('\nError exchanging public token (expected in this simulation):', error.message);
    
    if (error.response && error.response.data) {
      console.error('Plaid API Error Details:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    console.log('\nThis error is expected in this simulation.');
    console.log('In an actual implementation, you would:');
    console.log('1. Get a real public token from the Plaid Link flow');
    console.log('2. Call item/public_token/exchange with that token');
    console.log('3. Store the resulting access token in your database');
    
    return null;
  }
}

// Main function to run everything
async function main() {
  console.log('========== Plaid Token Exchange Demo ==========');
  console.log(`Merchant ID: ${merchantId}`);
  console.log(`Client ID: ${clientId.substring(0, 6)}...`);
  console.log(`Environment: ${environment}`);
  console.log(`Using merchant client_id: ${merchantClientId}`);
  console.log(`Using originator_id: ${originatorId}`);
  console.log('==============================================\n');

  // Try to get access token info
  try {
    await getAccessTokenInfo();
  } catch (error) {
    console.log('Could not get originator info, continuing with demo...');
  }
  
  // Try to create a processor token (for demonstration)
  await createProcessorToken();
  
  // Simulate public token exchange
  await simulatePublicTokenExchange();
  
  console.log('\n==============================================');
  console.log('Demo completed!');
  console.log('To create a real access token for this merchant:');
  console.log('1. Use Plaid Link to generate a public token for the merchant\'s accounts');
  console.log('2. Exchange that public token for an access token using /item/public_token/exchange');
  console.log('3. Store that access token in your database for this merchant');
  console.log('4. Use that access token to generate asset reports or perform other Plaid operations');
}

// Run the script
main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });