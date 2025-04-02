// CommonJS version of the password reset script
const { Pool, neonConfig } = require('@neondatabase/serverless');
const bcrypt = require('bcrypt');
const ws = require('ws');

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;

const MERCHANT_ID = 2; // ID for SHILOH FINANCE INC
const NEW_PASSWORD = 'Password123!'; // New password for the merchant

/**
 * Resets password for the specified merchant user
 */
async function resetMerchantPassword() {
  // Create a PostgreSQL connection pool
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });
  
  try {
    console.log(`Resetting password for merchant user ID ${MERCHANT_ID}...`);
    
    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, saltRounds);
    
    // Update the user's password in the database using raw SQL
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, email',
      [hashedPassword, MERCHANT_ID]
    );
    
    if (result.rows.length > 0) {
      console.log(`✅ Successfully reset password for ${result.rows[0].email}`);
      console.log(`New password is: ${NEW_PASSWORD}`);
    } else {
      console.error(`❌ No user found with ID ${MERCHANT_ID}`);
    }
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    // Close the database connection
    await pool.end();
    process.exit();
  }
}

// Run the password reset function
resetMerchantPassword();