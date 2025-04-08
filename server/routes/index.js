/**
 * Main Router
 * 
 * Central router that registers all application routes
 */

import express from 'express';
import apiRouter from './api/index.js';

const router = express.Router();

// Register API routes
router.use('/api', apiRouter);

// Add other route groups here...

export default router;