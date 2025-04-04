import bcrypt from 'bcrypt';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './shared/schema.ts';
import { eq } from 'drizzle-orm';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

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
    const result = await db.update(schema.users)
      .set({ password: hashedPassword })
      .where(eq(schema.users.email, ADMIN_EMAIL))
      .returning({ id: schema.users.id, email: schema.users.email });

    if (result.length > 0) {
      console.log(`Successfully reset password for admin user: ${result[0].email} (ID: ${result[0].id})`);
    } else {
      console.log(`Admin user not found: ${ADMIN_EMAIL}`);
    }
  } catch (error) {
    console.error('Error resetting admin password:', error);
  }
}

// Run the function
resetAdminPassword();