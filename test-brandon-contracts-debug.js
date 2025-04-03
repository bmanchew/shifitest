/**
 * Debug script for investigating Brandon's contracts display issue
 * This script will:
 * 1. Login as brandon@shilohfinance.com
 * 2. Make the contracts API call with detailed debugging
 * 3. Analyze the response and parameters
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
    console.log('Getting CSRF token...');
    const response = await axios.get(`${baseUrl}/api/csrf-token`, {
      withCredentials: true,
      headers: {
        Cookie: getCookieString()
      }
    });
    console.log('CSRF token received:', response.data.csrfToken);
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Login
async function login() {
  try {
    console.log(`Attempting to login as ${email}`);
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    
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
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    saveCookies(response);
    return response.data;
  } catch (error) {
    console.error('Error during login:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Get current user details (debug merchant ID)
async function getCurrentUser() {
  try {
    console.log('Getting current user details...');
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    
    const response = await axios.get(
      `${baseUrl}/api/auth/me`,
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': getCookieString()
        }
      }
    );
    
    console.log('User details retrieved successfully!');
    console.log('Current user:', JSON.stringify(response.data, null, 2));
    
    // Check if merchantId is set correctly
    if (response.data.merchantId) {
      console.log(`✅ merchantId is set correctly: ${response.data.merchantId}`);
    } else {
      console.log('❌ merchantId is not set in user data');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error retrieving user details:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Get merchant profile
async function getMerchantProfile() {
  try {
    console.log('Getting merchant profile...');
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    
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
    console.log(JSON.stringify(response.data, null, 2));
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

// Get merchant contracts multiple ways to debug the issue
async function debugContractsEndpoint() {
  const user = await getCurrentUser();
  const merchantId = user?.merchantId || 49; // Default to 49 if not available
  
  console.log(`\n=== Testing Contract Requests with merchantId=${merchantId} ===\n`);
  
  // Try different variations of the API endpoint
  await getContractsStandard(merchantId);
  await getContractsWithExplicitMerchantId(merchantId);
  await getContractsWithoutMerchantId();
  await getContractsAsAdmin();
}

// Standard way - should match what the frontend uses
async function getContractsStandard(merchantId) {
  try {
    console.log('\n1. Getting contracts with standard method (matches UI)...');
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    
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
    console.log(`Found ${response.data.contracts?.length || 0} contracts`);
    
    if (response.data.contracts && response.data.contracts.length > 0) {
      console.log('✅ Contracts available in standard response');
    } else {
      console.log('❌ No contracts in standard response');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error retrieving contracts (standard):', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// With explicit merchantId param
async function getContractsWithExplicitMerchantId(merchantId) {
  try {
    console.log(`\n2. Getting contracts with explicit merchantId=${merchantId}...`);
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    
    const response = await axios.get(
      `${baseUrl}/api/contracts?merchantId=${merchantId}`,
      {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Cookie': getCookieString()
        }
      }
    );
    
    console.log('Contracts retrieved successfully!');
    console.log(`Found ${response.data.contracts?.length || 0} contracts`);
    
    if (response.data.contracts && response.data.contracts.length > 0) {
      console.log('✅ Contracts available with explicit merchantId');
    } else {
      console.log('❌ No contracts with explicit merchantId');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error retrieving contracts (explicit merchantId):', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Without merchantId param
async function getContractsWithoutMerchantId() {
  try {
    console.log('\n3. Getting contracts without merchantId parameter...');
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    
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
    console.log(`Found ${response.data.contracts?.length || 0} contracts`);
    
    if (response.data.contracts && response.data.contracts.length > 0) {
      console.log('✅ Contracts available without merchantId param');
    } else {
      console.log('❌ No contracts without merchantId param');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error retrieving contracts (no merchantId):', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// As admin
async function getContractsAsAdmin() {
  try {
    console.log('\n4. Getting contracts with admin parameter...');
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    
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
    
    console.log('Contracts retrieved with admin parameter!');
    console.log(`Found ${response.data.contracts?.length || 0} contracts`);
    
    if (response.data.contracts && response.data.contracts.length > 0) {
      console.log('✅ Contracts available with admin param (should fail for merchants)');
    } else {
      console.log('❌ No contracts with admin param (expected for non-admins)');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error retrieving contracts (admin):', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      if (error.response.status === 403) {
        console.log('✅ Correctly denied admin access (expected)');
      }
    }
    return null;
  }
}

// Main function
async function main() {
  console.log('Starting Brandon contract debug test');
  
  // Login first
  const userInfo = await login();
  if (!userInfo) {
    console.error('Login failed, aborting test');
    return;
  }
  
  // Check current user endpoint
  await getCurrentUser();
  
  // Try to get merchant profile
  await getMerchantProfile();
  
  // Debug contract endpoints
  await debugContractsEndpoint();
  
  console.log('\nTest completed');
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
});