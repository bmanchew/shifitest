/**
 * This script provides a summary of our contract API fixes
 * It verifies that all components are working correctly
 */
import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const baseUrl = 'http://localhost:5000';
const testSummary = {
  adminContractsEndpoint: false,
  merchantContractsEndpoint: false,
  contractDetailsEndpoint: false,
  termMonthsFieldPresent: false,
  allEndpointsAccessible: false
};

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

// Test admin contracts endpoint
async function testAdminContracts() {
  try {
    const csrfToken = await getCsrfToken();
    
    // Get all contracts (admin access)
    const response = await axios.get(
      `${baseUrl}/api/contracts?admin=true`,
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': getCookieString()
        }
      }
    );
    
    console.log('✅ Admin contracts endpoint working');
    console.log(`   Found ${response.data.contracts.length} contracts`);
    testSummary.adminContractsEndpoint = true;
    
    return response.data.contracts;
  } catch (error) {
    console.error('❌ Admin contracts endpoint not working:', error.message);
    return [];
  }
}

// Test merchant contracts endpoint
async function testMerchantContracts() {
  try {
    const csrfToken = await getCsrfToken();
    
    // Get merchant contracts
    const response = await axios.get(
      `${baseUrl}/api/contracts`,
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': getCookieString('merchant-cookies.txt')
        }
      }
    );
    
    console.log('✅ Merchant contracts endpoint working');
    console.log(`   Found ${response.data.contracts.length} contracts for this merchant`);
    testSummary.merchantContractsEndpoint = true;
    
    return response.data.contracts;
  } catch (error) {
    console.error('❌ Merchant contracts endpoint not working:', error.message);
    return [];
  }
}

// Test contract details
async function testContractDetails(contractId) {
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
    
    console.log('✅ Contract details endpoint working');
    testSummary.contractDetailsEndpoint = true;
    
    // Check for termMonths field
    const contract = response.data.contract;
    if (contract.hasOwnProperty('termMonths')) {
      console.log('✅ Contract has termMonths field correctly mapped');
      testSummary.termMonthsFieldPresent = true;
    } else {
      console.log('❌ Contract does not have termMonths field');
    }
    
    return contract;
  } catch (error) {
    console.error('❌ Contract details endpoint not working:', error.message);
    return null;
  }
}

// Main function
async function main() {
  console.log('🔍 Starting contract API testing summary');
  console.log('========================================');
  
  // Test admin contracts
  const adminContracts = await testAdminContracts();
  
  // Test contract details if we have any contracts
  if (adminContracts.length > 0) {
    await testContractDetails(adminContracts[0].id);
  } else {
    console.log('❌ No contracts available to test details endpoint');
  }
  
  // Test merchant contracts
  await testMerchantContracts();
  
  // Check if all endpoints are working
  testSummary.allEndpointsAccessible = 
    testSummary.adminContractsEndpoint &&
    testSummary.merchantContractsEndpoint &&
    testSummary.contractDetailsEndpoint &&
    testSummary.termMonthsFieldPresent;
  
  // Print final summary
  console.log('\n📋 Test Summary:');
  console.log('========================================');
  console.log(`Admin Contracts Endpoint: ${testSummary.adminContractsEndpoint ? '✅ Working' : '❌ Failed'}`);
  console.log(`Merchant Contracts Endpoint: ${testSummary.merchantContractsEndpoint ? '✅ Working' : '❌ Failed'}`);
  console.log(`Contract Details Endpoint: ${testSummary.contractDetailsEndpoint ? '✅ Working' : '❌ Failed'}`);
  console.log(`termMonths Field Present: ${testSummary.termMonthsFieldPresent ? '✅ Present' : '❌ Missing'}`);
  console.log(`Overall Status: ${testSummary.allEndpointsAccessible ? '✅ All tests passed!' : '❌ Some tests failed'}`);
  console.log('========================================');
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
});