/**
 * Test script to verify the mock CFPB API functionality
 * This tests using mock data from our new implementation
 */

import axios from 'axios';
import fs from 'fs';

// Create a reusable axios instance
const api = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Function to load cookies from file
function loadCookies() {
  try {
    if (fs.existsSync('./cookies.txt')) {
      return JSON.parse(fs.readFileSync('./cookies.txt', 'utf8'));
    }
  } catch (err) {
    console.error('Error loading cookies:', err.message);
  }
  return '';
}

// Function to save cookies to file
function saveCookies(cookieString) {
  try {
    fs.writeFileSync('./cookies.txt', JSON.stringify(cookieString));
  } catch (err) {
    console.error('Error saving cookies:', err.message);
  }
}

// Function to get a CSRF token
async function getCsrfToken() {
  try {
    const response = await api.get('/api/csrf-token');
    return response.data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error.message);
    throw error;
  }
}

// Function to login as admin
async function loginAsAdmin() {
  try {
    console.log('Logging in as admin...');
    
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    console.log('Got CSRF token:', csrfToken);
    
    // Login as admin
    const response = await api.post('/api/auth/login', {
      email: 'admin@shifi.com',
      password: 'admin123'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    console.log('Login successful:', response.data.success);
    
    // Save cookies
    if (response.headers['set-cookie']) {
      saveCookies(response.headers['set-cookie'].join('; '));
    }
    
    return true;
  } catch (error) {
    console.error('Error logging in as admin:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Make a request to the complaint trends API with mock mode
 */
async function testComplaintTrendsWithMock() {
  try {
    console.log('Testing complaint trends API with mock=true...');
    
    // Load cookies for authentication
    const cookies = loadCookies();
    
    // Make request with cookies
    const response = await api.get('/api/admin/reports/complaint-trends?mock=true', {
      headers: {
        'Cookie': cookies
      }
    });
    
    console.log('Successfully fetched mock complaint trends data');
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(response.headers));
    console.log('Data structure:', Object.keys(response.data));
    
    if (response.data && response.data.data) {
      console.log('Product categories:');
      Object.keys(response.data.data).forEach(product => {
        console.log(` - ${product}: ${response.data.data[product].totalComplaints} complaints`);
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching mock complaint trends data:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Make a request to the CFPB trends analysis API with mock mode
 */
async function testCfpbTrendsAnalysisWithMock() {
  try {
    console.log('\nTesting CFPB trends analysis API with mock=true...');
    
    // Load cookies for authentication
    const cookies = loadCookies();
    
    // Make request with cookies
    const response = await api.get('/api/admin/reports/cfpb-trends?mock=true', {
      headers: {
        'Cookie': cookies
      }
    });
    
    console.log('Successfully fetched mock CFPB trends analysis data');
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(response.headers));
    console.log('Data structure:', Object.keys(response.data));
    
    if (response.data && response.data.data && response.data.data.trendsAnalysis) {
      console.log('Analysis summary:', response.data.data.trendsAnalysis.summary);
      console.log('First insight:', response.data.data.trendsAnalysis.insights[0]);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching mock CFPB trends analysis data:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Make a request to the portfolio health API
 */
async function testPortfolioHealthApi() {
  try {
    console.log('\nTesting portfolio health API...');
    
    // Load cookies for authentication
    const cookies = loadCookies();
    
    // Make request with cookies
    const response = await api.get('/api/admin/reports/portfolio-health', {
      headers: {
        'Cookie': cookies,
        'Accept': 'application/json'
      }
    });
    
    console.log('Successfully fetched portfolio health data');
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(response.headers));
    console.log('Data structure:', Object.keys(response.data));
    
    if (response.data) {
      console.log('Total Contracts:', response.data.totalContracts);
      console.log('Average APR:', response.data.avgAPR);
      console.log('Delinquency Rate:', response.data.delinquencyRate + '%');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching portfolio health data:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Test all endpoints with direct=true parameter which explicitly sets content type
 */
async function testEndpointsWithDirectParam() {
  try {
    console.log('\nTesting all endpoints with direct=true...');
    
    // Load cookies for authentication
    const cookies = loadCookies();
    
    // Test complaint trends with direct=true to force content-type setting
    const trendResponse = await api.get('/api/admin/reports/complaint-trends?direct=true', {
      headers: {
        'Cookie': cookies,
        'Accept': 'application/json'
      }
    });
    
    console.log('Direct complaint trends test: Success');
    console.log('Content-Type header:', trendResponse.headers['content-type']);
    console.log('Custom headers:', {
      'X-Content-Type-Workaround': trendResponse.headers['x-content-type-workaround'],
      'X-Mock-Data': trendResponse.headers['x-mock-data']
    });
    
    // Test CFPB trends with direct=true
    const analysisResponse = await api.get('/api/admin/reports/cfpb-trends?direct=true', {
      headers: {
        'Cookie': cookies,
        'Accept': 'application/json'
      }
    });
    
    console.log('Direct CFPB trends analysis test: Success');
    console.log('Content-Type header:', analysisResponse.headers['content-type']);
    
    return {
      trendResponse: trendResponse.data,
      analysisResponse: analysisResponse.data
    };
  } catch (error) {
    console.error('Error in direct parameter test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    // Login first
    await loginAsAdmin();
    
    // Run the basic mock tests
    console.log('\n========== TESTING MOCK DATA ==========');
    await testComplaintTrendsWithMock();
    await testCfpbTrendsAnalysisWithMock();
    
    // Run portfolio health test
    console.log('\n========== TESTING PORTFOLIO HEALTH ==========');
    await testPortfolioHealthApi();
    
    // Run tests with direct parameter
    console.log('\n========== TESTING DIRECT PARAMETER ==========');
    await testEndpointsWithDirectParam();
    
    console.log('\n========== ALL TESTS COMPLETED SUCCESSFULLY ==========');
  } catch (error) {
    console.error('\nTests failed:', error.message);
  }
}

// Run the tests
runTests();