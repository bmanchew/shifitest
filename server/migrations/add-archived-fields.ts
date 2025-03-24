import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../services/logger";

/**
 * This migration adds the archived, archived_at, and archived_reason fields to the contracts table
 * It reads the SQL from the migration file in the migrations directory and executes it
 */
async function migrateArchivedFields() {
  logger.info({
    message: "Starting archived fields migration for contracts table...",
    category: "system",
  });
  
  try {
    // Add archived fields
    await db.execute(sql`
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS archived_reason TEXT;
    `);
    
    // Create index for faster queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_contracts_archived ON contracts(archived);
    `);
    
    logger.info({
      message: "Archived fields migration completed successfully",
      category: "system",
    });
  } catch (error) {
    logger.error({
      message: "Archived fields migration failed",
      category: "system",
      metadata: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
    });
    throw error;
  }
}

export { migrateArchivedFields };