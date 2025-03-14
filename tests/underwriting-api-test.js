// End-to-end test script for the underwriting API
import axios from 'axios';
// Use the current hostname which will work in Replit
const hostname = window?.location?.hostname || (typeof location !== 'undefined' ? location.hostname : 'localhost');
const baseUrl = `https://${hostname}/api`;

// Constants
const API_ENDPOINT = `${baseUrl}/underwriting`;
const TEST_CONTRACT_ID = 95; // Use contract 95 as requested by user
const TEST_USER_ID = 1; // Replace with a valid user ID from your database
const TEST_ROLE = 'admin'; // Test with admin role to see all data

// Test functions
async function testGetContractUnderwritingData() {
  try {
    console.log(`\n🔍 Testing GET ${API_ENDPOINT}/contract/${TEST_CONTRACT_ID}?role=${TEST_ROLE}`);
    
    const response = await axios.get(`${API_ENDPOINT}/contract/${TEST_CONTRACT_ID}?role=${TEST_ROLE}`);
    
    console.log(`✅ Status: ${response.status}`);
    console.log('📄 Response data sample:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function testGetUserUnderwritingData() {
  try {
    console.log(`\n🔍 Testing GET ${API_ENDPOINT}/user/${TEST_USER_ID}?role=${TEST_ROLE}`);
    
    const response = await axios.get(`${API_ENDPOINT}/user/${TEST_USER_ID}?role=${TEST_ROLE}`);
    
    console.log(`✅ Status: ${response.status}`);
    console.log('📄 Response data sample:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function testProcessUnderwriting() {
  try {
    console.log(`\n🔍 Testing POST ${API_ENDPOINT}/process/${TEST_CONTRACT_ID}`);
    
    const response = await axios.post(`${API_ENDPOINT}/process/${TEST_CONTRACT_ID}`);
    
    console.log(`✅ Status: ${response.status}`);
    console.log('📄 Response data sample:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

// Main execution
async function runTests() {
  console.log('🧪 Starting Underwriting API Tests 🧪');
  console.log('=========================================');
  
  // First test: Get contract underwriting data
  const contractData = await testGetContractUnderwritingData();
  
  // Second test: Get user underwriting data
  const userData = await testGetUserUnderwritingData();
  
  // Third test: Process underwriting for a contract
  // Since we want to see what data was captured for contract 95
  const processResult = await testProcessUnderwriting();
  
  console.log('\n=========================================');
  console.log('🧪 Underwriting API Tests Completed 🧪');
}

// Run the tests
runTests().catch(err => {
  console.error('An unexpected error occurred during tests:', err);
});