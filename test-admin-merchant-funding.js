import axios from 'axios';
import fs from 'fs';

const API_BASE_URL = 'http://localhost:5000/api';

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Helper functions for cookies
async function saveCookies(cookieString) {
  fs.writeFileSync('./admin-funding-cookies.txt', cookieString, 'utf8');
  console.log('Cookies saved to admin-funding-cookies.txt');
}

async function loadCookies() {
  try {
    if (fs.existsSync('./admin-funding-cookies.txt')) {
      const cookies = fs.readFileSync('./admin-funding-cookies.txt', 'utf8');
      console.log('Loaded cookies from file');
      return cookies;
    }
    return null;
  } catch (error) {
    console.error('Error loading cookies:', error.message);
    return null;
  }
}

async function getCsrfToken(cookies) {
  try {
    console.log('Getting CSRF token...');
    const response = await axios.get(`${API_BASE_URL}/csrf-token`, {
      headers: {
        ...HEADERS,
        'Cookie': cookies
      },
      withCredentials: true
    });

    if (response.data.csrfToken) {
      console.log('CSRF token retrieved successfully');
      return response.data.csrfToken;
    } else {
      console.error('Failed to get CSRF token:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

async function loginAsAdmin() {
  try {
    console.log('Logging in as admin...');
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@shifi.com',
      password: 'password123'
    }, {
      headers: HEADERS,
      withCredentials: true
    });

    if (response.data.success) {
      console.log('Login successful!');
      if (response.headers['set-cookie']) {
        const cookies = response.headers['set-cookie'].join('; ');
        await saveCookies(cookies);
        return cookies;
      }
    } else {
      console.error('Login failed:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('Error during login:', error.message);
    return null;
  }
}

// Main test functions
async function testGetMerchantFundingSettings(merchantId, cookies, csrfToken) {
  try {
    console.log(`\nGetting funding settings for merchant ${merchantId}...`);
    const response = await axios.get(`${API_BASE_URL}/admin/merchant-funding/${merchantId}`, {
      headers: {
        ...HEADERS,
        'X-XSRF-TOKEN': csrfToken,
        'Cookie': cookies
      },
      withCredentials: true
    });

    if (response.data.success) {
      console.log('Merchant funding settings:');
      console.log(JSON.stringify(response.data.merchant, null, 2));
      return response.data.merchant;
    } else {
      console.error('Failed to get merchant funding settings:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('Error fetching merchant funding settings:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

async function testToggleShifiFunding(merchantId, enabled, cookies, csrfToken) {
  try {
    console.log(`\nToggling ShiFi funding for merchant ${merchantId} to ${enabled ? 'enabled' : 'disabled'}...`);
    const response = await axios.post(`${API_BASE_URL}/admin/merchant-funding/${merchantId}/shifi`, {
      enabled
    }, {
      headers: {
        ...HEADERS,
        'X-XSRF-TOKEN': csrfToken,
        'Cookie': cookies
      },
      withCredentials: true
    });

    if (response.data.success) {
      console.log('ShiFi funding updated successfully:');
      console.log(JSON.stringify(response.data.merchant, null, 2));
      return response.data.merchant;
    } else {
      console.error('Failed to update ShiFi funding:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('Error updating ShiFi funding:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

async function testToggleCoveredCareFunding(merchantId, enabled, cookies, csrfToken) {
  try {
    console.log(`\nToggling CoveredCare funding for merchant ${merchantId} to ${enabled ? 'enabled' : 'disabled'}...`);
    const response = await axios.post(`${API_BASE_URL}/admin/merchant-funding/${merchantId}/covered-care`, {
      enabled
    }, {
      headers: {
        ...HEADERS,
        'X-XSRF-TOKEN': csrfToken,
        'Cookie': cookies
      },
      withCredentials: true
    });

    if (response.data.success) {
      console.log('CoveredCare funding updated successfully:');
      console.log(JSON.stringify(response.data.merchant, null, 2));
      return response.data.merchant;
    } else {
      console.error('Failed to update CoveredCare funding:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('Error updating CoveredCare funding:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

async function runTests() {
  try {
    // Login as admin and get CSRF token
    let cookies = await loadCookies();
    if (!cookies) {
      cookies = await loginAsAdmin();
      if (!cookies) {
        console.error('Failed to login. Exiting...');
        return;
      }
    }
    
    const csrfToken = await getCsrfToken(cookies);
    if (!csrfToken) {
      console.error('Failed to get CSRF token. Trying to login again...');
      cookies = await loginAsAdmin();
      if (!cookies) {
        console.error('Login failed. Exiting...');
        return;
      }
      const retryToken = await getCsrfToken(cookies);
      if (!retryToken) {
        console.error('Failed to get CSRF token after login retry. Exiting...');
        return;
      }
    }

    // Select a merchant for testing
    const merchantId = 49; // SHILOH FINANCE INC in our database
    
    // Get current merchant funding settings
    const initialSettings = await testGetMerchantFundingSettings(merchantId, cookies, csrfToken);
    if (!initialSettings) {
      console.error('Failed to get initial settings. Exiting...');
      return;
    }

    // Toggle ShiFi funding OFF
    await testToggleShifiFunding(merchantId, false, cookies, csrfToken);
    
    // Toggle CoveredCare funding ON
    await testToggleCoveredCareFunding(merchantId, true, cookies, csrfToken);
    
    // Get updated merchant funding settings
    const midSettings = await testGetMerchantFundingSettings(merchantId, cookies, csrfToken);
    
    // Toggle ShiFi funding ON
    await testToggleShifiFunding(merchantId, true, cookies, csrfToken);
    
    // Toggle CoveredCare funding OFF
    await testToggleCoveredCareFunding(merchantId, false, cookies, csrfToken);
    
    // Get final merchant funding settings
    const finalSettings = await testGetMerchantFundingSettings(merchantId, cookies, csrfToken);
    
    console.log('\nTest sequence complete!');
    console.log('Initial settings:', JSON.stringify(initialSettings, null, 2));
    console.log('Mid settings:', JSON.stringify(midSettings, null, 2));
    console.log('Final settings:', JSON.stringify(finalSettings, null, 2));
  } catch (error) {
    console.error('Error running tests:', error.message);
  }
}

// Run the tests
runTests();