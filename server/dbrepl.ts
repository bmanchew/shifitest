
import { db } from './db';
import * as schema from '@shared/schema';
import * as readline from 'readline';
import { eq } from 'drizzle-orm';
import { SQL } from 'drizzle-orm';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function executeQuery(query: string) {
  try {
    // For simple table selection queries
    if (query.trim().toLowerCase() === 'show tables') {
      console.log("Available tables:");
      console.log("- users");
      console.log("- merchants");
      console.log("- contracts");
      console.log("- applicationProgress");
      console.log("- creditProfiles");
      console.log("- underwriting");
      console.log("- logs");
      return;
    }
    
    // Handle select all queries for specific tables
    if (query.trim().toLowerCase() === 'select * from users') {
      const result = await db.select().from(schema.users);
      console.table(result);
      return;
    }
    
    if (query.trim().toLowerCase() === 'select * from merchants') {
      const result = await db.select().from(schema.merchants);
      console.table(result);
      return;
    }
    
    if (query.trim().toLowerCase() === 'select * from contracts') {
      const result = await db.select().from(schema.contracts);
      console.table(result);
      return;
    }
    
    if (query.trim().toLowerCase() === 'select * from application_progress') {
      const result = await db.select().from(schema.applicationProgress);
      console.table(result);
      return;
    }
    
    if (query.trim().toLowerCase() === 'select * from credit_profiles') {
      const result = await db.select().from(schema.creditProfiles);
      console.table(result);
      return;
    }
    
    if (query.trim().toLowerCase() === 'select * from underwriting') {
      const result = await db.select().from(schema.underwriting);
      console.table(result);
      return;
    }
    
    if (query.trim().toLowerCase() === 'select * from logs') {
      const result = await db.select().from(schema.logs);
      console.table(result);
      return;
    }
    
    // For more complex queries, execute raw SQL
    // Warning: This is only for viewing data, not for modifying it
    if (query.trim().toLowerCase().startsWith('select')) {
      const result = await db.execute(SQL.raw(query));
      console.table(result.rows);
      return;
    }
    
    console.log("Only SELECT queries are supported for safety reasons");
  } catch (error) {
    console.error("Error executing query:", error);
  }
}

async function startRepl() {
  console.log("=== Database REPL ===");
  console.log("Enter SQL queries to view data (only SELECT queries are supported)");
  console.log("Type 'show tables' to see available tables");
  console.log("Type 'exit' to quit");
  
  const promptUser = () => {
    rl.question("db> ", async (query) => {
      if (query.toLowerCase() === 'exit') {
        await db.client.end();
        rl.close();
        return;
      }
      
      await executeQuery(query);
      promptUser();
    });
  };
  
  promptUser();
}

startRepl();
