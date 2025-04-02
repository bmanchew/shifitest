/**
 * Test script to verify CFPB complaint trends endpoint
 * This tests the changes made to standardize log categories
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set a flag to force a real CFPB API call
const FORCE_REAL_API_CALL = true;

// Base URL for API
const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to load cookies
function loadCookies() {
  try {
    const cookiesPath = path.join(process.cwd(), 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      const cookieContent = fs.readFileSync(cookiesPath, 'utf8');
      return cookieContent;
    }
    return '';
  } catch (error) {
    console.error('Error loading cookies:', error.message);
    return '';
  }
}

// Helper function to get CSRF token
async function getCsrfToken() {
  try {
    const response = await axios.get(`${API_BASE_URL}/csrf-token`);
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    throw error;
  }
}

// Helper function to login as admin
async function loginAsAdmin() {
  try {
    const csrfToken = await getCsrfToken();
    console.log('Retrieved CSRF token:', csrfToken);

    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      {
        email: 'admin@shifi.com',
        password: 'admin123',
        userType: 'admin'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Admin login successful:', response.data);
    return response;
  } catch (error) {
    console.error('Error logging in as admin:', error.message);
    throw error;
  }
}

// Test the CFPB complaint trends endpoint
async function testCfpbComplaintTrends() {
  try {
    // First login to get authentication cookies
    await loginAsAdmin();
    
    // Get cookies for subsequent requests
    const cookies = loadCookies();
    
    console.log('Testing CFPB complaint trends endpoint...');
    // Add query parameters to force a real API call and enable debug logging
    console.log('Forcing real API call to test log categories...');
    
    // Make the request with responseType: 'text' to see the raw response
    const response = await axios.get(`${API_BASE_URL}/admin/reports/complaint-trends?force_real=true&debug=true`, {
      headers: {
        Cookie: cookies,
        'Accept': 'application/json'
      },
      responseType: 'text'
    });
    
    console.log('Response headers:', response.headers);
    
    // Check if response is HTML
    const isHtmlResponse = response.data && typeof response.data === 'string' && 
                          (response.data.includes('<!DOCTYPE html>') || response.data.includes('<html'));
    
    console.log('Content type:', response.headers['content-type']);
    console.log('Is HTML response:', isHtmlResponse);
    
    let parsedData;
    try {
      // Try to parse the response as JSON
      parsedData = JSON.parse(response.data);
      console.log('Successfully parsed response as JSON');
    } catch (e) {
      console.log('Failed to parse response as JSON:', e.message);
      // Show first 500 chars of response
      console.log('Response data starts with:', response.data.substring(0, 500) + '...');
      parsedData = { success: false, error: 'Invalid JSON response' };
    }
    
    // Print a more complete version of the response data
    const responseData = {
      success: parsedData.success,
      dataExists: !!parsedData.data,
      isMockData: parsedData.isMockData || false,
      error: parsedData.error || parsedData.data?.error,
      status: response.status,
      contentType: response.headers['content-type'],
      isHtmlResponse: isHtmlResponse,
      personalLoans: parsedData.data?.personalLoans ? {
        total: parsedData.data?.personalLoans?.hits?.total || 0,
        hasData: !!parsedData.data?.personalLoans?.hits?.total
      } : null,
      merchantCashAdvance: parsedData.data?.merchantCashAdvance ? {
        total: parsedData.data?.merchantCashAdvance?.hits?.total || 0,
        hasData: !!parsedData.data?.merchantCashAdvance?.hits?.total
      } : null
    };
    
    console.log('CFPB complaint trends response details:', JSON.stringify(responseData, null, 2));
    
    // Also show full response if it's not too large and is JSON
    if (!isHtmlResponse && parsedData && JSON.stringify(parsedData).length < 2000) {
      console.log('Full response data:', JSON.stringify(parsedData, null, 2));
    } else {
      console.log('Full response is too large to display or is not JSON')
    }
    return parsedData;
  } catch (error) {
    console.error('Error testing CFPB complaint trends:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      // Only show response data if it's not too large
      if (typeof error.response.data === 'string' && error.response.data.length < 500) {
        console.error('Response data:', error.response.data);
      } else {
        console.error('Response data is too large to display');
      }
    }
    throw error;
  }
}

// Main function to run all tests
async function runTests() {
  try {
    await testCfpbComplaintTrends();
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Tests failed:', error.message);
  }
}

// Run the tests
runTests();