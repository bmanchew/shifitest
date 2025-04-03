/**
 * This script tests the contracts API for brandon@shilohfinance.com (merchant ID 49)
 */
import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const baseUrl = 'http://localhost:5000';
const email = 'brandon@shilohfinance.com';
const password = 'Password123!';
const cookiesFile = 'brandon-cookies.txt';

// Helper functions
function saveCookies(response, filename = cookiesFile) {
  const cookies = response.headers['set-cookie'];
  if (cookies) {
    fs.writeFileSync(filename, cookies.join('\n'));
    console.log(`Cookies saved to ${filename}`);
  }
}

function getCookieString(filename = cookiesFile) {
  try {
    if (fs.existsSync(filename)) {
      return fs.readFileSync(filename, 'utf8')
        .split('\n')
        .map(cookie => cookie.split(';')[0])
        .join('; ');
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
  return '';
}

// Get CSRF token
async function getCsrfToken() {
  try {
    const response = await axios.get(`${baseUrl}/api/csrf-token`, {
      withCredentials: true,
      headers: {
        Cookie: getCookieString()
      }
    });
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    return null;
  }
}

// Login
async function login() {
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(
      `${baseUrl}/api/auth/login`,
      {
        email: email,
        password: password
      },
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Login successful!');
    saveCookies(response);
    return true;
  } catch (error) {
    console.error('Error during login:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Get merchant profile
async function getMerchantProfile() {
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await axios.get(
      `${baseUrl}/api/merchants/current`,
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': getCookieString()
        }
      }
    );
    
    console.log('Merchant profile retrieved:');
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error('Error retrieving merchant profile:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Get merchant contracts
async function getMerchantContracts() {
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await axios.get(
      `${baseUrl}/api/contracts`,
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': getCookieString()
        }
      }
    );
    
    console.log('Contracts retrieved successfully!');
    console.log(`Found ${response.data.contracts.length} contracts`);
    
    // Display contracts summary
    if (response.data.contracts.length > 0) {
      console.log('\nContracts summary:');
      response.data.contracts.forEach((contract, index) => {
        console.log(`\nContract #${index + 1}:`);
        console.log(`ID: ${contract.id}`);
        console.log(`Contract Number: ${contract.contractNumber}`);
        console.log(`Amount: ${contract.amount}`);
        console.log(`Status: ${contract.status}`);
        console.log(`Term Months: ${contract.termMonths}`);
        console.log(`Created At: ${contract.createdAt}`);
        console.log(`Current Step: ${contract.currentStep}`);
        console.log(`Archived: ${contract.archived}`);
      });
    }
    
    return response.data.contracts;
  } catch (error) {
    console.error('Error retrieving contracts:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return [];
  }
}

// Get non-archived contracts only
async function getNonArchivedContracts() {
  try {
    const contracts = await getMerchantContracts();
    
    // Filter by different criteria to help diagnose UI issues
    const nonArchivedContracts = contracts.filter(contract => !contract.archived);
    const activeContracts = contracts.filter(contract => contract.status === 'active');
    const pendingContracts = contracts.filter(contract => contract.status === 'pending');
    const completedStepContracts = contracts.filter(contract => contract.currentStep === 'completed');
    
    console.log(`\nContract Filtering Results:`);
    console.log(`Total contracts: ${contracts.length}`);
    console.log(`Non-archived contracts: ${nonArchivedContracts.length}`);
    console.log(`Active contracts: ${activeContracts.length}`);
    console.log(`Pending contracts: ${pendingContracts.length}`);
    console.log(`Contracts with 'completed' step: ${completedStepContracts.length}`);
    
    // Show active non-archived contracts (most likely what UI would show)
    const activeNonArchivedContracts = contracts.filter(
      contract => !contract.archived && contract.status === 'active'
    );
    
    console.log(`\nActive non-archived contracts: ${activeNonArchivedContracts.length}`);
    
    if (activeNonArchivedContracts.length > 0) {
      console.log('\nActive non-archived contracts:');
      activeNonArchivedContracts.forEach((contract, index) => {
        console.log(`\nContract #${index + 1}:`);
        console.log(`ID: ${contract.id}`);
        console.log(`Contract Number: ${contract.contractNumber}`);
        console.log(`Amount: ${contract.amount}`);
        console.log(`Status: ${contract.status}`);
        console.log(`Current Step: ${contract.currentStep}`);
      });
    }
    
    return nonArchivedContracts;
  } catch (error) {
    console.error('Error filtering contracts:', error.message);
    return [];
  }
}

// Main function
async function main() {
  console.log('Starting Brandon\'s contracts test');
  
  // Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('Login failed, aborting test');
    return;
  }
  
  // Get merchant profile
  await getMerchantProfile();
  
  // Get merchant contracts
  await getMerchantContracts();
  
  // Get non-archived contracts
  await getNonArchivedContracts();
  
  console.log('\nTest completed');
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
});