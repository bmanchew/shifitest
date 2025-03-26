/**
 * Test script for the streamlined sales rep creation endpoint
 * This tests the /api/sales-reps/create-with-user endpoint that creates
 * a user and registers them as a sales rep in a single step
 */

import axios from 'axios';

// Configuration
const API_BASE_URL = 'http://localhost:5001/api';
const MERCHANT_ID = 1; // Use an existing merchant ID from your database

// Test data for creating a new sales rep
const salesRepData = {
  // User data
  email: `salesrep-${Date.now()}@test.com`, // Use timestamp to ensure unique email
  password: 'Password123!',
  firstName: 'Test',
  lastName: 'SalesRep',
  phone: '555-123-4567',
  
  // Sales rep data
  merchantId: MERCHANT_ID,
  title: 'Sales Associate',
  commissionRate: 5.0, // 5% commission
  commissionRateType: 'percentage',
  maxAllowedFinanceAmount: 50000,
  target: 100000,
  notes: 'Test sales rep created via API'
};

/**
 * Test the create-with-user endpoint
 */
async function testCreateSalesRepWithUser() {
  try {
    console.log('Testing sales rep creation with user creation...');
    console.log(`Creating sales rep with email: ${salesRepData.email}`);
    
    const response = await axios.post(
      `${API_BASE_URL}/sales-reps/create-with-user`,
      salesRepData
    );
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ Successfully created sales rep with ID:', response.data.salesRep.id);
      console.log('User ID:', response.data.user.id);
      console.log('User Role:', response.data.user.role);
      return response.data;
    } else {
      console.error('❌ Failed to create sales rep:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating sales rep:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    return null;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== Running Sales Rep API Tests ===');
  const createdSalesRep = await testCreateSalesRepWithUser();
  
  if (createdSalesRep) {
    console.log('All tests completed successfully!');
  } else {
    console.error('Some tests failed.');
  }
}

// Run the tests
runTests().catch(console.error);

// Export the functions for potential reuse
export { testCreateSalesRepWithUser, runTests };