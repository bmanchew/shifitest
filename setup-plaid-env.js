/**
 * This script sets up the required Plaid environment variables
 * for the asset report generation utilities.
 * 
 * Usage: node setup-plaid-env.js <clientId> <secret> <environment> <publicUrl>
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function setupPlaidEnvironment() {
  // Get command line arguments
  const clientId = process.argv[2];
  const secret = process.argv[3];
  const environment = process.argv[4] || 'sandbox'; // Default to sandbox if not provided
  const publicUrl = process.argv[5] || process.env.PUBLIC_URL;

  if (!clientId || !secret) {
    console.error(`
Usage: node setup-plaid-env.js <clientId> <secret> [environment] [publicUrl]

Required:
  - clientId: Your Plaid client ID
  - secret: Your Plaid secret for the given environment

Optional:
  - environment: The Plaid environment (default: sandbox)
                 Valid options: sandbox, development, production
  - publicUrl: Your application's public URL for webhooks
               (defaults to PUBLIC_URL env var if set)
    `);
    process.exit(1);
  }

  // Environment validation
  if (!['sandbox', 'development', 'production'].includes(environment)) {
    console.error(`Invalid environment: ${environment}`);
    console.error('Valid options: sandbox, development, production');
    process.exit(1);
  }

  // Prepare the environment variable updates
  const envUpdates = {
    PLAID_CLIENT_ID: clientId,
    PLAID_SECRET: secret,
    PLAID_ENV: environment
  };

  if (publicUrl) {
    envUpdates.PLAID_WEBHOOK_URL = `${publicUrl}/api/plaid/webhook`;
  }

  // Read the current .env file
  const envFilePath = path.resolve('.env');
  let envFileContent = '';
  
  try {
    if (fs.existsSync(envFilePath)) {
      envFileContent = fs.readFileSync(envFilePath, 'utf-8');
    }
  } catch (error) {
    console.warn('Unable to read existing .env file. Creating new file.');
  }

  // Update or add the Plaid environment variables
  const envLines = envFileContent.split('\n');
  const updatedLines = [];
  const updatedKeys = new Set();

  // Process existing lines
  for (const line of envLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      updatedLines.push(line);
      continue;
    }

    const match = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      if (key in envUpdates) {
        updatedLines.push(`${key}=${envUpdates[key]}`);
        updatedKeys.add(key);
      } else {
        updatedLines.push(line);
      }
    } else {
      updatedLines.push(line);
    }
  }

  // Add any new keys that weren't in the file
  for (const [key, value] of Object.entries(envUpdates)) {
    if (!updatedKeys.has(key)) {
      updatedLines.push(`${key}=${value}`);
    }
  }

  // Write the updated .env file
  fs.writeFileSync(envFilePath, updatedLines.join('\n'));

  console.log('✅ Plaid environment variables have been set up successfully:');
  for (const [key, value] of Object.entries(envUpdates)) {
    if (key === 'PLAID_SECRET') {
      console.log(`- ${key}=****${value.slice(-4)}`);
    } else {
      console.log(`- ${key}=${value}`);
    }
  }
}

setupPlaidEnvironment();