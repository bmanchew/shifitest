/**
 * Plaid Transfers API Routes
 * 
 * These routes allow merchants to initiate and manage Plaid transfers
 * through the application's API.
 */

import express from 'express';
import { z } from 'zod';
import { db } from '../../storage.js';
import {
  getPlaidClientForMerchant,
  createTransferAuthorization,
  createTransfer,
  getTransfer,
  getTransfersForMerchant,
  cancelTransfer
} from '../../services/plaid-transfer.js';

const router = express.Router();

// Schemas for request validation
const authorizationSchema = z.object({
  merchantId: z.number(),
  accountId: z.string(),
  type: z.enum(['credit', 'debit']),
  amount: z.number().positive(),
  description: z.string()
});

const transferSchema = z.object({
  merchantId: z.number(),
  authorizationId: z.string(),
  description: z.string(),
  metadata: z.record(z.string()).optional()
});

const cancelSchema = z.object({
  merchantId: z.number(),
  transferId: z.string()
});

/**
 * GET /api/plaid-transfers/merchant/:merchantId
 * Get transfers for a merchant
 */
router.get('/merchant/:merchantId', async (req, res) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    const count = parseInt(req.query.count) || 25;
    const offset = parseInt(req.query.offset) || 0;
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ error: 'Invalid merchant ID' });
    }
    
    // Verify merchant exists
    const merchant = await db.getMerchantById(merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    // Get transfers
    const transfers = await getTransfersForMerchant(merchantId, count, offset);
    
    res.json(transfers);
  } catch (error) {
    console.error('Error getting transfers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/plaid-transfers/:transferId
 * Get a specific transfer
 */
router.get('/:transferId', async (req, res) => {
  try {
    const transferId = req.params.transferId;
    const merchantId = parseInt(req.query.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ error: 'Invalid merchant ID' });
    }
    
    // Verify merchant exists
    const merchant = await db.getMerchantById(merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    // Get transfer
    const transfer = await getTransfer(merchantId, transferId);
    
    res.json(transfer);
  } catch (error) {
    console.error('Error getting transfer:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/plaid-transfers/authorization
 * Create a transfer authorization
 */
router.post('/authorization', async (req, res) => {
  try {
    // Validate request
    const result = authorizationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors });
    }
    
    const { merchantId, accountId, type, amount, description } = result.data;
    
    // Verify merchant exists
    const merchant = await db.getMerchantById(merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    // Create authorization
    const authorization = await createTransferAuthorization(
      merchantId,
      accountId,
      type,
      amount,
      description
    );
    
    res.json(authorization);
  } catch (error) {
    console.error('Error creating transfer authorization:', error);
    
    // Handle Plaid API errors
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: error.message,
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/plaid-transfers
 * Create a transfer
 */
router.post('/', async (req, res) => {
  try {
    // Validate request
    const result = transferSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors });
    }
    
    const { merchantId, authorizationId, description, metadata } = result.data;
    
    // Verify merchant exists
    const merchant = await db.getMerchantById(merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    // Create transfer
    const transfer = await createTransfer(
      merchantId,
      authorizationId,
      description,
      metadata
    );
    
    // Store transfer in database for tracking
    await db.createTransferRecord({
      merchant_id: merchantId,
      transfer_id: transfer.transfer_id,
      authorization_id: authorizationId,
      amount: transfer.amount,
      status: transfer.status,
      type: transfer.type,
      description,
      created_at: new Date()
    });
    
    res.json(transfer);
  } catch (error) {
    console.error('Error creating transfer:', error);
    
    // Handle Plaid API errors
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: error.message,
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/plaid-transfers/cancel
 * Cancel a transfer
 */
router.post('/cancel', async (req, res) => {
  try {
    // Validate request
    const result = cancelSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors });
    }
    
    const { merchantId, transferId } = result.data;
    
    // Verify merchant exists
    const merchant = await db.getMerchantById(merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    // Cancel transfer
    const cancelResult = await cancelTransfer(merchantId, transferId);
    
    // Update transfer status in database
    await db.updateTransferStatus(transferId, 'cancelled');
    
    res.json(cancelResult);
  } catch (error) {
    console.error('Error cancelling transfer:', error);
    
    // Handle Plaid API errors
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: error.message,
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

export default router;