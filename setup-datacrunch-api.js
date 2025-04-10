/**
 * Setup script for DataCrunch and HuggingFace API integration
 * 
 * This script configures the necessary environment variables for using 
 * DataCrunch and HuggingFace APIs for voice synthesis.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const ENV_FILE = '.env';
const DATACRUNCH_URL_ENV = 'DATACRUNCH_URL';
const DATACRUNCH_API_KEY_ENV = 'DATACRUNCH_API_KEY';
const HUGGINGFACE_API_KEY_ENV = 'HUGGINGFACE_API_KEY';
const DEFAULT_DATACRUNCH_URL = 'https://api.datacrunch.io/v1';

// Load existing environment variables
const env = dotenv.config().parsed || {};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompt user for input
 * @param {string} question - The question to ask
 * @returns {Promise<string>} - The user's response
 */
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
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
  // Basic validation - non-empty and has at least 10 characters
  return key && key.trim().length >= 10;
}

/**
 * Write environment variables to .env file
 * @param {Object} env - The environment variables to write
 */
function writeEnv(env) {
  const envContent = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(ENV_FILE, envContent);
  console.log(`Environment variables written to ${ENV_FILE}`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('DataCrunch and HuggingFace API Setup');
    console.log('====================================');
    console.log('This script will help you set up the API keys and URL for the DataCrunch and HuggingFace integration.');
    console.log('');

    // DataCrunch URL
    const existingUrl = env[DATACRUNCH_URL_ENV];
    let useDefaultUrl = true;
    
    if (existingUrl) {
      console.log(`Current DataCrunch URL: ${existingUrl}`);
      useDefaultUrl = (await prompt(`Use default URL (${DEFAULT_DATACRUNCH_URL})? (Y/n): `)).toLowerCase() !== 'n';
    } else {
      useDefaultUrl = (await prompt(`Use default DataCrunch URL (${DEFAULT_DATACRUNCH_URL})? (Y/n): `)).toLowerCase() !== 'n';
    }
    
    env[DATACRUNCH_URL_ENV] = useDefaultUrl ? DEFAULT_DATACRUNCH_URL : await prompt('Enter DataCrunch URL: ');

    // DataCrunch API Key
    const existingDataCrunchKey = env[DATACRUNCH_API_KEY_ENV];
    if (existingDataCrunchKey) {
      console.log(`DataCrunch API key is already set (${existingDataCrunchKey.substring(0, 3)}...${existingDataCrunchKey.substring(existingDataCrunchKey.length - 3)})`);
      const changeKey = (await prompt('Do you want to change it? (y/N): ')).toLowerCase() === 'y';
      
      if (changeKey) {
        let apiKey = await prompt('Enter DataCrunch API key: ');
        while (!validateApiKey(apiKey)) {
          console.log('Invalid API key. Please enter a valid key.');
          apiKey = await prompt('Enter DataCrunch API key: ');
        }
        env[DATACRUNCH_API_KEY_ENV] = apiKey;
      }
    } else {
      let apiKey = await prompt('Enter DataCrunch API key: ');
      while (!validateApiKey(apiKey)) {
        console.log('Invalid API key. Please enter a valid key.');
        apiKey = await prompt('Enter DataCrunch API key: ');
      }
      env[DATACRUNCH_API_KEY_ENV] = apiKey;
    }

    // HuggingFace API Key
    const existingHfKey = env[HUGGINGFACE_API_KEY_ENV];
    if (existingHfKey) {
      console.log(`HuggingFace API key is already set (${existingHfKey.substring(0, 3)}...${existingHfKey.substring(existingHfKey.length - 3)})`);
      const changeKey = (await prompt('Do you want to change it? (y/N): ')).toLowerCase() === 'y';
      
      if (changeKey) {
        let apiKey = await prompt('Enter HuggingFace API key: ');
        while (!validateApiKey(apiKey)) {
          console.log('Invalid API key. Please enter a valid key.');
          apiKey = await prompt('Enter HuggingFace API key: ');
        }
        env[HUGGINGFACE_API_KEY_ENV] = apiKey;
      }
    } else {
      let apiKey = await prompt('Enter HuggingFace API key: ');
      while (!validateApiKey(apiKey)) {
        console.log('Invalid API key. Please enter a valid key.');
        apiKey = await prompt('Enter HuggingFace API key: ');
      }
      env[HUGGINGFACE_API_KEY_ENV] = apiKey;
    }

    // Write to .env file
    writeEnv(env);

    console.log('\nAPI keys and URL have been set up successfully!');
    console.log('\nNOTE: You will need to restart the application for these changes to take effect.');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    rl.close();
  }
}

// Run the main function
main();