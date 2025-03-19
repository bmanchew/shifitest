import { Router } from 'express';
import notificationRoutes from './notification';

const router = Router();

// Register all routes
router.use('/api/notifications', notificationRoutes);

export default router;