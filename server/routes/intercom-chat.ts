/**
 * Intercom Chat routes
 * These routes handle all Intercom chat integration endpoints
 */

import express from 'express';
import intercomRouter from './intercom';

const router = express.Router();

// Use the intercom router for all intercom-related functionality
router.use('/', intercomRouter);

export default router;