import { migrateName } from "./name-to-first-last-name";
import { updateLogSourceEnum } from "./update-log-source-enum";
import { migrateArchivedFields } from "./add-archived-fields";
import { migrateTokenizationFields } from "./add-tokenization-fields";
import { addTokenizationErrorField } from "./add-tokenization-error-field";
import { addBlockchainTables } from "./add-blockchain-tables";
import { logger } from "../services/logger";

export async function runMigrations() {
  try {
    logger.info({
      message: "Starting database migrations",
      category: "system",
    });

    await migrateName();
    await updateLogSourceEnum();
    await migrateArchivedFields();
    await migrateTokenizationFields();
    await addTokenizationErrorField();
    await addBlockchainTables();

    logger.info({
      message: "Database migrations completed successfully",
      category: "system",
    });
  } catch (error) {
    logger.error({
      message: "Database migration failed",
      category: "system",
      metadata: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined 
      },
    });
    throw error;
  }
}
