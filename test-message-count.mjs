// Directly test SQL query
import pg from 'pg';
const { Pool } = pg;

async function testUnreadMessageCount() {
  try {
    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('DATABASE_URL environment variable is not set');
      return;
    }

    // Create a PostgreSQL client
    const pool = new Pool({
      connectionString: databaseUrl,
    });
    
    // Connect to database
    const client = await pool.connect();
    console.log('Connected to database');
    
    try {
      // Test with a valid merchant ID from the database
      const merchantId = 49;
      console.log(`Testing unread message count for merchant ID: ${merchantId} (SHILOH FINANCE INC)`);
      
      // First get the merchant's user ID
      const merchantResult = await client.query(
        'SELECT user_id FROM merchants WHERE id = $1',
        [merchantId]
      );
      
      if (merchantResult.rows.length === 0 || !merchantResult.rows[0].user_id) {
        console.log(`No merchant found with ID ${merchantId} or missing userId`);
        return;
      }
      
      const userId = merchantResult.rows[0].user_id;
      console.log(`Found merchant with user ID: ${userId}`);
      
      // Execute the unread messages query
      // The conversations table doesn't have merchant_id column directly,
      // we need to join through contracts table which has merchant_id
      const result = await client.query(
        `SELECT COUNT(*) AS unread_count 
         FROM messages m
         JOIN conversations c ON m.conversation_id = c.id
         JOIN contracts ct ON c.contract_id = ct.id
         WHERE ct.merchant_id = $1
         AND m.is_read = false
         AND m.sender_id != $2`,
        [merchantId, userId]
      );
      
      // Extract the count from the result
      const unreadCount = result.rows[0]?.unread_count || 0;
      console.log(`Unread message count: ${unreadCount}`);
      
    } finally {
      // Release the client back to the pool
      client.release();
      console.log('Database connection released');
      
      // Close the pool
      await pool.end();
      console.log('Connection pool closed');
    }
  } catch (error) {
    console.error('Error testing unread count:', error);
    console.error(error.stack);
  }
}

testUnreadMessageCount();