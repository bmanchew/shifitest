import { logger } from "../services/logger";
import { pool } from "../db";
import * as fs from "fs";
import * as path from "path";

export async function addTokenizationErrorField() {
  try {
    logger.info({
      message: "Starting migration: Adding tokenization_error field to contracts table",
      category: "system",
    });

    // Read migration SQL
    const sqlFilePath = path.resolve(
      process.cwd(),
      "migrations",
      "add_tokenization_error_field.sql"
    );
    
    if (!fs.existsSync(sqlFilePath)) {
      logger.error({
        message: "Migration file not found: add_tokenization_error_field.sql",
        category: "system",
      });
      return;
    }
    
    const sql = fs.readFileSync(sqlFilePath, "utf8");

    // Check if tokenization_error column already exists
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'contracts'
      AND column_name = 'tokenization_error'
    `);

    if (checkResult.rows.length > 0) {
      logger.info({
        message: "Tokenization error field already exists in contracts table, skipping migration",
        category: "system",
      });
      return;
    }

    // Execute migration
    await pool.query(sql);

    logger.info({
      message: "Migration completed: Added tokenization_error field to contracts table",
      category: "system",
    });
  } catch (error) {
    logger.error({
      message: `Error adding tokenization_error field: ${error instanceof Error ? error.message : String(error)}`,
      category: "system",
    });
    throw error;
  }
}