import express from 'express';
import { adminController } from '../controllers/admin.controller';
import { isAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @route POST /api/admin/trigger-satisfaction-surveys
 * @desc Trigger satisfaction surveys for eligible contracts
 * @access Private (Admin only)
 */
router.post('/trigger-satisfaction-surveys', isAdmin, adminController.triggerSatisfactionSurveys);

// Additional admin routes can be added here

export default router;