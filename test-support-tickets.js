/**
 * Test script for the support tickets API
 * This script logs in as Brandon (merchant) and accesses the support tickets endpoints
 * to verify the middleware fixes
 */

import fetch from 'node-fetch';
import fs from 'fs';

// Configuration
const API_BASE_URL = 'https://1825e65f-101b-467b-bee7-c29733668cc0-00-9psqa3aypt1d.janeway.replit.dev/api';
const cookiesFile = './brandon-cookies.txt';

// Function to load cookies from file
function loadCookies() {
  try {
    return fs.readFileSync(cookiesFile, 'utf8');
  } catch (error) {
    return '';
  }
}

// Function to save cookies to file
function saveCookies(cookieString) {
  fs.writeFileSync(cookiesFile, cookieString);
  console.log('Cookies saved to', cookiesFile);
}

// Function to extract CSRF token from cookies
function extractCsrfToken(cookies) {
  const match = cookies.match(/XSRF-TOKEN=([^;]+)/);
  return match ? match[1] : null;
}

// Login as Brandon (merchant user)
async function login() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'brandon@shilohfinance.com',
        password: 'Password123!'
      })
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    // Get and save cookies
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      saveCookies(cookies);
    }

    const data = await response.json();
    console.log('Login successful:', data);
    
    return { cookies, csrfToken: extractCsrfToken(cookies) };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Get current merchant data
async function getCurrentMerchant(cookies, csrfToken) {
  try {
    console.log('Getting current merchant data...');
    const response = await fetch(`${API_BASE_URL}/current-merchant`, {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'X-XSRF-TOKEN': csrfToken
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Get current merchant failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    console.log('Current merchant data:', data);
    return data;
  } catch (error) {
    console.error('Get current merchant error:', error);
    throw error;
  }
}

// Get support tickets
async function getSupportTickets(cookies, csrfToken) {
  try {
    console.log('Getting support tickets...');
    const response = await fetch(`${API_BASE_URL}/support-tickets`, {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'X-XSRF-TOKEN': csrfToken
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Get support tickets failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    console.log('Support tickets retrieved:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Get support tickets error:', error);
    throw error;
  }
}

// Create a support ticket (for testing)
async function createSupportTicket(cookies, csrfToken, merchantId) {
  try {
    console.log('Creating a test support ticket...');
    const response = await fetch(`${API_BASE_URL}/support-tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'X-XSRF-TOKEN': csrfToken
      },
      body: JSON.stringify({
        merchantId: merchantId,
        subject: 'Test Support Ticket',
        description: 'This is a test ticket created by the automated test script',
        category: 'technical_issue',
        priority: 'normal'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Create support ticket failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    console.log('Support ticket created:', data);
    return data;
  } catch (error) {
    console.error('Create support ticket error:', error);
    throw error;
  }
}

// Get ticket by ID
async function getTicketById(cookies, csrfToken, ticketId) {
  try {
    console.log(`Getting support ticket with ID ${ticketId}...`);
    const response = await fetch(`${API_BASE_URL}/support-tickets/${ticketId}`, {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'X-XSRF-TOKEN': csrfToken
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Get ticket by ID failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    console.log('Support ticket details:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Get ticket by ID error:', error);
    throw error;
  }
}

// Add a message to a ticket
async function addMessageToTicket(cookies, csrfToken, ticketId) {
  try {
    console.log(`Adding test message to ticket with ID ${ticketId}...`);
    const response = await fetch(`${API_BASE_URL}/support-tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'X-XSRF-TOKEN': csrfToken
      },
      body: JSON.stringify({
        content: 'This is a test message from the automated test script',
        senderRole: 'merchant',
        senderId: 2
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Add message to ticket failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    console.log('Message added to ticket:', data);
    return data;
  } catch (error) {
    console.error('Add message to ticket error:', error);
    throw error;
  }
}

// Get ticket messages
async function getTicketMessages(cookies, csrfToken, ticketId) {
  try {
    console.log(`Getting messages for ticket with ID ${ticketId}...`);
    const response = await fetch(`${API_BASE_URL}/support-tickets/${ticketId}/messages`, {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'X-XSRF-TOKEN': csrfToken
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Get ticket messages failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    console.log('Ticket messages:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Get ticket messages error:', error);
    throw error;
  }
}

// Main test function
async function runTests() {
  let cookies = loadCookies();
  let csrfToken = extractCsrfToken(cookies);
  
  try {
    // Login if no cookies or csrf token
    if (!cookies || !csrfToken) {
      const loginResult = await login();
      cookies = loginResult.cookies;
      csrfToken = loginResult.csrfToken;
    }

    // Get current merchant
    const merchantData = await getCurrentMerchant(cookies, csrfToken);
    
    // Verify we have merchant data
    if (!merchantData.success || !merchantData.data || !merchantData.data.id) {
      throw new Error('Failed to get merchant data');
    }
    
    const merchantId = merchantData.data.id;
    console.log(`Using merchant ID: ${merchantId}`);

    // Get support tickets
    const tickets = await getSupportTickets(cookies, csrfToken);

    // Create a ticket if none exist
    let testTicketId;
    if (tickets.success && tickets.tickets && tickets.tickets.length > 0) {
      testTicketId = tickets.tickets[0].id;
      console.log(`Using existing ticket: ${testTicketId}`);
    } else {
      const newTicket = await createSupportTicket(cookies, csrfToken, merchantId);
      testTicketId = newTicket.ticket.id;
      console.log(`Created new test ticket: ${testTicketId}`);
    }

    // Test getting ticket by ID
    await getTicketById(cookies, csrfToken, testTicketId);
    
    // Test adding message to ticket
    await addMessageToTicket(cookies, csrfToken, testTicketId);
    
    // Test getting ticket messages
    await getTicketMessages(cookies, csrfToken, testTicketId);
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

// Run the tests
runTests();