
import { db } from './db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

async function viewDatabase() {
  try {
    console.log("=== DATABASE CONTENTS ===");
    
    // View users
    console.log("\n=== USERS ===");
    const allUsers = await db.select().from(schema.users);
    console.table(allUsers);
    
    // View merchants
    console.log("\n=== MERCHANTS ===");
    const allMerchants = await db.select().from(schema.merchants);
    console.table(allMerchants);
    
    // View contracts
    console.log("\n=== CONTRACTS ===");
    const allContracts = await db.select().from(schema.contracts);
    console.table(allContracts);
    
    // View application progress
    console.log("\n=== APPLICATION PROGRESS ===");
    const allProgress = await db.select().from(schema.applicationProgress);
    console.table(allProgress);
    
    // View credit profiles
    console.log("\n=== CREDIT PROFILES ===");
    const allCreditProfiles = await db.select().from(schema.creditProfiles);
    console.table(allCreditProfiles);
    
    // View underwriting
    console.log("\n=== UNDERWRITING ===");
    const allUnderwriting = await db.select().from(schema.underwriting);
    console.table(allUnderwriting);
    
    // View logs
    console.log("\n=== LOGS ===");
    const allLogs = await db.select().from(schema.logs);
    console.table(allLogs);
    
  } catch (error) {
    console.error("Error viewing database:", error);
  } finally {
    // Close the connection
    await db.client.end();
  }
}

// Run the function
viewDatabase();
