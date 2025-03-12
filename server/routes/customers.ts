
import express from 'express';
import { storage } from '../storage';
import { logger } from '../services/logger';

const router = express.Router();

/**
 * Get customer by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    
    if (isNaN(customerId)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }
    
    const customer = await storage.getUser(customerId);
    
    if (!customer) {
      logger.warn({
        message: `Customer not found: ${customerId}`,
        category: 'api',
        source: 'internal',
        metadata: { customerId }
      });
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Return the customer without sensitive data
    const { password, ...customerData } = customer;
    res.json(customerData);
  } catch (error) {
    logger.error({
      message: `Error fetching customer: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: { error: error instanceof Error ? error.stack : null }
    });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
