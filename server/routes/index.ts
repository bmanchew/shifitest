import { Router } from 'express';
import notificationRoutes from './notification';
// Removed health routes to avoid conflict with direct mounting in routes.ts

const router = Router();

// Register all routes
// Remove the '/api' prefix as routes will be mounted under /api in the main routes.ts
// Health routes are now mounted directly in routes.ts
router.use('/notifications', notificationRoutes);

export default router;