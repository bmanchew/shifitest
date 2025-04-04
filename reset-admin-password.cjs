/**
 * Reset admin password script (CommonJS version)
 */

const bcrypt = require('bcrypt');
const { Pool } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { eq } = require('drizzle-orm');
const ws = require('ws');

// Setup Neon connection
const neonConfig = require('@neondatabase/serverless');
neonConfig.neonConfig.webSocketConstructor = ws;

// Load the database URL
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Create the database pool and Drizzle instance
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Get users table reference
const users = {
  id: { name: 'id' },
  email: { name: 'email' },
  password: { name: 'password' }
};

const db = drizzle(pool);

const ADMIN_EMAIL = 'admin@shifi.com';
const NEW_PASSWORD = 'password123';

async function resetAdminPassword() {
  try {
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, saltRounds);
    
    console.log(`Resetting password for admin: ${ADMIN_EMAIL}`);
    console.log(`New password hash: ${hashedPassword}`);

    // Update the admin user password
    const result = await db.execute(`
      UPDATE users 
      SET password = '${hashedPassword}' 
      WHERE email = '${ADMIN_EMAIL}'
      RETURNING id, email
    `);

    if (result.length > 0) {
      console.log(`Successfully reset password for admin user: ${result[0].email} (ID: ${result[0].id})`);
    } else {
      console.log(`Admin user not found: ${ADMIN_EMAIL}`);
    }
  } catch (error) {
    console.error('Error resetting admin password:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the function
resetAdminPassword();