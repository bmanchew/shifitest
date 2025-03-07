
import { db } from './db';
import { SQL } from 'drizzle-orm';

async function introspectDatabase() {
  try {
    console.log("=== DATABASE SCHEMA ===");
    
    // Get list of tables
    const tables = await db.execute(SQL.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `));
    
    console.log("\nTables in database:");
    tables.rows.forEach((table: any) => {
      console.log(`- ${table.table_name}`);
    });
    
    // For each table, get column information
    for (const table of tables.rows) {
      const tableName = table.table_name;
      console.log(`\n=== TABLE: ${tableName} ===`);
      
      const columns = await db.execute(SQL.raw(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position
      `));
      
      console.table(columns.rows);
    }
  } catch (error) {
    console.error("Error introspecting database:", error);
  } finally {
    await db.client.end();
  }
}

introspectDatabase();
