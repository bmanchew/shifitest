/**
 * Test script to verify the ticket system's functionality
 * This script uses CommonJS module syntax (.cjs extension)
 */

const axios = require('axios');
const tough = require('tough-cookie');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;

// Create cookie jars
const merchantCookieJar = new tough.CookieJar();
const brandosCookieJar = new tough.CookieJar();

// Create axios instances with cookie jar support
const merchantApi = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
  jar: merchantCookieJar
});
axiosCookieJarSupport(merchantApi);

const brandosApi = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
  jar: brandosCookieJar
});
axiosCookieJarSupport(brandosApi);

// Test merchant credentials
const MERCHANT_EMAIL = 'test-merchant@example.com';
const MERCHANT_PASSWORD = 'password123';

// Brandon's credentials (merchant ID 49)
const BRANDON_EMAIL = 'brandon@shilohfinance.com';
const BRANDON_PASSWORD = 'password123';

async function testTicketSystemFlow() {
  console.log('=== Testing Ticket System Flow ===');
  
  try {
    // 1. Login as brandon@shilohfinance.com (merchant ID 49)
    console.log('\n--- Step 1: Login as brandon@shilohfinance.com ---');
    const brandonCsrfResponse = await brandosApi.get('/api/csrf-token');
    const brandonCsrfToken = brandonCsrfResponse.data.csrfToken;
    
    const brandonLoginResponse = await brandosApi.post('/api/auth/login', {
      email: BRANDON_EMAIL,
      password: BRANDON_PASSWORD
    }, {
      headers: {
        'X-CSRF-Token': brandonCsrfToken
      }
    });
    
    console.log('Brandon login status:', brandonLoginResponse.data.success ? 'Success' : 'Failed');
    
    // 2. Get Brandon's merchant profile
    console.log('\n--- Step 2: Get Brandon\'s Merchant Profile ---');
    const brandonMerchantResponse = await brandosApi.get('/api/current-merchant');
    const brandonMerchant = brandonMerchantResponse.data.merchant;
    
    console.log(`Logged in as Brandon (Merchant ID: ${brandonMerchant.id})`);
    
    // 3. Fetch Brandon's contracts
    console.log('\n--- Step 3: Fetch Brandon\'s Contracts ---');
    const brandonContractsResponse = await brandosApi.get(`/api/contracts?merchantId=${brandonMerchant.id}`);
    
    let brandonContracts;
    if (Array.isArray(brandonContractsResponse.data)) {
      brandonContracts = brandonContractsResponse.data;
      console.log('Response is a direct array of contracts');
    } else if (brandonContractsResponse.data.success && Array.isArray(brandonContractsResponse.data.contracts)) {
      brandonContracts = brandonContractsResponse.data.contracts;
      console.log('Response is an object with success and contracts properties');
    } else {
      console.log('Unexpected response format:', brandonContractsResponse.data);
      brandonContracts = [];
    }
    
    console.log(`Found ${brandonContracts.length} contracts for Brandon (Merchant ID ${brandonMerchant.id})`);
    
    // 4. Create a ticket with Brandon's merchant ID
    console.log('\n--- Step 4: Create Ticket for Brandon ---');
    const contractId = brandonContracts.length > 0 ? brandonContracts[0].id : null;
    
    const ticketData = {
      subject: 'Test Ticket for Brandon',
      category: 'technical_issue',
      priority: 'normal',
      description: 'This is a test ticket for Brandon to verify the ticket system is working correctly.',
      merchantId: brandonMerchant.id,
      contractId: contractId,
      createdBy: brandonMerchant.userId || 2 // Use fallback user ID if not available
    };
    
    try {
      const ticketResponse = await brandosApi.post('/api/communications/tickets', ticketData);
      console.log('✅ Successfully created ticket for Brandon');
      console.log(`Ticket ID: ${ticketResponse.data.id}, Number: ${ticketResponse.data.ticketNumber}`);
      
      // Store ticket info for later
      const ticketId = ticketResponse.data.id;
      const ticketNumber = ticketResponse.data.ticketNumber;
      
      // 5. Verify Brandon can see the ticket
      console.log('\n--- Step 5: Verify Brandon Can See The Ticket ---');
      const brandonTicketsResponse = await brandosApi.get('/api/communications/tickets');
      const brandonTickets = brandonTicketsResponse.data.tickets;
      
      const foundTicket = brandonTickets.find(t => t.id === ticketId);
      if (foundTicket) {
        console.log('✅ Brandon can see the created ticket');
      } else {
        console.log('❌ Brandon cannot see the created ticket');
        console.log('Available tickets:', JSON.stringify(brandonTickets.map(t => ({ id: t.id, number: t.ticketNumber }))));
      }
      
      // 6. Test marking messages as read
      console.log('\n--- Step 6: Test Marking Messages as Read ---');
      
      // First, add a message to the ticket
      const messageResponse = await brandosApi.post(`/api/communications/tickets/${ticketId}/messages`, {
        content: 'Test message from Brandon'
      });
      
      console.log('Added message to ticket:', messageResponse.data.success ? 'Success' : 'Failed');
      
      // Get messages for the ticket
      const messagesResponse = await brandosApi.get(`/api/communications/tickets/${ticketId}/messages`);
      const messages = messagesResponse.data.messages;
      
      console.log(`Found ${messages.length} messages in the ticket`);
      
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        
        // Mark the message as read using both endpoints
        try {
          const directMarkReadResponse = await brandosApi.post(`/api/communications/messages/${lastMessage.id}/read`);
          console.log('✅ Successfully marked message as read using direct endpoint');
        } catch (error) {
          console.log('❌ Failed to mark message as read using direct endpoint');
          console.error('Error:', error.response?.data || error.message);
        }
        
        try {
          const conversationMarkReadResponse = await brandosApi.patch(
            `/api/communications/${ticketId}/messages/${lastMessage.id}/read`
          );
          console.log('✅ Successfully marked message as read using conversation endpoint');
        } catch (error) {
          console.log('❌ Failed to mark message as read using conversation endpoint');
          console.error('Error:', error.response?.data || error.message);
        }
      }
      
      console.log('\n=== Ticket System Test Completed Successfully ===');
      
    } catch (error) {
      console.log('❌ Failed to create ticket for Brandon');
      console.error('Error:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testTicketSystemFlow()
  .then(() => {
    console.log('Ticket system test completed');
  })
  .catch(err => {
    console.error('Ticket system test failed:', err);
  });