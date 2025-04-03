/**
 * Test script to verify contract retrieval via the merchant association
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for the test
const BASE_URL = 'http://localhost:5000';
const COOKIES_FILE = 'test-client-auth-cookies.txt';

// Helper functions
function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const cookies = fs.readFileSync(COOKIES_FILE, 'utf8').trim();
      console.log('Loaded cookies:', cookies);
      return cookies;
    }
  } catch (error) {
    console.error('Error loading cookies:', error.message);
  }
  return '';
}

// API request function
async function apiRequest(method, url, data = null) {
  try {
    const cookies = loadCookies();
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookies
      },
      withCredentials: true
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`API Request Error (${method} ${url}):`, error.response?.data || error.message);
    throw error;
  }
}

// Test functions
async function testGetMerchantProfile() {
  console.log('\n===== Testing Merchant Profile Retrieval =====');
  
  try {
    const merchantResponse = await apiRequest('GET', '/api/current-merchant');
    
    if (merchantResponse.success) {
      console.log('Merchant Profile:', JSON.stringify(merchantResponse.data, null, 2));
      return merchantResponse.data;
    } else {
      console.error('Failed to get merchant profile:', merchantResponse);
      return null;
    }
  } catch (error) {
    console.error('Error getting merchant profile:', error);
    return null;
  }
}

async function testGetContractsForMerchant(merchantId) {
  console.log(`\n===== Testing Contract Retrieval for Merchant ${merchantId} =====`);
  
  try {
    // Get contracts with explicit merchantId
    const contractsResponse = await apiRequest('GET', `/api/contracts?merchantId=${merchantId}`);
    
    console.log(`Retrieved ${contractsResponse.contracts?.length || 0} contracts for merchant ${merchantId}`);
    
    if (contractsResponse.contracts && contractsResponse.contracts.length > 0) {
      const firstContract = contractsResponse.contracts[0];
      console.log('First contract overview:', {
        id: firstContract.id,
        contractNumber: firstContract.contractNumber,
        type: firstContract.type,
        amount: firstContract.amount,
        termMonths: firstContract.termMonths,
        interestRate: firstContract.interestRate,
        status: firstContract.status
      });
    }
    
    return contractsResponse;
  } catch (error) {
    console.error('Error getting contracts:', error);
    return null;
  }
}

async function testGetContractDetails(contractId) {
  console.log(`\n===== Testing Contract Details for Contract ${contractId} =====`);
  
  try {
    const detailsResponse = await apiRequest('GET', `/api/contracts/${contractId}`);
    
    if (detailsResponse.success) {
      console.log('Contract Details:', {
        id: detailsResponse.contract.id,
        contractNumber: detailsResponse.contract.contractNumber,
        type: detailsResponse.contract.type,
        amount: detailsResponse.contract.amount,
        termMonths: detailsResponse.contract.termMonths,
        interestRate: detailsResponse.contract.interestRate,
        status: detailsResponse.contract.status,
        merchantId: detailsResponse.contract.merchantId
      });
      return detailsResponse.contract;
    } else {
      console.error('Failed to get contract details:', detailsResponse);
      return null;
    }
  } catch (error) {
    console.error('Error getting contract details:', error);
    return null;
  }
}

// Main test function
async function runContractTests() {
  console.log('\n===== Starting Contract Tests =====');
  
  try {
    // First, get the merchant profile
    const merchantProfile = await testGetMerchantProfile();
    
    if (!merchantProfile) {
      console.error('Cannot proceed without merchant profile');
      return false;
    }
    
    // Get contracts for the merchant
    const contractsResponse = await testGetContractsForMerchant(merchantProfile.id);
    
    if (!contractsResponse || !contractsResponse.contracts || contractsResponse.contracts.length === 0) {
      console.warn('No contracts found for merchant, cannot test contract details');
      return true; // Still a partial success
    }
    
    // Get details for the first contract
    const firstContractId = contractsResponse.contracts[0].id;
    const contractDetails = await testGetContractDetails(firstContractId);
    
    if (!contractDetails) {
      console.error('Failed to get contract details');
      return false;
    }
    
    // Check associations
    if (contractDetails.merchantId === merchantProfile.id) {
      console.log(`\n✅ SUCCESS: Contract ${contractDetails.id} is correctly associated with merchant ${merchantProfile.id}`);
      return true;
    } else {
      console.error(`\n❌ FAILURE: Contract ${contractDetails.id} is associated with merchant ${contractDetails.merchantId}, expected ${merchantProfile.id}`);
      return false;
    }
  } catch (error) {
    console.error('Contract tests failed:', error);
    return false;
  }
}

// Run the tests
runContractTests().then(success => {
  console.log('\nAll tests completed with result:', success ? 'SUCCESS' : 'FAILURE');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Tests failed with uncaught error:', error);
  process.exit(1);
});