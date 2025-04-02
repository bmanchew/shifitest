// Using dynamic imports with CommonJS syntax
const { eq } = require('drizzle-orm');

async function createTestConversation() {
  try {
    console.log('Loading dependencies dynamically...');
    
    // Dynamically import the modules to avoid import path issues
    const { db } = require('./server/db.js');
    const { conversations, contracts, messages } = require('./shared/schema.js');
    
    console.log('Creating test conversation for merchant ID 49...');
    
    // 1. Verify merchant exists and get contract IDs
    const merchantContracts = await db.select().from(contracts).where(eq(contracts.merchantId, 49));
    
    if (!merchantContracts || merchantContracts.length === 0) {
      console.error('No contracts found for merchant with ID 49');
      return;
    }
    
    console.log(`Found ${merchantContracts.length} contracts for merchant 49`);
    const activeContract = merchantContracts.find(c => c.status === 'active');
    
    if (!activeContract) {
      console.error('No active contract found for merchant with ID 49');
      return;
    }
    
    console.log(`Using active contract with ID ${activeContract.id}`);
    
    // 2. Create a test conversation
    const newConversation = await db.insert(conversations).values({
      topic: 'Test Conversation for Unread Count',
      contractId: activeContract.id,
      status: 'active',
      createdBy: 1, // Assuming admin user ID 1
      category: 'general',
      priority: 'normal',
      lastMessageAt: new Date()
    }).returning();
    
    if (!newConversation || newConversation.length === 0) {
      console.error('Failed to create conversation');
      return;
    }
    
    const conversationId = newConversation[0].id;
    console.log(`Created conversation with ID ${conversationId}`);
    
    // 3. Create a few test messages
    // Admin message
    await db.insert(messages).values({
      conversationId: conversationId,
      senderId: 1, // Admin user
      content: 'Hello merchant, this is a test message from admin',
      isRead: false,
      sentAt: new Date(Date.now() - 3600000) // 1 hour ago
    });
    
    // Another admin message
    await db.insert(messages).values({
      conversationId: conversationId,
      senderId: 1, // Admin user
      content: 'This is another test message that should be unread',
      isRead: false,
      sentAt: new Date(Date.now() - 1800000) // 30 minutes ago
    });
    
    // Merchant message (should not count as unread for merchant)
    await db.insert(messages).values({
      conversationId: conversationId,
      senderId: 49, // Merchant user id, assuming it's the same as merchant id
      content: 'This is a response from the merchant',
      isRead: true,
      sentAt: new Date(Date.now() - 900000) // 15 minutes ago
    });
    
    // One more admin message
    await db.insert(messages).values({
      conversationId: conversationId,
      senderId: 1, // Admin user
      content: 'Here is one more unread message for testing',
      isRead: false,
      sentAt: new Date() // Now
    });
    
    console.log('Created 4 test messages for the conversation');
    console.log('3 of them are from admin and should be counted as unread for the merchant');
    
    // 4. Double check the created data
    const updatedConversation = await db.select().from(conversations).where(eq(conversations.id, conversationId));
    const conversationMessages = await db.select().from(messages).where(eq(messages.conversationId, conversationId));
    
    console.log('Conversation data:', updatedConversation[0]);
    console.log(`Found ${conversationMessages.length} messages for the conversation`);
    
    console.log('Test data creation completed successfully!');
    
  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    process.exit(0);
  }
}

// Run the function
createTestConversation();