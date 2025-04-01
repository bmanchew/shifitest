import axios from 'axios';
import fs from 'fs';
const API_URL = 'http://localhost:5000/api';

// Store cookies in memory
let cookies = [];
let csrfToken = null;

// Load cookies from file if it exists
function loadCookies() {
  try {
    if (fs.existsSync('./cookies.txt')) {
      const cookieData = fs.readFileSync('./cookies.txt', 'utf8');
      cookies = cookieData.split('\n').filter(c => c.trim() !== '');
      console.log('Loaded cookies from file');
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
}

// Save cookies to file
function saveCookies() {
  try {
    fs.writeFileSync('./cookies.txt', cookies.join('\n'));
    console.log('Saved cookies to file');
  } catch (error) {
    console.error('Error saving cookies:', error);
  }
}

// Get CSRF token
async function getCsrfToken() {
  try {
    console.log('Getting CSRF token...');
    const response = await axios.get(`${API_URL}/csrf-token`, {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    
    // Save cookies from response
    if (response.headers['set-cookie']) {
      cookies = response.headers['set-cookie'];
      saveCookies();
    }
    
    csrfToken = response.data.csrfToken;
    console.log('Retrieved CSRF token:', csrfToken);
    return csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.response?.data || error.message);
    throw error;
  }
}

// Login as admin
async function loginAsAdmin() {
  try {
    // Get CSRF token first
    await getCsrfToken();
    
    console.log('Logging in as admin...');
    const loginResponse = await axios.post(
      `${API_URL}/auth/login`,
      {
        email: 'admin@shifi.com',
        password: 'admin123',
        userType: 'admin'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    // Save cookies from response
    if (loginResponse.headers['set-cookie']) {
      cookies = loginResponse.headers['set-cookie'];
      saveCookies();
    }
    
    console.log('Admin login successful:', loginResponse.data);
    return loginResponse.data;
  } catch (error) {
    console.error('Error logging in as admin:', error.response?.data || error.message);
    throw error;
  }
}

// Get all merchants
async function getAllMerchants() {
  try {
    console.log('Getting all merchants...');
    const response = await axios.get(
      `${API_URL}/admin/merchants`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    console.log('Retrieved merchants successfully');
    return response.data;
  } catch (error) {
    console.error('Error getting merchants:', error.response?.data || error.message);
    throw error;
  }
}

// Get merchant by ID
async function getMerchantById(id) {
  try {
    console.log(`Getting merchant with ID ${id}...`);
    const response = await axios.get(
      `${API_URL}/admin/merchants/${id}`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          Cookie: cookies.join('; ')
        }
      }
    );
    
    console.log(`Retrieved merchant ${id} successfully`);
    return response.data;
  } catch (error) {
    console.error(`Error getting merchant ${id}:`, error.response?.data || error.message);
    throw error;
  }
}

// Main function to run the tests
async function main() {
  try {
    // Load cookies (if they exist)
    loadCookies();
    
    // Login as admin
    await loginAsAdmin();
    
    // Get all merchants
    const merchantsData = await getAllMerchants();
    console.log('Merchants data:', JSON.stringify(merchantsData, null, 2));
    
    // If there are merchants, get the first one's details
    if (merchantsData.data && merchantsData.data.length > 0) {
      const firstMerchant = merchantsData.data[0];
      console.log(`Found merchant with ID ${firstMerchant.id}: ${firstMerchant.name}`);
      
      // Get detailed information about this merchant
      const merchantDetails = await getMerchantById(firstMerchant.id);
      console.log('Merchant details:', JSON.stringify(merchantDetails, null, 2));
    } else {
      console.log('No merchants found in the database');
    }
    
    console.log('Tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the main function
main();