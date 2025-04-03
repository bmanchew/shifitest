/**
 * Test script to verify the contract retrieval functionality
 */
import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const baseUrl = 'http://localhost:5000';
const adminEmail = 'admin@shifi.com';
const adminPassword = 'admin123';
const merchantEmail = 'merchant-1743200041688@test.com';
const merchantPassword = 'Password123!';

// Cookie handling
function saveCookies(response, filename = 'cookies.txt') {
  const cookies = response.headers['set-cookie'];
  if (cookies) {
    fs.writeFileSync(filename, cookies.join('\n'));
    console.log(`Cookies saved to ${filename}`);
  }
}

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

// Login as admin
async function loginAsAdmin() {
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(
      `${baseUrl}/api/auth/login`,
      {
        email: adminEmail,
        password: adminPassword
      },
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Admin login successful!');
    saveCookies(response);
    return true;
  } catch (error) {
    console.error('Error during admin login:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Login as merchant
async function loginAsMerchant() {
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await axios.post(
      `${baseUrl}/api/auth/login`,
      {
        email: merchantEmail,
        password: merchantPassword
      },
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Merchant login successful!');
    saveCookies(response, 'merchant-cookies.txt');
    return true;
  } catch (error) {
    console.error('Error during merchant login:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Test admin contracts
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
    
    console.log('Admin contracts retrieved successfully!');
    console.log(`Found ${response.data.contracts.length} contracts`);
    
    // Display the first contract
    if (response.data.contracts.length > 0) {
      console.log('First contract:');
      const contract = response.data.contracts[0];
      console.log(`ID: ${contract.id}`);
      console.log(`Merchant ID: ${contract.merchantId}`);
      console.log(`Amount: ${contract.amount}`);
      console.log(`Interest Rate: ${contract.interestRate}`);
      console.log(`Term Months: ${contract.termMonths}`);
      console.log(`Status: ${contract.status}`);
      console.log(`Created At: ${contract.createdAt}`);
      console.log(`Cancellation Requested At: ${contract.cancellationRequestedAt}`);
    }
    
    return response.data.contracts;
  } catch (error) {
    console.error('Error during admin contracts test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return [];
  }
}

// Test merchant contracts
async function testMerchantContracts() {
  try {
    const csrfToken = await getCsrfToken();
    
    // Get merchant contracts
    const response = await axios.get(
      `${baseUrl}/api/merchant/contracts`,
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': getCookieString('merchant-cookies.txt')
        }
      }
    );
    
    console.log('Merchant contracts retrieved successfully!');
    console.log(`Found ${response.data.contracts.length} contracts for this merchant`);
    
    // Display the first contract
    if (response.data.contracts.length > 0) {
      console.log('First contract:');
      const contract = response.data.contracts[0];
      console.log(`ID: ${contract.id}`);
      console.log(`Merchant ID: ${contract.merchantId}`);
      console.log(`Amount: ${contract.amount}`);
      console.log(`Interest Rate: ${contract.interestRate}`);
      console.log(`Term Months: ${contract.termMonths}`);
      console.log(`Status: ${contract.status}`);
      console.log(`Created At: ${contract.createdAt}`);
      console.log(`Cancellation Requested At: ${contract.cancellationRequestedAt}`);
    }
    
    return response.data.contracts;
  } catch (error) {
    console.error('Error during merchant contracts test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return [];
  }
}

// Test specific contract
async function testSpecificContract(contractId) {
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
    
    console.log('Contract details retrieved successfully!');
    const contract = response.data.contract;
    
    console.log('Contract details:');
    console.log(`ID: ${contract.id}`);
    console.log(`Merchant ID: ${contract.merchantId}`);
    console.log(`Amount: ${contract.amount}`);
    console.log(`Interest Rate: ${contract.interestRate}`);
    console.log(`Term Months: ${contract.termMonths}`);
    console.log(`Status: ${contract.status}`);
    console.log(`Created At: ${contract.createdAt}`);
    console.log(`Cancellation Requested At: ${contract.cancellationRequestedAt}`);
    
    // Test underwriting data for this contract
    try {
      const underwritingResponse = await axios.get(
        `${baseUrl}/api/contracts/${contractId}/underwriting`,
        {
          withCredentials: true,
          headers: {
            'X-CSRF-Token': csrfToken,
            'Cookie': getCookieString()
          }
        }
      );
      
      console.log('Underwriting data retrieved successfully!');
      console.log(underwritingResponse.data);
    } catch (underwritingError) {
      console.error('Error retrieving underwriting data:', underwritingError.message);
      if (underwritingError.response) {
        console.error('Response status:', underwritingError.response.status);
        console.error('Response data:', underwritingError.response.data);
      }
    }
    
    return contract;
  } catch (error) {
    console.error('Error retrieving contract details:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Main function
async function main() {
  console.log('Starting contract test');
  
  // Login as admin
  const adminLoginSuccess = await loginAsAdmin();
  if (!adminLoginSuccess) {
    console.error('Admin login failed, aborting test');
    return;
  }
  
  // Test admin contracts
  const adminContracts = await testAdminContracts();
  
  // Test specific contract if any found
  if (adminContracts.length > 0) {
    await testSpecificContract(adminContracts[0].id);
  }
  
  // Login as merchant
  const merchantLoginSuccess = await loginAsMerchant();
  if (!merchantLoginSuccess) {
    console.error('Merchant login failed, skipping merchant tests');
    return;
  }
  
  // Test merchant contracts
  await testMerchantContracts();
  
  console.log('Contract tests completed');
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
});