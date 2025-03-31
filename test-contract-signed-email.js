import axios from 'axios';
import fs from 'fs';

// Define customer info - using information provided
const customerEmail = 'brandon@calimited.com';
const customerName = 'Brandon Customer';
const phoneNumber = '19493223824';

// Create an instance of axios with cookies enabled
const axiosInstance = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true
});

// Utility to save cookies
function saveCookies(response) {
  if (response.headers['set-cookie']) {
    const cookies = response.headers['set-cookie'];
    fs.writeFileSync('cookies.txt', cookies.join('\n'));
    console.log('Cookies saved');
  }
}

// Utility to load cookies
function loadCookies() {
  if (fs.existsSync('cookies.txt')) {
    const cookies = fs.readFileSync('cookies.txt', 'utf8').split('\n');
    return cookies.join('; ');
  }
  return null;
}

// Step 1: Visit the login page to get CSRF token
async function getCsrfToken() {
  try {
    const response = await axiosInstance.get('/login');
    saveCookies(response);
    
    // Extract CSRF token from response
    const csrfMatch = response.data.match(/name="_csrf" value="([^"]+)"/);
    if (csrfMatch && csrfMatch[1]) {
      const csrfToken = csrfMatch[1];
      console.log('CSRF Token obtained:', csrfToken);
      return csrfToken;
    } else {
      console.error('CSRF token not found in the response');
      return null;
    }
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    return null;
  }
}

// Step 2: Create a test contract
async function createTestContract(csrfToken) {
  try {
    // Set the cookie if available
    const cookie = loadCookies();
    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    };
    
    if (cookie) {
      headers.Cookie = cookie;
    }
    
    const contractData = {
      amount: 1500,
      downPayment: 150,
      financedAmount: 1350,
      termMonths: 12,
      interestRate: 5.99,
      monthlyPayment: 121.42,
      startDate: '2025-04-01',
      endDate: '2026-03-31',
      merchantId: 1,
      customerId: 2,
      customerName: customerName,
      phoneNumber: phoneNumber,
      customerEmail: customerEmail,
      itemName: 'Premium Furniture Set',
      status: 'active',
      contractNumber: 'RIC1001-' + Date.now().toString().slice(-4),
      _csrf: csrfToken
    };
    
    const response = await axiosInstance.post('/api/contracts', contractData, { headers });
    saveCookies(response);
    
    console.log('Contract created successfully:', response.data);
    return response.data.contractId;
  } catch (error) {
    console.error('Error creating contract:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Step 3: Simulate contract signing to trigger email
async function simulateContractSigning(contractId, csrfToken) {
  try {
    const cookie = loadCookies();
    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    };
    
    if (cookie) {
      headers.Cookie = cookie;
    }
    
    const signingData = {
      contractId: contractId,
      signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAA',
      customerName: customerName,
      _csrf: csrfToken
    };
    
    // Use the contract signing endpoint
    const response = await axiosInstance.post('/api/contracts/sign', signingData, { headers });
    saveCookies(response);
    
    console.log('Contract signed successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error signing contract:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Run the test
async function runTest() {
  try {
    // Step 1: Get CSRF token
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    
    // Step 2: Create a test contract
    const contractId = await createTestContract(csrfToken);
    if (!contractId) {
      throw new Error('Failed to create test contract');
    }
    
    // Step 3: Simulate contract signing to trigger email
    const signingResult = await simulateContractSigning(contractId, csrfToken);
    if (!signingResult || !signingResult.success) {
      throw new Error('Failed to sign contract');
    }
    
    console.log('Test completed successfully!');
    console.log('If everything worked correctly, a welcome email with the signed contract should have been sent to', customerEmail);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
runTest();