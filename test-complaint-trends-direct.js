/**
 * Direct test for the complaint trends endpoint using Node's HTTP module
 * This bypasses libraries like axios to see exactly what's happening at the HTTP level
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const HOST = 'localhost';
const PORT = 5000;
const PATH = '/api/admin/reports/complaint-trends?force_real=true&debug=true&direct=true';

// Function to load cookies from file
function loadCookies() {
  try {
    const cookiesPath = path.join(process.cwd(), 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      return fs.readFileSync(cookiesPath, 'utf8');
    }
    return '';
  } catch (error) {
    console.error('Error loading cookies:', error.message);
    return '';
  }
}

// Function to make a direct HTTP request
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers, null, 2)}`);
      
      const chunks = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        const bodyString = bodyBuffer.toString();
        
        console.log(`BODY length: ${bodyString.length} bytes`);
        
        // Check content type
        const contentType = res.headers['content-type'] || '';
        console.log(`Content-Type: ${contentType}`);
        
        // Determine if it's HTML or JSON
        const isHtml = bodyString.trim().startsWith('<!DOCTYPE') || bodyString.trim().startsWith('<html');
        console.log(`Is HTML response: ${isHtml}`);
        
        let jsonData = null;
        if (!isHtml) {
          try {
            jsonData = JSON.parse(bodyString);
            console.log('Successfully parsed as JSON:');
            console.log(JSON.stringify(jsonData, null, 2));
          } catch (e) {
            console.log(`Failed to parse as JSON: ${e.message}`);
            // Show beginning of response
            console.log('Response begins with:');
            console.log(bodyString.substring(0, 200) + '...');
          }
        } else {
          // It's HTML, show the first part
          console.log('HTML response begins with:');
          console.log(bodyString.substring(0, 200) + '...');
        }
        
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: bodyString,
          jsonData
        });
      });
    });
    
    req.on('error', (e) => {
      console.error(`Request error: ${e.message}`);
      reject(e);
    });
    
    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

// Get a CSRF token
async function getCsrfToken() {
  console.log('Getting CSRF token...');
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/csrf-token',
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };
  
  const response = await makeRequest(options);
  
  if (response.jsonData && response.jsonData.csrfToken) {
    console.log(`Retrieved CSRF token: ${response.jsonData.csrfToken}`);
    return response.jsonData.csrfToken;
  } else {
    throw new Error('Failed to get CSRF token');
  }
}

// Log in as admin
async function loginAsAdmin(csrfToken) {
  console.log('Logging in as admin...');
  
  const loginData = JSON.stringify({
    email: 'admin@shifi.com',
    password: 'admin123',
    userType: 'admin'
  });
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length,
      'X-CSRF-Token': csrfToken
    }
  };
  
  const response = await makeRequest(options, loginData);
  
  if (response.statusCode === 200) {
    console.log('Admin login successful!');
    
    // Save cookies if present
    if (response.headers['set-cookie']) {
      const cookies = response.headers['set-cookie'];
      console.log('Received cookies:', cookies);
      
      // Save the cookies to file
      fs.writeFileSync('cookies.txt', cookies.join('; '), 'utf8');
      console.log('Saved cookies to cookies.txt');
    }
    
    return true;
  } else {
    throw new Error(`Login failed with status ${response.statusCode}`);
  }
}

// Test the complaint trends API
async function testComplaintTrendsApi() {
  console.log('Testing complaint trends API...');
  
  // Load cookies for authentication
  const cookies = loadCookies();
  console.log('Using cookies:', cookies);
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: PATH,
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Content-Type-Enforce': 'application/json',
      'X-Direct-Test': 'true',
      'Cookie': cookies
    }
  };
  
  const response = await makeRequest(options);
  
  return response;
}

// Main function
async function main() {
  try {
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    
    // Login
    await loginAsAdmin(csrfToken);
    
    // Test API
    await testComplaintTrendsApi();
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run main function
main();