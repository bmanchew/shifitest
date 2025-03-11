
import { logger } from "../services/logger";
import { AppError } from "../services/errorHandler";

/**
 * Executes a database operation safely with proper error handling
 * @param operation The async database function to execute
 * @param errorMessage Custom error message if the operation fails
 */
export async function executeDbOperation<T>(
  operation: () => Promise<T>,
  errorMessage = "Database operation failed"
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error({
      message: errorMessage,
      category: "database",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    throw new AppError(
      errorMessage,
      500
    );
  }
}

/**
 * Safely gets an entity by ID with proper error handling and 404 if not found
 * @param fetcher The database fetch function
 * @param id The entity ID
 * @param entityName The name of the entity for error messages
 */
export async function getEntityById<T>(
  fetcher: (id: number) => Promise<T | null>,
  id: number,
  entityName: string
): Promise<T> {
  const entity = await executeDbOperation(
    () => fetcher(id),
    `Failed to fetch ${entityName}`
  );
  
  if (!entity) {
    throw new AppError(`${entityName} not found with ID: ${id}`, 404);
  }
  
  return entity;
}
