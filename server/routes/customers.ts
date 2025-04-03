
import express from 'express';
import { storage } from '../storage';
import { logger } from '../services/logger';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * Get multiple customers by IDs in a single request
 * This optimized endpoint returns multiple customers by IDs to reduce API load
 */
router.get('/batch', authenticateToken, async (req, res) => {
  try {
    // Parse the comma-separated IDs from the query parameter
    const idsParam = req.query.ids as string;
    
    if (!idsParam) {
      return res.status(400).json({ 
        success: false, 
        message: 'Customer IDs are required as a comma-separated list' 
      });
    }
    
    // Parse the IDs, filter out invalid ones
    const customerIds = idsParam
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));
    
    if (customerIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid customer IDs provided' 
      });
    }
    
    logger.info({
      message: `Batch fetching ${customerIds.length} customers`,
      category: 'api',
      source: 'internal',
      userId: req.user?.id,
      metadata: { 
        customerCount: customerIds.length,
        firstFewIds: customerIds.slice(0, 5)
      }
    });
    
    // Fetch all customers in parallel
    const customerPromises = customerIds.map(async (id) => {
      try {
        const customer = await storage.getUser(id);
        if (!customer) return { id };
        
        // Remove sensitive data
        const { password, ...customerData } = customer;
        return customerData;
      } catch (error) {
        logger.warn({
          message: `Error fetching customer ${id} in batch: ${error instanceof Error ? error.message : String(error)}`,
          category: 'api',
          source: 'internal',
          userId: req.user?.id,
          metadata: { customerId: id }
        });
        return { id }; // Return minimal customer data if error
      }
    });
    
    const customers = await Promise.all(customerPromises);
    
    // Return the array of customers
    res.json({ 
      success: true,
      customers
    });
  } catch (error) {
    logger.error({
      message: `Error in batch customer fetch: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      userId: req.user?.id,
      metadata: { error: error instanceof Error ? error.stack : null }
    });
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
});

/**
 * Get active contract for the currently logged in customer
 * This endpoint is used during login to redirect customers to their active contract dashboard
 */
router.get('/active-contract', authenticateToken, async (req, res) => {
  try {
    // Get the user ID from the authenticated request
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Find the user to ensure they are a customer
    const user = await storage.getUser(userId);
    
    if (!user || user.role !== 'customer') {
      return res.status(403).json({ message: 'Forbidden - not a customer' });
    }
    
    // Find all contracts for this customer
    const contracts = await storage.getContractsByCustomerId(userId);
    
    if (!contracts || contracts.length === 0) {
      return res.json({ contracts: [] });
    }
    
    // Find the active contract (status = 'active')
    const activeContracts = contracts.filter(c => c.status === 'active');
    
    // Return all active contracts (should be just one in most cases)
    res.json({ contracts: activeContracts });
  } catch (error) {
    logger.error({
      message: `Error fetching active contract: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: { error: error instanceof Error ? error.stack : null }
    });
    res.status(500).json({ message: 'Internal server error' });
  }
});

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
