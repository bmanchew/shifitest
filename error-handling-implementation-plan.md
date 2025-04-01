# Error Handling Implementation Plan

## Overview
This document outlines a phased implementation plan for applying the standardized error handling pattern throughout the ShiFi platform. The aim is to incrementally refactor all route handlers to use the `asyncHandler` pattern and the `ErrorFactory` approach for consistent, robust error handling across the application.

## The Pattern
The standardized error handling pattern consists of:

1. **ErrorFactory**: A centralized factory for creating standardized errors
2. **asyncHandler**: A utility that wraps async route handlers to catch and process errors
3. **Controller Pattern**: Separate route handlers into controller methods
4. **Zod Validation**: Use Zod schemas for request validation

## Phase 1: Core Authentication & User Routes
_Status: Completed ✅_

- Implement the pattern in:
  - `server/routes/auth.routes.ts` 
  - `server/routes/user.routes.ts`
  - Create example implementations in `server/controllers/exampleController.ts` and `server/routes/example.routes.ts`

## Phase 2: Critical Business Logic Routes (High Priority)
_Estimated timeline: 1-2 weeks_

Focus on the most critical routes that handle sensitive operations:

1. **Merchant Management**
   - Refactor `server/routes/merchant.ts`
   - Extract controller methods to a new `server/controllers/merchant.controller.ts`
   - Apply asyncHandler to all routes

2. **Contract Management**
   - Refactor `server/routes/contracts.ts`
   - Extract controller logic to `server/controllers/contract.controller.ts`
   - Apply asyncHandler to all routes

3. **Payment Processing**
   - Refactor `server/routes/payments.ts`
   - Create `server/controllers/payment.controller.ts`

## Phase 3: Investor & Financial Routes (Medium Priority)
_Estimated timeline: 1-2 weeks_

1. **Investor Routes**
   - Refactor `server/routes/investor.ts` and subdirectories
   - Create dedicated controller files
   - Apply asyncHandler pattern

2. **Underwriting Routes**
   - Refactor `server/routes/underwriting.ts`
   - Create controller file with ErrorFactory usage

3. **Blockchain Routes**
   - Refactor `server/routes/blockchain.ts` and related files
   - Apply the pattern consistently

## Phase 4: Administrative & Supporting Routes (Lower Priority)
_Estimated timeline: 1-2 weeks_

1. **Admin Routes**
   - Refactor all files in `server/routes/admin/` directory
   - Create controller files for each admin subdomain

2. **Communications Routes**
   - Refactor `server/routes/communications.ts` and related files
   - Create a communications controller

3. **Notification Routes**
   - Refactor `server/routes/notification.ts`
   - Create notification controller

## Phase 5: Inline Route Handlers in Main routes.ts
_Estimated timeline: 1 week_

1. **Main Routes File**
   - Refactor all inline route handlers in `server/routes.ts`
   - Move to appropriate controller files
   - Use asyncHandler for all routes

2. **Final Cleanup**
   - Ensure consistent pattern usage across all routes
   - Remove any remaining direct try/catch blocks
   - Standardize response formats

## Implementation Guidelines

### For Each Route File

1. **Create Controller File** (if not exists):
   ```typescript
   // server/controllers/example.controller.ts
   import { Request, Response, NextFunction } from "express";
   import { storage } from "../storage";
   import { logger } from "../services/logger";
   import { ErrorFactory } from "../services/errorHandler";
   
   export const exampleController = {
     async methodName(req: Request, res: Response, next: NextFunction) {
       // Validation
       if (!validInput) {
         return next(ErrorFactory.validation("Validation error message"));
       }
       
       // Business logic
       const result = await storage.someMethod();
       
       // Not found handling
       if (!result) {
         return next(ErrorFactory.notFound("Resource name"));
       }
       
       // Success response
       return res.status(200).json({
         success: true,
         data: result
       });
     }
   };
   ```

2. **Refactor Route File**:
   ```typescript
   // server/routes/example.routes.ts
   import express from 'express';
   import { exampleController } from '../controllers/example.controller';
   import { asyncHandler } from '../services/errorHandler';
   
   const router = express.Router();
   
   router.get('/', asyncHandler(exampleController.getAllExamples));
   router.post('/', asyncHandler(exampleController.createExample));
   
   export default router;
   ```

3. **Use appropriate ErrorFactory methods**:
   - `ErrorFactory.validation()` - For input validation errors
   - `ErrorFactory.notFound()` - For resources not found
   - `ErrorFactory.unauthorized()` - For authentication errors
   - `ErrorFactory.forbidden()` - For authorization errors
   - `ErrorFactory.conflict()` - For resource conflicts
   - `ErrorFactory.externalApi()` - For external API errors

## Testing Strategy

For each refactored route:

1. **Write unit tests** for the controller methods
2. **Test all error paths** to ensure errors are properly handled
3. **Test integration** with the global error handler
4. **Verify consistent error responses** across all endpoints

## Monitoring and Rollback Plan

1. **Monitor error rates** after each phase deployment
2. **Watch for unexpected error formats** in logs
3. **Have a rollback plan** ready for each phase
4. **Document all changes** for easy reference

## Success Criteria

The refactoring will be considered successful when:

1. All route handlers use the asyncHandler pattern
2. All errors are created through ErrorFactory
3. Error responses have a consistent format
4. Error logging is standardized and informative
5. No direct try/catch blocks remain in route handlers

This phased approach allows for incremental improvement while minimizing the risk of introducing new bugs. Each phase can be thoroughly tested before moving to the next.