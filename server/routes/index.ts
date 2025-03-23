import { Router } from 'express';
import notificationRoutes from './notification';
import healthRoutes from './health';

const router = Router();

// Register all routes
// Remove the '/api' prefix as routes will be mounted under /api in the main routes.ts
router.use('/health', healthRoutes);
router.use('/notifications', notificationRoutes);

export default router;