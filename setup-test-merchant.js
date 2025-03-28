/**
 * Script to create a test merchant for use in other tests
 */

import axios from 'axios';

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
const BYPASS_CSRF_HEADER = 'X-Csrf-Bypass';
const BYPASS_CSRF_VALUE = 'test-merchant-setup';

// Test data for creating a merchant
const merchantData = {
  // User data (this will create the merchant user)
  email: `merchant-${Date.now()}@test.com`,
  password: 'Password123!',
  firstName: 'Test',
  lastName: 'Merchant',
  phone: '555-987-6543',
  companyName: 'Test Financing Company',
  businessAddress: '123 Test St, Testville, TX 12345',
  businessType: 'financing',
  taxId: '12-3456789'
};

/**
 * Create a test merchant user and get the ID
 */
async function createTestMerchant() {
  try {
    console.log('Creating test merchant...');
    console.log(`Using email: ${merchantData.email}`);
    
    // First create the user
    const userResponse = await axios.post(
      `${API_BASE_URL}/users`,
      {
        email: merchantData.email,
        password: merchantData.password,
        firstName: merchantData.firstName,
        lastName: merchantData.lastName,
        name: `${merchantData.firstName} ${merchantData.lastName}`, // Add the name field
        phone: merchantData.phone,
        role: 'merchant' // Explicit role assignment
      },
      {
        headers: {
          [BYPASS_CSRF_HEADER]: BYPASS_CSRF_VALUE
        }
      }
    );
    
    console.log('User Response:', JSON.stringify(userResponse.data, null, 2));
    
    // The response structure seems different than expected
    // Check if we got an ID directly
    const userId = userResponse.data.id || (userResponse.data.user && userResponse.data.user.id);
    
    if (!userId) {
      console.error('Failed to create merchant user: No user ID returned');
      return null;
    }
    console.log(`Created user with ID ${userId}`);
    
    // Now create the merchant entity linked to that user
    const merchantResponse = await axios.post(
      `${API_BASE_URL}/merchants`,
      {
        userId: userId,
        companyName: merchantData.companyName,
        businessAddress: merchantData.businessAddress,
        businessType: merchantData.businessType,
        taxId: merchantData.taxId,
        // Add the required fields
        name: merchantData.companyName,
        contactName: `${merchantData.firstName} ${merchantData.lastName}`,
        email: merchantData.email,
        phone: merchantData.phone
      },
      {
        headers: {
          [BYPASS_CSRF_HEADER]: BYPASS_CSRF_VALUE
        }
      }
    );
    
    console.log('Merchant Response:', JSON.stringify(merchantResponse.data, null, 2));
    
    // The response structure might be different than expected
    // It appears to return the merchant object directly instead of a {success: true, merchant: {...}} structure
    const merchantId = merchantResponse.data.id || (merchantResponse.data.merchant && merchantResponse.data.merchant.id);
    
    if (!merchantId) {
      console.error('Failed to create merchant: No merchant ID returned');
      return null;
    }
    console.log('✅ Successfully created merchant with ID:', merchantId);
    
    // Now add the business details with MidDesk verification information
    try {
      // Create the merchant business details
      const businessDetailsResponse = await axios.post(
        `${API_BASE_URL}/merchant-business-details`,
        {
          merchantId: merchantId,
          legalName: `${merchantData.companyName} LLC`,
          ein: merchantData.taxId,
          businessStructure: 'LLC',
          streetAddress: '123 Test St',
          streetAddress2: 'Suite 100',
          city: 'Testville',
          state: 'TX',
          zipCode: '12345',
          middeskBusinessId: null,
          verificationStatus: 'not_started'
        },
        {
          headers: {
            [BYPASS_CSRF_HEADER]: BYPASS_CSRF_VALUE
          }
        }
      );
      
      console.log('Business Details Response:', JSON.stringify(businessDetailsResponse.data, null, 2));
    } catch (businessError) {
      console.error('Warning: Failed to create business details:');
      if (businessError.response) {
        console.error('Status:', businessError.response.status);
        console.error('Data:', JSON.stringify(businessError.response.data, null, 2));
      } else {
        console.error(businessError.message);
      }
      // Continue even if this fails - we've at least created the merchant
    }
    
    return {
      userId,
      merchantId,
      email: merchantData.email,
      password: merchantData.password
    };
  } catch (error) {
    console.error('❌ Error creating merchant:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    return null;
  }
}

// Run the merchant creation
createTestMerchant().then(merchantInfo => {
  if (merchantInfo) {
    console.log('Merchant creation successful!');
    console.log('Merchant info:', merchantInfo);
    console.log('\nUse these credentials for testing:');
    console.log(`- Merchant ID: ${merchantInfo.merchantId}`);
    console.log(`- Email: ${merchantInfo.email}`);
    console.log(`- Password: ${merchantInfo.password}`);
    
    // Update the test-salesrep-create.js file with this merchant ID
    console.log(`\nUpdate test-salesrep-create.js with: const MERCHANT_ID = ${merchantInfo.merchantId};`);
  } else {
    console.error('Merchant creation failed.');
  }
});

export { createTestMerchant };