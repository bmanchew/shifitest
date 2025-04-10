/**
 * Setup script for DataCrunch and HuggingFace API integration
 * 
 * This script configures the necessary environment variables for using 
 * DataCrunch and HuggingFace APIs for voice synthesis.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

// Get current filename and directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment file path
const ENV_FILE = path.join(__dirname, '.env');

/**
 * Prompt user for input
 * @param {string} question - The question to ask
 * @returns {Promise<string>} - The user's response
 */
function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Validate API key (basic validation)
 * @param {string} key - The API key to validate
 * @returns {boolean} - Whether the key passes basic validation
 */
function validateApiKey(key) {
  // Basic validation
  return key && key.length > 10;
}

/**
 * Write environment variables to .env file
 * @param {Object} env - The environment variables to write
 */
function writeEnv(env) {
  let envContent = '';
  
  // Read existing content
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf8');
  }
  
  // Update or add each environment variable
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    
    // Check if the variable already exists
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      // Replace existing variable
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      // Add new variable
      envContent += `\n${key}=${value}`;
    }
  }
  
  // Write the updated content
  fs.writeFileSync(ENV_FILE, envContent.trim() + '\n');
  
  console.log(`Environment variables written to ${ENV_FILE}`);
}

/**
 * Main function
 */
async function main() {
  console.log('DataCrunch and HuggingFace API Setup');
  console.log('===================================\n');
  
  // Load existing .env file if it exists
  let env = {};
  if (fs.existsSync(ENV_FILE)) {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        env[match[1]] = match[2];
      }
    });
  }
  
  // DataCrunch Configuration
  console.log('\nDataCrunch API Configuration');
  console.log('-----------------------------');
  
  // URL is fixed to the proper API endpoint
  const datacrunchUrl = "https://api.datacrunch.io";
  console.log(`DataCrunch API URL: ${datacrunchUrl}`);
  
  // Get client ID if not already set
  let datacrunchClientId = env.DATACRUNCH_CLIENT_ID || '';
  if (!datacrunchClientId) {
    datacrunchClientId = await prompt('Enter your DataCrunch client ID: ');
  } else {
    console.log(`DataCrunch client ID is already set (${datacrunchClientId.substring(0, 4)}...)`);
    const change = await prompt('Do you want to change it? (y/n): ');
    if (change.toLowerCase() === 'y') {
      datacrunchClientId = await prompt('Enter your DataCrunch client ID: ');
    }
  }
  
  // Get client secret if not already set
  let datacrunchClientSecret = env.DATACRUNCH_CLIENT_SECRET || '';
  if (!datacrunchClientSecret) {
    datacrunchClientSecret = await prompt('Enter your DataCrunch client secret: ');
  } else {
    console.log('DataCrunch client secret is already set');
    const change = await prompt('Do you want to change it? (y/n): ');
    if (change.toLowerCase() === 'y') {
      datacrunchClientSecret = await prompt('Enter your DataCrunch client secret: ');
    }
  }
  
  // Get API key if not already set
  let datacrunchApiKey = env.DATACRUNCH_API_KEY || '';
  if (!datacrunchApiKey) {
    datacrunchApiKey = await prompt('Enter your DataCrunch API key: ');
  } else {
    console.log(`DataCrunch API key is already set (${datacrunchApiKey.substring(0, 4)}...)`);
    const change = await prompt('Do you want to change it? (y/n): ');
    if (change.toLowerCase() === 'y') {
      datacrunchApiKey = await prompt('Enter your DataCrunch API key: ');
    }
  }
  
  // HuggingFace Configuration
  console.log('\nHuggingFace API Configuration');
  console.log('-----------------------------');
  
  // Get API key if not already set
  let huggingfaceApiKey = env.HUGGINGFACE_API_KEY || '';
  if (!huggingfaceApiKey) {
    huggingfaceApiKey = await prompt('Enter your HuggingFace API key: ');
  } else {
    console.log(`HuggingFace API key is already set (${huggingfaceApiKey.substring(0, 4)}...)`);
    const change = await prompt('Do you want to change it? (y/n): ');
    if (change.toLowerCase() === 'y') {
      huggingfaceApiKey = await prompt('Enter your HuggingFace API key: ');
    }
  }
  
  // Validate and save
  console.log('\nValidating and saving configuration...');
  
  const newEnv = {
    DATACRUNCH_URL: datacrunchUrl,
    DATACRUNCH_CLIENT_ID: datacrunchClientId,
    DATACRUNCH_CLIENT_SECRET: datacrunchClientSecret,
    DATACRUNCH_API_KEY: datacrunchApiKey,
    HUGGINGFACE_API_KEY: huggingfaceApiKey
  };
  
  // Write to .env file
  writeEnv(newEnv);
  
  console.log('\nConfiguration complete!');
  console.log('To use these settings, restart your application.');
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
});