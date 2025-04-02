// Import the storage module using CommonJS
const { Storage } = require('./server/storage');

async function testUnreadCount() {
  try {
    const storage = new Storage();
    
    // Test with a known merchant ID (replace with a valid ID from your database)
    const merchantId = 1;
    console.log(`Testing unread message count for merchant ID: ${merchantId}`);
    
    const unreadCount = await storage.getUnreadMessageCountForMerchant(merchantId);
    console.log(`Unread message count: ${unreadCount}`);
    
    // Test with another merchant ID
    const secondMerchantId = 2;
    console.log(`Testing unread message count for merchant ID: ${secondMerchantId}`);
    
    const secondUnreadCount = await storage.getUnreadMessageCountForMerchant(secondMerchantId);
    console.log(`Unread message count: ${secondUnreadCount}`);
  } catch (error) {
    console.error('Error testing unread count:', error);
    console.error(error.stack);
  }
}

testUnreadCount();