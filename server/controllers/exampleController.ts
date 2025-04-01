import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { ErrorFactory } from "../services/errorHandler";
import { z } from "zod";

// Define validation schema for example data
const createExampleSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  metadata: z.record(z.string(), z.any()).optional()
});

type CreateExampleInput = z.infer<typeof createExampleSchema>;

/**
 * Example Controller using ErrorFactory and proper error handling patterns
 * This demonstrates how controllers should be refactored to use the central error handling system
 */
export const exampleController = {
  /**
   * Get all examples
   * 
   * This function demonstrates using ErrorFactory for clean error handling
   * without try/catch blocks (relies on asyncHandler in routes)
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    // Check for query parameters
    const { limit = 10, page = 1 } = req.query;
    
    // Validate and parse parameters
    const parsedLimit = parseInt(limit as string);
    const parsedPage = parseInt(page as string);
    
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      // Use ErrorFactory to generate a standardized validation error
      return next(ErrorFactory.validation("Limit must be a positive number"));
    }
    
    if (isNaN(parsedPage) || parsedPage < 1) {
      return next(ErrorFactory.validation("Page must be a positive number"));
    }
    
    // Get data (no try/catch needed, asyncHandler will catch any thrown errors)
    const examples = await storage.getAllExamples(parsedLimit, parsedPage);
    
    // Log the successful action
    logger.info({
      message: "Examples retrieved successfully",
      category: "api",
      source: "internal",
      metadata: {
        count: examples.length,
        limit: parsedLimit,
        page: parsedPage
      }
    });
    
    // Return successful response
    return res.status(200).json({
      success: true,
      data: examples,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: examples.length // In a real app, you'd get the total count separately
      }
    });
  },
  
  /**
   * Get example by ID
   * 
   * This function demonstrates handling not found errors with ErrorFactory
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    
    // Validate ID
    const exampleId = parseInt(id);
    if (isNaN(exampleId)) {
      return next(ErrorFactory.validation("Invalid example ID"));
    }
    
    // Get example (no try/catch needed)
    const example = await storage.getExampleById(exampleId);
    
    // Check if example exists
    if (!example) {
      return next(ErrorFactory.notFound("Example"));
    }
    
    // Return successful response
    return res.status(200).json({
      success: true,
      data: example
    });
  },
  
  /**
   * Create new example
   * 
   * This function demonstrates validation with Zod and ErrorFactory
   */
  async create(req: Request, res: Response, next: NextFunction) {
    // Validate input with Zod schema
    try {
      const validatedData = createExampleSchema.parse(req.body);
      
      // Create example
      const newExample = await storage.createExample(validatedData);
      
      // Log the successful action
      logger.info({
        message: "Example created successfully",
        category: "api",
        source: "internal",
        metadata: {
          exampleId: newExample.id,
          name: newExample.name
        }
      });
      
      // Return successful response
      return res.status(201).json({
        success: true,
        data: newExample,
        message: "Example created successfully"
      });
    } catch (error) {
      // If it's a Zod validation error, the global error handler will format it properly
      // because we're using the next() function
      return next(error);
    }
  },
  
  /**
   * Update example
   * 
   * This function demonstrates handling multiple error types with ErrorFactory
   */
  async update(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    
    // Validate ID
    const exampleId = parseInt(id);
    if (isNaN(exampleId)) {
      return next(ErrorFactory.validation("Invalid example ID"));
    }
    
    // Check if example exists
    const existingExample = await storage.getExampleById(exampleId);
    if (!existingExample) {
      return next(ErrorFactory.notFound("Example"));
    }
    
    // Validate input - partial schema that makes all fields optional
    try {
      const updateSchema = createExampleSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      
      // Check if user has permission
      if (req.user?.role !== 'admin' && existingExample.createdBy !== req.user?.id) {
        return next(ErrorFactory.forbidden("You don't have permission to update this example"));
      }
      
      // Update example
      const updatedExample = await storage.updateExample(exampleId, validatedData);
      
      // Log the successful action
      logger.info({
        message: "Example updated successfully",
        category: "api",
        source: "internal",
        metadata: {
          exampleId,
          updatedFields: Object.keys(validatedData)
        }
      });
      
      // Return successful response
      return res.status(200).json({
        success: true,
        data: updatedExample,
        message: "Example updated successfully"
      });
    } catch (error) {
      // Zod validation error will be handled by global error handler
      return next(error);
    }
  },
  
  /**
   * Delete example
   * 
   * This function demonstrates combining authorization with error handling
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    
    // Validate ID
    const exampleId = parseInt(id);
    if (isNaN(exampleId)) {
      return next(ErrorFactory.validation("Invalid example ID"));
    }
    
    // Check if example exists
    const existingExample = await storage.getExampleById(exampleId);
    if (!existingExample) {
      return next(ErrorFactory.notFound("Example"));
    }
    
    // Check if user has permission
    const userRole = req.user?.role || 'user';
    if (userRole !== 'admin' && existingExample.createdBy !== req.user?.id) {
      return next(ErrorFactory.forbidden("You don't have permission to delete this example"));
    }
    
    // Delete example
    await storage.deleteExample(exampleId);
    
    // Log the successful action
    logger.info({
      message: "Example deleted successfully",
      category: "api",
      source: "internal",
      metadata: {
        exampleId,
        name: existingExample.name
      }
    });
    
    // Return successful response
    return res.status(200).json({
      success: true,
      message: "Example deleted successfully"
    });
  },
  
  /**
   * Handle an external API call example
   * 
   * This function demonstrates handling external API errors
   */
  async callExternalApi(req: Request, res: Response, next: NextFunction) {
    const { serviceType } = req.body;
    
    if (!serviceType) {
      return next(ErrorFactory.validation("Service type is required"));
    }
    
    try {
      // Call external service
      // In a real app, this would be a call to an external API
      const result = await simulateExternalApiCall(serviceType);
      
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      // Special handling for external API errors
      if (error.isAxiosError) {
        // Get status code from axios error
        const statusCode = error.response?.status || 500;
        
        // Create a specific error for external APIs
        return next(ErrorFactory.externalApi(
          serviceType,
          error.response?.data?.message || error.message,
          statusCode,
          {
            axiosError: {
              status: statusCode,
              data: error.response?.data
            }
          }
        ));
      }
      
      // If it's not an axios error, just pass it to the global handler
      return next(error);
    }
  }
};

/**
 * Helper function to simulate an external API call
 * In a real app, this would be replaced with an actual API call
 */
async function simulateExternalApiCall(serviceType: string): Promise<any> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Randomly succeed or fail to demonstrate error handling
  const shouldFail = Math.random() > 0.7;
  
  if (shouldFail) {
    const error: any = new Error(`${serviceType} service is temporarily unavailable`);
    error.isAxiosError = true;
    error.response = {
      status: 503,
      data: {
        message: `${serviceType} service is temporarily unavailable`,
        error: "SERVICE_UNAVAILABLE"
      }
    };
    throw error;
  }
  
  return {
    serviceType,
    data: {
      id: Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      result: "success"
    }
  };
}