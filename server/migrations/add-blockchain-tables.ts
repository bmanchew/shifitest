import fs from 'fs';
import path from 'path';
import { pool } from '../db';
import { logger } from '../services/logger';

export async function addBlockchainTables() {
  try {
    logger.info({
      message: "Starting migration: Adding blockchain tables",
      category: "system",
    });

    // Check if smart_contract_templates table exists
    const { rows } = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'smart_contract_templates'
      );
    `);

    if (rows[0].exists) {
      logger.info({
        message: "Blockchain tables already exist, skipping migration",
        category: "system",
      });
      return;
    }

    // Read the SQL migration file
    const sqlFilePath = path.join(process.cwd(), 'migrations', 'add_blockchain_tables.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute the SQL
    await pool.query(sql);

    logger.info({
      message: "Blockchain tables created successfully",
      category: "system",
    });
  } catch (error) {
    logger.error({
      message: "Failed to create blockchain tables",
      category: "system",
      metadata: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined 
      },
    });
    throw error;
  }
}