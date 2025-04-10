/**
 * Setup script for DataCrunch and HuggingFace API keys
 * 
 * This script sets up the API keys for DataCrunch and HuggingFace in the environment
 * variables or .env file for the SesameAI service to use.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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
 * Main function
 */
async function main() {
  console.log('=== DataCrunch and HuggingFace API Setup ===');
  
  // Check if Python script exists
  const setupScript = path.join('sesamechat', 'csm', 'setup_api_env.py');
  if (!fs.existsSync(setupScript)) {
    console.error(`Error: Setup script not found at ${setupScript}`);
    console.error('Make sure you have the SesameAI modules properly installed.');
    process.exit(1);
  }
  
  // Check current environment
  try {
    const result = JSON.parse(execSync(`python3.11 ${setupScript} --check-only`).toString());
    console.log('\nCurrent API Configuration:');
    console.log(`- DataCrunch URL: ${result.datacrunch_url || 'Not set'}`);
    console.log(`- DataCrunch API Key: ${result.datacrunch_api_key_set ? 'Set' : 'Not set'}`);
    console.log(`- HuggingFace API Key: ${result.huggingface_api_key_set ? 'Set' : 'Not set'}`);
    
    const setupNeeded = await prompt('\nWould you like to update the API configuration? (y/n): ');
    if (setupNeeded.toLowerCase() !== 'y' && setupNeeded.toLowerCase() !== 'yes') {
      console.log('Setup cancelled. Exiting...');
      rl.close();
      return;
    }
    
    // Get DataCrunch URL
    const datacrunchUrl = await prompt('Enter DataCrunch API URL (leave blank to keep current): ');
    
    // Get DataCrunch API Key
    const datacrunchApiKey = await prompt('Enter DataCrunch API Key (leave blank to keep current): ');
    
    // Get HuggingFace API Key
    const huggingfaceApiKey = await prompt('Enter HuggingFace API Key (leave blank to keep current): ');
    
    // Confirm
    console.log('\nReview Configuration:');
    console.log(`- DataCrunch URL: ${datacrunchUrl || '(unchanged)'}`);
    console.log(`- DataCrunch API Key: ${datacrunchApiKey ? '(new value provided)' : '(unchanged)'}`);
    console.log(`- HuggingFace API Key: ${huggingfaceApiKey ? '(new value provided)' : '(unchanged)'}`);
    
    const confirm = await prompt('\nSave this configuration? (y/n): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Setup cancelled. Exiting...');
      rl.close();
      return;
    }
    
    // Build command
    let cmd = `python3.11 ${setupScript}`;
    if (datacrunchUrl) cmd += ` --datacrunch-url="${datacrunchUrl}"`;
    if (datacrunchApiKey) cmd += ` --datacrunch-api-key="${datacrunchApiKey}"`;
    if (huggingfaceApiKey) cmd += ` --huggingface-api-key="${huggingfaceApiKey}"`;
    
    // Run setup
    const setupResult = JSON.parse(execSync(cmd).toString());
    if (setupResult.status === 'ok') {
      console.log('\n✅ API configuration updated successfully!');
      console.log(`The configuration has been saved to ${setupResult.env_file}`);
      
      // Summary of updates
      if (setupResult.updated.DATACRUNCH_URL) {
        console.log('- Updated DataCrunch URL');
      }
      if (setupResult.updated.DATACRUNCH_API_KEY) {
        console.log('- Updated DataCrunch API Key');
      }
      if (setupResult.updated.HUGGINGFACE_API_KEY) {
        console.log('- Updated HuggingFace API Key');
      }
      
      console.log('\nYou may need to restart your application for the changes to take effect.');
      
      // Offer to run a test
      const runTest = await prompt('\nWould you like to test the API connection? (y/n): ');
      if (runTest.toLowerCase() === 'y' || runTest.toLowerCase() === 'yes') {
        console.log('\nRunning API connection test...');
        try {
          execSync('python3.11 sesamechat/csm/test_datacrunch.py', { stdio: 'inherit' });
          console.log('\n✅ Test completed!');
        } catch (error) {
          console.error('\n❌ Test failed:', error.message);
        }
      }
    } else {
      console.error('\n❌ Failed to update API configuration:', setupResult.message);
    }
  } catch (error) {
    console.error('An error occurred during setup:', error.message);
    process.exit(1);
  }
  
  rl.close();
}

// Run main function
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});