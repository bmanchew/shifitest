/**
 * Run the investor accreditation migration
 * 
 * This script runs the migration to set up the database schema for investor accreditation verification
 */

// Import the required modules
import { migrateInvestorAccreditation } from './server/migrations/investor-accreditation.js';
import { logger } from './server/services/logger.js';

async function runMigration() {
  try {
    logger.info("Starting investor accreditation migration");
    await migrateInvestorAccreditation();
    logger.info("Investor accreditation migration completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error(`Error running migration: ${error}`);
    process.exit(1);
  }
}

// Run the migration
runMigration();