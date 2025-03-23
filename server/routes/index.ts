import { Router } from 'express';
import notificationRoutes from './notification';
import healthRoutes from './health';

const router = Router();

// Register all routes
router.use('/api/health', healthRoutes);
router.use('/api/notifications', notificationRoutes);

export default router;