/**
 * Test script for the merchant funding routes
 * This script verifies the admin merchant funding provider toggle functionality
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000';

async function getCsrfToken(cookies) {
  const csrfRegex = /XSRF-TOKEN=([^;]+)/;
  const match = cookies.match(csrfRegex);
  return match ? match[1] : null;
}

async function loadCookies() {
  try {
    const cookiesFile = path.resolve('./admin-cookies.txt');
    if (fs.existsSync(cookiesFile)) {
      return fs.readFileSync(cookiesFile, 'utf8');
    }
    return null;
  } catch (error) {
    console.error('Error loading cookies:', error);
    return null;
  }
}

async function saveCookies(cookieString) {
  try {
    fs.writeFileSync('./admin-cookies.txt', cookieString);
    console.log('Cookies saved to admin-cookies.txt');
  } catch (error) {
    console.error('Error saving cookies:', error);
  }
}

async function loginAsAdmin() {
  try {
    console.log('Logging in as admin...');
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@shifi.com',
      password: 'password123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    if (response.data && response.data.success) {
      console.log('Admin login successful!');
      
      // Save cookies for future requests
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const cookieString = cookies.join('; ');
        await saveCookies(cookieString);
        return cookieString;
      }
    } else {
      console.error('Admin login failed:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Error during admin login:', error.response?.data || error.message);
    return null;
  }
}

async function testGetMerchantFundingSettings(merchantId, cookies, csrfToken) {
  try {
    console.log(`\nTesting GET merchant funding settings for merchant ID: ${merchantId}`);
    
    const response = await axios.get(`${BASE_URL}/api/admin/merchant-funding/${merchantId}`, {
      headers: {
        'Cookie': cookies,
        'X-XSRF-TOKEN': csrfToken
      },
      withCredentials: true
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error getting merchant funding settings:', error.response?.data || error.message);
    return null;
  }
}

async function testToggleShifiFunding(merchantId, enabled, cookies, csrfToken) {
  try {
    console.log(`\nTesting ${enabled ? 'enabling' : 'disabling'} ShiFi funding for merchant ID: ${merchantId}`);
    
    const response = await axios.put(`${BASE_URL}/api/admin/merchant-funding/${merchantId}`, {
      shifiFundingEnabled: enabled
    }, {
      headers: {
        'Cookie': cookies,
        'X-XSRF-TOKEN': csrfToken,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error toggling ShiFi funding:', error.response?.data || error.message);
    return null;
  }
}

async function testToggleCoveredCareFunding(merchantId, enabled, cookies, csrfToken) {
  try {
    console.log(`\nTesting ${enabled ? 'enabling' : 'disabling'} CoveredCare funding for merchant ID: ${merchantId}`);
    
    const response = await axios.put(`${BASE_URL}/api/admin/merchant-funding/${merchantId}`, {
      coveredCareFundingEnabled: enabled
    }, {
      headers: {
        'Cookie': cookies,
        'X-XSRF-TOKEN': csrfToken,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error toggling CoveredCare funding:', error.response?.data || error.message);
    return null;
  }
}

async function testConfigureCoveredCareSettings(merchantId, settings, cookies, csrfToken) {
  try {
    console.log(`\nTesting configuring CoveredCare settings for merchant ID: ${merchantId}`);
    
    const response = await axios.post(`${BASE_URL}/api/admin/merchant-funding/${merchantId}/coveredcare-settings`, 
      settings, 
      {
        headers: {
          'Cookie': cookies,
          'X-XSRF-TOKEN': csrfToken,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      }
    );
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error configuring CoveredCare settings:', error.response?.data || error.message);
    return null;
  }
}

async function testGetAllMerchantsFundingSettings(cookies, csrfToken) {
  try {
    console.log(`\nTesting GET all merchants with funding settings`);
    
    const response = await axios.get(`${BASE_URL}/api/admin/merchant-funding`, {
      headers: {
        'Cookie': cookies,
        'X-XSRF-TOKEN': csrfToken
      },
      withCredentials: true
    });
    
    console.log('Response merchants count:', response.data?.merchants?.length);
    if (response.data?.merchants?.length > 0) {
      console.log('First merchant:', JSON.stringify(response.data.merchants[0], null, 2));
    }
    return response.data;
  } catch (error) {
    console.error('Error getting all merchants with funding settings:', error.response?.data || error.message);
    return null;
  }
}

async function runTests() {
  try {
    // Step 1: Load existing cookies or login as admin
    let cookies = await loadCookies();
    if (!cookies) {
      cookies = await loginAsAdmin();
      if (!cookies) {
        console.error('Failed to login as admin. Exiting tests.');
        return;
      }
    }
    
    // Extract CSRF token from cookies
    const csrfToken = await getCsrfToken(cookies);
    if (!csrfToken) {
      console.error('Failed to extract CSRF token. Exiting tests.');
      return;
    }
    
    console.log('Using CSRF token:', csrfToken);
    
    // Step 2: Get all merchants to find a valid merchant ID for testing
    const allMerchantsResponse = await testGetAllMerchantsFundingSettings(cookies, csrfToken);
    if (!allMerchantsResponse || !allMerchantsResponse.merchants || allMerchantsResponse.merchants.length === 0) {
      console.error('No merchants found for testing. Exiting tests.');
      return;
    }
    
    // Get the first merchant ID for testing
    const testMerchantId = allMerchantsResponse.merchants[0].id;
    console.log(`Using merchant ID ${testMerchantId} for testing`);
    
    // Step 3: Test get merchant funding settings
    await testGetMerchantFundingSettings(testMerchantId, cookies, csrfToken);
    
    // Step 4: Test toggle ShiFi funding (disable then enable)
    await testToggleShifiFunding(testMerchantId, false, cookies, csrfToken);
    await testToggleShifiFunding(testMerchantId, true, cookies, csrfToken);
    
    // Step 5: Test toggle CoveredCare funding (enable then disable)
    await testToggleCoveredCareFunding(testMerchantId, true, cookies, csrfToken);
    
    // Step 6: Test configuring CoveredCare settings
    const testSettings = {
      providerGuid: "test-provider-guid-123",
      branchLocationGuid: "test-branch-guid-456",
      productTypeGuid: "test-product-type-guid-789",
      additionalSettings: {
        preferredLoanTerm: 36,
        maxLoanAmount: 10000
      }
    };
    
    await testConfigureCoveredCareSettings(testMerchantId, testSettings, cookies, csrfToken);
    
    // Step 7: Disable CoveredCare funding
    await testToggleCoveredCareFunding(testMerchantId, false, cookies, csrfToken);
    
    console.log('\nAll merchant funding tests completed!');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests();