import path from 'path';
import fs from 'fs';
import { pool } from '../db';
import { logger } from '../services/logger';

async function updateLogSourceEnum() {
  try {
    logger.info({
      message: 'Starting log_source enum update migration',
      category: 'system',
    });

    const filePath = path.join(process.cwd(), 'migrations', 'add_log_source_values.sql');
    const sql = fs.readFileSync(filePath, 'utf8');
    
    await pool.query(sql);
    
    logger.info({
      message: 'log_source enum update migration completed successfully',
      category: 'system',
    });
  } catch (error) {
    logger.error({
      message: `Error updating log_source enum: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });
  }
}

export { updateLogSourceEnum };