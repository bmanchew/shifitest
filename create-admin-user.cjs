/**
 * Create admin user script (CommonJS version)
 */

const bcrypt = require('bcrypt');
const { Pool } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
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
const db = drizzle(pool);

const ADMIN_EMAIL = 'admin@shifi.com';
const ADMIN_PASSWORD = 'password123';
const ADMIN_FIRST_NAME = 'Admin';
const ADMIN_LAST_NAME = 'User';

async function createAdminUser() {
  try {
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
    
    console.log(`Creating admin user: ${ADMIN_EMAIL}`);
    console.log(`Password hash: ${hashedPassword}`);

    // First check if the admin user already exists
    const checkResult = await db.execute(`
      SELECT id, email FROM users WHERE email = '${ADMIN_EMAIL}'
    `);
    
    if (checkResult.length > 0) {
      console.log(`Admin user already exists: ${checkResult[0].email} (ID: ${checkResult[0].id})`);
      
      // Update the password
      await db.execute(`
        UPDATE users 
        SET password = '${hashedPassword}' 
        WHERE email = '${ADMIN_EMAIL}'
      `);
      
      console.log(`Password updated for admin user: ${ADMIN_EMAIL}`);
      return;
    }
    
    // Insert the admin user
    const insertResult = await db.execute(`
      INSERT INTO users (
        email, 
        password, 
        first_name, 
        last_name, 
        created_at, 
        is_admin,
        is_merchant,
        is_verified,
        phone_verified,
        status
      ) 
      VALUES (
        '${ADMIN_EMAIL}', 
        '${hashedPassword}', 
        '${ADMIN_FIRST_NAME}', 
        '${ADMIN_LAST_NAME}', 
        NOW(), 
        true,
        false,
        true,
        true,
        'active'
      )
      RETURNING id, email
    `);

    console.log(`Successfully created admin user: ${insertResult[0].email} (ID: ${insertResult[0].id})`);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the function
createAdminUser();