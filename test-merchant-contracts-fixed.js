// This is a test script to verify contract retrieval with merchant authentication
const fetch = require('node-fetch');
const { CookieJar } = require('tough-cookie');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');

// User credentials
const userEmail = 'brandon@shilohfinance.com';
const userPassword = 'Password123!';
const merchantId = 49;
const baseUrl = 'http://localhost:3000';

async function getAuthToken() {
  console.log('Logging in with user credentials...');
  
  try {
    // Create a cookie jar to store session cookies
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    
    // First, log in to get the session cookie
    const loginResponse = await client.post(`${baseUrl}/api/auth/login`, {
      email: userEmail,
      password: userPassword
    });
    
    console.log('Login response status:', loginResponse.status);
    
    if (loginResponse.status !== 200) {
      throw new Error(`Login failed with status ${loginResponse.status}`);
    }
    
    console.log('Successfully logged in!');
    console.log('Getting cookies from jar...');
    
    // The cookie jar should now contain the session cookie
    const cookies = await jar.getCookies(baseUrl);
    console.log('Cookies:', cookies.map(c => `${c.key}=${c.value}`).join('; '));
    
    // Store the auth cookie
    const authCookie = cookies.find(c => c.key === 'connect.sid');
    if (!authCookie) {
      throw new Error('Authentication cookie not found');
    }
    
    const cookieString = `${authCookie.key}=${authCookie.value}`;
    console.log('Auth cookie:', cookieString);
    
    return { client, cookieString };
  } catch (error) {
    console.error('Error during authentication:', error);
    throw error;
  }
}

async function getContracts(client, cookieString) {
  console.log('Retrieving contracts for merchant...');
  
  try {
    // Endpoint to get contracts for the merchant
    const response = await client.get(`${baseUrl}/api/merchants/${merchantId}/contracts`, {
      headers: {
        Cookie: cookieString
      }
    });
    
    console.log('Contracts response status:', response.status);
    
    if (response.status !== 200) {
      throw new Error(`Failed to retrieve contracts with status ${response.status}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error retrieving contracts:', error);
    throw error;
  }
}

async function getContractsByCustomerId(client, cookieString, customerId) {
  console.log(`Retrieving contracts for customer ID ${customerId}...`);
  
  try {
    // Endpoint to get contracts by customer ID
    const response = await client.get(`${baseUrl}/api/contracts/customer/${customerId}`, {
      headers: {
        Cookie: cookieString
      }
    });
    
    console.log('Contracts by customer ID response status:', response.status);
    
    if (response.status !== 200) {
      throw new Error(`Failed to retrieve contracts by customer ID with status ${response.status}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error retrieving contracts for customer ID ${customerId}:`, error);
    throw error;
  }
}

async function getContractsByStatus(client, cookieString, status) {
  console.log(`Retrieving contracts with status "${status}"...`);
  
  try {
    // Endpoint to get contracts by status
    const response = await client.get(`${baseUrl}/api/contracts/status/${status}`, {
      headers: {
        Cookie: cookieString
      }
    });
    
    console.log(`Contracts with status "${status}" response status:`, response.status);
    
    if (response.status !== 200) {
      throw new Error(`Failed to retrieve contracts by status with status ${response.status}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error retrieving contracts with status "${status}":`, error);
    throw error;
  }
}

async function main() {
  try {
    // Get authentication token
    const { client, cookieString } = await getAuthToken();
    
    // Get contracts for merchant
    const contracts = await getContracts(client, cookieString);
    console.log('Contracts retrieved:', contracts.length);
    
    if (contracts.length > 0) {
      // Get a customer ID from the first contract
      const customerId = contracts[0].customerId;
      if (customerId) {
        // Get contracts for this customer ID
        const customerContracts = await getContractsByCustomerId(client, cookieString, customerId);
        console.log(`Contracts for customer ID ${customerId}:`, customerContracts.length);
      }
      
      // Get contracts by status
      const status = contracts[0].status;
      if (status) {
        const statusContracts = await getContractsByStatus(client, cookieString, status);
        console.log(`Contracts with status "${status}":`, statusContracts.length);
      }
    }
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();