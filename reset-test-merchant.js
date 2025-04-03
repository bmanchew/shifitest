/**
 * This script resets the password for our test merchant user
 */
import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;

// Create a connection pool to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function resetMerchantPassword() {
  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    try {
      // Start a transaction
      await client.query('BEGIN');

      // Get the user id for test-merchant@example.com
      const userResult = await client.query(
        'SELECT * FROM users WHERE email = $1',
        ['test-merchant@example.com']
      );
      
      if (userResult.rows.length === 0) {
        console.log('User not found. Creating test merchant user...');
        
        // Create the user with a known password
        const hashedPassword = await bcrypt.hash('Password123!', 10);
        const userInsertResult = await client.query(
          'INSERT INTO users (email, password, role, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
          ['test-merchant@example.com', hashedPassword, 'merchant']
        );
        
        console.log('User created:', userInsertResult.rows[0]);
        
        // Check if this merchant already exists in the merchants table
        const merchantResult = await client.query(
          'SELECT * FROM merchants WHERE user_id = $1',
          [userInsertResult.rows[0].id]
        );
        
        if (merchantResult.rows.length === 0) {
          // Create a merchant record for this user
          const merchantInsertResult = await client.query(
            'INSERT INTO merchants (user_id, name, created_at) VALUES ($1, $2, NOW()) RETURNING *',
            [userInsertResult.rows[0].id, 'Test Merchant']
          );
          
          console.log('Merchant record created:', merchantInsertResult.rows[0]);
        } else {
          console.log('Merchant record already exists:', merchantResult.rows[0]);
        }
      } else {
        console.log('Updating password for existing user:', userResult.rows[0].id);
        
        // Update the user's password
        const hashedPassword = await bcrypt.hash('Password123!', 10);
        await client.query(
          'UPDATE users SET password = $1 WHERE id = $2 RETURNING *',
          [hashedPassword, userResult.rows[0].id]
        );
        
        console.log('Password updated successfully');
        
        // Get the associated merchant record
        const merchantResult = await client.query(
          'SELECT * FROM merchants WHERE user_id = $1',
          [userResult.rows[0].id]
        );
        
        if (merchantResult.rows.length === 0) {
          // Create a merchant record for this user
          const merchantInsertResult = await client.query(
            'INSERT INTO merchants (user_id, name, created_at) VALUES ($1, $2, NOW()) RETURNING *',
            [userResult.rows[0].id, 'Test Merchant']
          );
          
          console.log('Merchant record created:', merchantInsertResult.rows[0]);
        } else {
          console.log('Merchant record found:', merchantResult.rows[0]);
        }
      }
      
      // Commit the transaction
      await client.query('COMMIT');
      console.log('Password reset completed successfully');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction failed:', error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    pool.end();
  }
}

resetMerchantPassword().catch(error => {
  console.error('Unhandled error:', error);
});