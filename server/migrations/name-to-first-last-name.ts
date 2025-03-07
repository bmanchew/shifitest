
import { db } from "../db";
import { sql } from "drizzle-orm";

async function migrateName() {
  console.log("Starting name field migration...");
  
  try {
    // 1. Add the new columns if they don't exist
    console.log("Adding firstName and lastName columns...");
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS first_name TEXT,
      ADD COLUMN IF NOT EXISTS last_name TEXT
    `);
    
    // 2. Split the existing name values into first and last name
    console.log("Splitting name values into firstName and lastName...");
    const users = await db.execute(sql`
      SELECT id, name FROM users WHERE name IS NOT NULL
    `);
    
    for (const user of users.rows) {
      const nameParts = user.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      await db.execute(sql`
        UPDATE users 
        SET first_name = ${firstName}, last_name = ${lastName}
        WHERE id = ${user.id}
      `);
    }
    
    console.log("Name field migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

export { migrateName };
