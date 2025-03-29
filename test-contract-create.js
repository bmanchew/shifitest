/**
 * Test script to create a contract with proper CSRF bypass for testing
 */

import axios from 'axios';
const baseUrl = 'http://localhost:5000/api';

// Simple logger
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`)
};

async function createTestContract() {
  try {
    // Get a CSRF token first
    logger.info('Requesting CSRF token...');
    const csrfResponse = await axios.get(`${baseUrl}/csrf-token`);
    const csrfToken = csrfResponse.data.csrfToken;
    
    logger.info(`Obtained CSRF token: ${csrfToken}`);
    
    // Create a contract using the token and bypass header
    logger.info('Creating test contract...');
    const contractResponse = await axios.post(
      `${baseUrl}/contracts`,
      {
        merchantId: 61,
        phoneNumber: "+15551234567",
        amount: 10000,
        termMonths: 12,
        interestRate: 5.99,
        monthlyPayment: 900.25,
        downPayment: 1000,
        contractNumber: `CT-${Date.now()}`,
        financedAmount: 9000  // amount - downPayment
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'X-CSRF-Bypass': 'test-contract-setup'
        }
      }
    );

    console.log('[INFO] Contract created successfully:', JSON.stringify(contractResponse.data, null, 2));
    console.log(`[INFO] Successfully created test contract with ID: ${contractResponse.data.id}`);
    
    return contractResponse.data;
  } catch (error) {
    console.error('[ERROR] Failed to create contract:', error.response?.data || error.message);
    throw error;
  }
}

// Run the function
createTestContract()
  .then(contract => {
    console.log(`Contract created with ID: ${contract.id}`);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });