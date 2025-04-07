/**
 * This script sets up the required Plaid environment variables
 * for the asset report generation utilities.
 * 
 * Usage: node setup-plaid-env.js <clientId> <secret> <environment> <publicUrl>
 */

const fs = require('fs');
const path = require('path');

function setupPlaidEnvironment() {
  try {
    // Get command line arguments
    const clientId = process.argv[2];
    const secret = process.argv[3];
    const environment = process.argv[4] || 'sandbox';
    const publicUrl = process.argv[5] || 'https://shilohfinance.com';
    
    // Validate input
    if (!clientId || !secret) {
      console.error('Usage: node setup-plaid-env.js <clientId> <secret> [environment] [publicUrl]');
      console.error('  environment defaults to "sandbox" if not provided');
      console.error('  publicUrl defaults to "https://shilohfinance.com" if not provided');
      process.exit(1);
    }
    
    // Validate environment
    const validEnvironments = ['sandbox', 'development', 'production'];
    if (!validEnvironments.includes(environment)) {
      console.error(`Error: Environment must be one of: ${validEnvironments.join(', ')}`);
      process.exit(1);
    }
    
    console.log('Setting up Plaid environment variables...');
    
    // Path to .env file
    const envPath = path.join(__dirname, '.env');
    
    // Read existing .env file if it exists
    let envContent = '';
    try {
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
    } catch (readError) {
      console.warn('Warning: Could not read existing .env file:', readError.message);
    }
    
    // Parse existing environment variables
    const envVars = {};
    if (envContent) {
      const lines = envContent.split('\n');
      for (const line of lines) {
        if (line.trim() && !line.startsWith('#')) {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            envVars[match[1]] = match[2];
          }
        }
      }
    }
    
    // Set/update Plaid variables
    envVars.PLAID_CLIENT_ID = clientId;
    envVars.PLAID_SECRET = secret;
    envVars.PLAID_ENVIRONMENT = environment;
    envVars.PUBLIC_URL = publicUrl;
    
    // Generate new .env content
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Write to .env file
    fs.writeFileSync(envPath, newEnvContent);
    
    console.log('Plaid environment variables set successfully:');
    console.log(`- PLAID_CLIENT_ID: ${clientId}`);
    console.log(`- PLAID_SECRET: ${secret.substring(0, 3)}...${secret.substring(secret.length - 3)}`);
    console.log(`- PLAID_ENVIRONMENT: ${environment}`);
    console.log(`- PUBLIC_URL: ${publicUrl}`);
    
  } catch (error) {
    console.error('Error setting up Plaid environment:', error);
    process.exit(1);
  }
}

// Run the script
setupPlaidEnvironment();