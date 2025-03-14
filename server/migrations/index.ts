import { migrateName } from "./name-to-first-last-name";
import { logger } from "../services/logger";

export async function runMigrations() {
  try {
    logger.info({
      message: "Starting database migrations",
      category: "system",
    });

    await migrateName();

    logger.info({
      message: "Database migrations completed successfully",
      category: "system",
    });
  } catch (error) {
    logger.error({
      message: "Database migration failed",
      category: "system",
      metadata: { error },
    });
    throw error;
  }
}
