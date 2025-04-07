/**
 * Test script for validating the support ticket message endpoints
 * 
 * This script tests:
 * 1. Login as a merchant
 * 2. Access the tickets endpoint
 * 3. Access ticket messages for a specific ticket
 * 4. Add a message to a ticket
 */

import axios from 'axios';
import fs from 'fs';

const BASE_URL = 'http://localhost:5000';
const cookiesFile = './merchant-cookies.txt';

// Test config - Brandon is merchant ID 49
const MERCHANT_EMAIL = 'brandon@shilohfinance.com';
const MERCHANT_PASSWORD = 'Password123!'; // Reset using reset-brandon-password.js

function loadCookies() {
  try {
    if (fs.existsSync(cookiesFile)) {
      return fs.readFileSync(cookiesFile, 'utf8');
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
  return '';
}

function saveCookies(cookieString) {
  try {
    fs.writeFileSync(cookiesFile, cookieString);
    console.log('Cookies saved');
  } catch (error) {
    console.error('Error saving cookies:', error);
  }
}

function extractCsrfToken(cookies) {
  const match = cookies.match(/XSRF-TOKEN=([^;]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

async function getCsrfToken() {
  try {
    const response = await axios.get(`${BASE_URL}/api/csrf-token`);
    const cookies = response.headers['set-cookie'].join('; ');
    saveCookies(cookies);
    const csrfToken = extractCsrfToken(cookies);
    console.log('CSRF Token:', csrfToken);
    return csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    throw error;
  }
}

async function login() {
  try {
    const csrfToken = await getCsrfToken();
    const cookies = loadCookies();
    
    console.log('Logging in as merchant...');
    
    const response = await axios.post(
      `${BASE_URL}/api/auth/login`,
      {
        email: MERCHANT_EMAIL,
        password: MERCHANT_PASSWORD
      },
      {
        headers: {
          'Cookie': cookies,
          'X-XSRF-TOKEN': csrfToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.headers['set-cookie']) {
      saveCookies(response.headers['set-cookie'].join('; '));
    }
    
    console.log('Login successful:', response.data.success);
    return true;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    return false;
  }
}

async function getTickets() {
  try {
    const cookies = loadCookies();
    const csrfToken = extractCsrfToken(cookies);
    
    console.log('Fetching tickets...');
    
    const response = await axios.get(
      `${BASE_URL}/api/support-tickets`,
      {
        headers: {
          'Cookie': cookies,
          'X-XSRF-TOKEN': csrfToken
        }
      }
    );
    
    console.log('Tickets fetched successfully');
    console.log(`Found ${response.data.tickets.length} tickets`);
    
    // Return the tickets array
    return response.data.tickets;
  } catch (error) {
    console.error('Error fetching tickets:', error.response?.data || error.message);
    return [];
  }
}

async function getTicketMessages(ticketId) {
  try {
    const cookies = loadCookies();
    const csrfToken = extractCsrfToken(cookies);
    
    console.log(`Fetching messages for ticket ${ticketId}...`);
    
    const response = await axios.get(
      `${BASE_URL}/api/support-tickets/${ticketId}/messages`,
      {
        headers: {
          'Cookie': cookies,
          'X-XSRF-TOKEN': csrfToken
        }
      }
    );
    
    console.log('Messages fetched successfully');
    console.log(`Found ${response.data.length} messages`);
    
    // Print message details
    if (response.data.length > 0) {
      console.log('Message sample:');
      console.log(JSON.stringify(response.data[0], null, 2));
    } else {
      console.log('No messages found for this ticket');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching ticket messages:', error.response?.data || error.message);
    return [];
  }
}

async function addMessageToTicket(ticketId, message) {
  try {
    const cookies = loadCookies();
    const csrfToken = extractCsrfToken(cookies);
    
    console.log(`Adding message to ticket ${ticketId}...`);
    
    const response = await axios.post(
      `${BASE_URL}/api/support-tickets/${ticketId}/messages`,
      {
        content: message,
        senderType: "merchant"
      },
      {
        headers: {
          'Cookie': cookies,
          'X-XSRF-TOKEN': csrfToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Message added successfully');
    console.log('New message:', response.data.message);
    
    return response.data.message;
  } catch (error) {
    console.error('Error adding message to ticket:', error.response?.data || error.message);
    return null;
  }
}

async function runTests() {
  // Login
  const loggedIn = await login();
  if (!loggedIn) {
    console.error('Login failed, cannot continue tests');
    return;
  }
  
  // Get tickets
  const tickets = await getTickets();
  if (tickets.length === 0) {
    console.error('No tickets found, cannot continue tests');
    return;
  }
  
  // Select the first ticket for testing
  const testTicket = tickets[0];
  console.log('Selected test ticket:', {
    id: testTicket.id,
    subject: testTicket.subject,
    status: testTicket.status
  });
  
  // Get messages for the selected ticket
  const messages = await getTicketMessages(testTicket.id);
  
  // Add a test message to the ticket
  const testMessage = `Test message created at ${new Date().toISOString()}`;
  const newMessage = await addMessageToTicket(testTicket.id, testMessage);
  
  if (newMessage) {
    console.log('Message added successfully');
    
    // Fetch messages again to verify the new message is there
    const updatedMessages = await getTicketMessages(testTicket.id);
    console.log(`Original message count: ${messages.length}, New message count: ${updatedMessages.length}`);
    
    if (updatedMessages.length > messages.length) {
      console.log('✅ Test passed: Message count increased after adding a new message');
    } else {
      console.log('❌ Test failed: Message count did not increase after adding a new message');
    }
  }
}

// Run the tests
runTests();