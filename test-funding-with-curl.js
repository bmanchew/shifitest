/**
 * Test script for merchant funding routes using curl
 * This should handle CSRF tokens more reliably
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);
const BASE_URL = 'http://localhost:5000';
const COOKIE_FILE = './admin-curl-cookies.txt';

// Helper function to run curl commands
async function curl(cmd) {
  try {
    const { stdout, stderr } = await execAsync(cmd);
    if (stderr && !stderr.includes('warning')) {
      console.error('Curl stderr:', stderr);
    }
    return stdout;
  } catch (error) {
    console.error('Curl error:', error.message);
    if (error.stdout) {
      return error.stdout; // Sometimes curl returns error code but has output
    }
    throw error;
  }
}

// Login as admin
async function login() {
  console.log('Logging in as admin...');
  
  const cmd = `curl -s -c ${COOKIE_FILE} -H "Content-Type: application/json" -d '{"email":"admin@shifi.com","password":"password123"}' ${BASE_URL}/api/auth/login`;
  
  const response = await curl(cmd);
  const data = JSON.parse(response);
  
  if (data.success) {
    console.log('Login successful!');
    return true;
  } else {
    console.error('Login failed:', data.message);
    return false;
  }
}

// Get CSRF token
async function getCsrfToken() {
  console.log('Getting CSRF token...');
  
  const cmd = `curl -s -b ${COOKIE_FILE} -c ${COOKIE_FILE} ${BASE_URL}/api/csrf-token`;
  
  const response = await curl(cmd);
  const data = JSON.parse(response);
  
  if (data.csrfToken) {
    console.log('CSRF token retrieved successfully');
    return data.csrfToken;
  } else {
    console.error('Failed to get CSRF token');
    return null;
  }
}

// Get merchant funding settings
async function getMerchantFundingSettings(merchantId) {
  console.log(`\nGetting funding settings for merchant ${merchantId}...`);
  
  const cmd = `curl -s -b ${COOKIE_FILE} ${BASE_URL}/api/admin/merchant-funding/${merchantId}`;
  
  const response = await curl(cmd);
  const data = JSON.parse(response);
  
  if (data.success) {
    console.log('Merchant funding settings:');
    console.log(JSON.stringify(data, null, 2));
    return data.fundingSettings;
  } else {
    console.error('Failed to get funding settings:', data.message);
    return null;
  }
}

// Toggle ShiFi funding
async function toggleShifiFunding(merchantId, enabled, csrfToken) {
  console.log(`\nToggling ShiFi funding for merchant ${merchantId} to ${enabled ? 'enabled' : 'disabled'}...`);
  
  const cmd = `curl -s -b ${COOKIE_FILE} -c ${COOKIE_FILE} -H "Content-Type: application/json" -H "X-XSRF-TOKEN: ${csrfToken}" -d '{"enabled":${enabled}}' ${BASE_URL}/api/admin/merchant-funding/${merchantId}/shifi`;
  
  const response = await curl(cmd);
  const data = JSON.parse(response);
  
  if (data.success) {
    console.log('ShiFi funding updated successfully:');
    console.log(JSON.stringify(data, null, 2));
    return true;
  } else {
    console.error('Failed to update ShiFi funding:', data.message);
    return false;
  }
}

// Toggle CoveredCare funding
async function toggleCoveredCareFunding(merchantId, enabled, csrfToken) {
  console.log(`\nToggling CoveredCare funding for merchant ${merchantId} to ${enabled ? 'enabled' : 'disabled'}...`);
  
  const cmd = `curl -s -b ${COOKIE_FILE} -c ${COOKIE_FILE} -H "Content-Type: application/json" -H "X-XSRF-TOKEN: ${csrfToken}" -d '{"enabled":${enabled}}' ${BASE_URL}/api/admin/merchant-funding/${merchantId}/covered-care`;
  
  const response = await curl(cmd);
  const data = JSON.parse(response);
  
  if (data.success) {
    console.log('CoveredCare funding updated successfully:');
    console.log(JSON.stringify(data, null, 2));
    return true;
  } else {
    console.error('Failed to update CoveredCare funding:', data.message);
    return false;
  }
}

// Main test function
async function runTests() {
  try {
    // Clean up any existing cookie file
    if (fs.existsSync(COOKIE_FILE)) {
      fs.unlinkSync(COOKIE_FILE);
    }
    
    // Login
    const loginSuccess = await login();
    if (!loginSuccess) {
      console.error('Login failed. Exiting...');
      return;
    }
    
    // Select merchant for testing
    const merchantId = 49; // SHILOH FINANCE INC
    
    // Get initial settings
    const initialSettings = await getMerchantFundingSettings(merchantId);
    if (!initialSettings) {
      console.error('Failed to get initial settings. Exiting...');
      return;
    }
    
    // Get a fresh CSRF token
    let csrfToken = await getCsrfToken();
    if (!csrfToken) {
      console.error('Failed to get CSRF token. Exiting...');
      return;
    }
    
    // Toggle ShiFi funding OFF
    await toggleShifiFunding(merchantId, false, csrfToken);
    
    // Get a fresh CSRF token
    csrfToken = await getCsrfToken();
    
    // Toggle CoveredCare funding ON
    await toggleCoveredCareFunding(merchantId, true, csrfToken);
    
    // Get mid-test settings
    const midSettings = await getMerchantFundingSettings(merchantId);
    
    // Get a fresh CSRF token
    csrfToken = await getCsrfToken();
    
    // Toggle ShiFi funding back ON
    await toggleShifiFunding(merchantId, true, csrfToken);
    
    // Get a fresh CSRF token
    csrfToken = await getCsrfToken();
    
    // Toggle CoveredCare funding back OFF
    await toggleCoveredCareFunding(merchantId, false, csrfToken);
    
    // Get final settings
    const finalSettings = await getMerchantFundingSettings(merchantId);
    
    // Print test results
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