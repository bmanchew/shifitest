/**
 * This script resets the password for brandon@shilohfinance.com
 */
import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;

// Create a connection pool to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function resetBrandonPassword() {
  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    try {
      // Start a transaction
      await client.query('BEGIN');

      // Check if the user exists
      const userResult = await client.query(
        'SELECT * FROM users WHERE email = $1',
        ['brandon@shilohfinance.com']
      );
      
      if (userResult.rows.length === 0) {
        console.log('User brandon@shilohfinance.com not found in the database');
        return;
      }
      
      const user = userResult.rows[0];
      console.log('User found:', user);
      console.log('Current role:', user.role);
      
      // Reset the password to a known value
      const newPassword = 'Password123!'; // Simple password for testing
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await client.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, 'brandon@shilohfinance.com']
      );
      
      console.log('Password has been reset for brandon@shilohfinance.com');
      console.log('New password: ' + newPassword);
      
      // Check if user has a merchant record (if they're a merchant)
      if (user.role === 'merchant') {
        const merchantResult = await client.query(
          'SELECT * FROM merchants WHERE user_id = $1',
          [user.id]
        );
        
        if (merchantResult.rows.length > 0) {
          console.log('Associated merchant record:', merchantResult.rows[0]);
        } else {
          console.log('No merchant record found for this user');
        }
      }
      
      // Commit the transaction
      await client.query('COMMIT');
      
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

resetBrandonPassword().catch(error => {
  console.error('Unhandled error:', error);
});