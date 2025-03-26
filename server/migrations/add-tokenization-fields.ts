import { pool } from "../db";
import { logger } from "../services/logger";
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the current file URL (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function migrateTokenizationFields() {
  const client = await pool.connect();

  try {
    logger.info({
      message: "Starting migration: Adding tokenization fields to contracts table",
      category: "system",
    });

    // Begin transaction
    await client.query("BEGIN");

    // Check if the tokenization_status column already exists
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'contracts' AND column_name = 'tokenization_status'
    `);

    // Only run migration if the column doesn't exist
    if (checkResult.rowCount === 0) {
      // Read the SQL file
      const sqlPath = path.join(__dirname, '../../migrations/add_tokenization_fields.sql');
      const sql = fs.readFileSync(sqlPath, 'utf-8');

      // Execute the SQL
      await client.query(sql);

      logger.info({
        message: "Successfully added tokenization fields to contracts table",
        category: "system",
      });
    } else {
      logger.info({
        message: "Tokenization fields already exist in contracts table, skipping migration",
        category: "system",
      });
    }

    // Commit transaction
    await client.query("COMMIT");
    
  } catch (error) {
    // Rollback on error
    await client.query("ROLLBACK");
    
    logger.error({
      message: "Failed to add tokenization fields to contracts table",
      category: "system",
      metadata: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined 
      },
    });
    
    throw error;
  } finally {
    // Release client back to pool
    client.release();
  }
}