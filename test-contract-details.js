/**
 * This script tests the contract details endpoint to verify field mapping
 * It checks that termMonths is correctly used instead of term
 */
import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const baseUrl = 'http://localhost:5000';
const contractId = 193; // The ID of our test contract

// Cookie handling
function loadCookies(filename = 'cookies.txt') {
  try {
    if (fs.existsSync(filename)) {
      return fs.readFileSync(filename, 'utf8').split('\n');
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
  return [];
}

function getCookieString(filename = 'cookies.txt') {
  const cookies = loadCookies(filename);
  return cookies.map(cookie => cookie.split(';')[0]).join('; ');
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

// Test admin contract details
async function testAdminContractDetails() {
  try {
    const csrfToken = await getCsrfToken();
    
    // Get specific contract details
    const response = await axios.get(
      `${baseUrl}/api/contracts/${contractId}`,
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': getCookieString()
        }
      }
    );
    
    console.log('Contract details retrieved successfully as admin!');
    const contract = response.data.contract;
    
    // Verify field names
    console.log('Field mapping verification:');
    console.log(`Contract has 'termMonths' field: ${contract.hasOwnProperty('termMonths')}`);
    console.log(`Contract has 'term' field: ${contract.hasOwnProperty('term')}`);
    console.log(`termMonths value: ${contract.termMonths}`);
    
    // Log full contract object for verification
    console.log('\nFull contract object:');
    console.log(JSON.stringify(contract, null, 2));
    
    return contract;
  } catch (error) {
    console.error('Error retrieving admin contract details:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Test merchant contract details
async function testMerchantContractDetails() {
  try {
    const csrfToken = await getCsrfToken();
    
    // Get specific contract details
    const response = await axios.get(
      `${baseUrl}/api/contracts/${contractId}`,
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': getCookieString('merchant-cookies.txt')
        }
      }
    );
    
    console.log('\nContract details retrieved successfully as merchant!');
    const contract = response.data.contract;
    
    // Verify field names
    console.log('Field mapping verification:');
    console.log(`Contract has 'termMonths' field: ${contract.hasOwnProperty('termMonths')}`);
    console.log(`Contract has 'term' field: ${contract.hasOwnProperty('term')}`);
    console.log(`termMonths value: ${contract.termMonths}`);
    
    // Log full contract object for verification
    console.log('\nFull contract object:');
    console.log(JSON.stringify(contract, null, 2));
    
    return contract;
  } catch (error) {
    console.error('Error retrieving merchant contract details:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Main function
async function main() {
  console.log('Starting contract details test');
  
  // Test admin contract details
  await testAdminContractDetails();
  
  // Test merchant contract details
  await testMerchantContractDetails();
  
  console.log('\nContract details tests completed');
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
});