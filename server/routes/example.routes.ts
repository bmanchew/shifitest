import express from 'express';
import { exampleController } from '../controllers/exampleController';
import { isAuthenticated, isAdmin } from '../middleware/auth';
import { asyncHandler } from '../services/errorHandler';

const router = express.Router();

// Public routes - no authentication required
router.get('/', asyncHandler(exampleController.getAll));
router.get('/:id', asyncHandler(exampleController.getById));

// Protected routes - require authentication
router.post('/', isAuthenticated, asyncHandler(exampleController.create));
router.put('/:id', isAuthenticated, asyncHandler(exampleController.update));
router.delete('/:id', isAuthenticated, asyncHandler(exampleController.delete));

// External API example - requires authentication
router.post('/external-api', isAuthenticated, asyncHandler(exampleController.callExternalApi));

export default router;