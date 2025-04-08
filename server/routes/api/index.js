/**
 * API Router
 * 
 * Central router for all API routes
 */

import express from 'express';
import plaidTransfersRouter from './plaid-transfers.js';

const router = express.Router();

// Register the Plaid Transfers routes
router.use('/plaid-transfers', plaidTransfersRouter);

// Add other API routes here...

export default router;