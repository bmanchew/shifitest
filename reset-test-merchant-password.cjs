/**
 * This script resets the password for our test merchant user
 */
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Create database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function resetMerchantPassword() {
  try {
    console.log('Resetting password for test merchant account...');
    
    // Find the test merchant user
    const result = await db.query(
      'SELECT id FROM users WHERE email = $1',
      ['test-merchant@example.com']
    );
    
    if (result.rows.length === 0) {
      console.error('Test merchant user not found');
      return;
    }
    
    const userId = result.rows[0].id;
    console.log(`Found test merchant user with ID: ${userId}`);
    
    // New password: 'password123'
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Update the password
    const updateResult = await db.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, userId]
    );
    
    console.log('Password updated successfully');
    console.log('Test merchant credentials:');
    console.log('Email: test-merchant@example.com');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('Error resetting password:', error);
  }
}

resetMerchantPassword();