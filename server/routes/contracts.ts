
import { db } from '../db';
import { contracts, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import express from 'express';
import { logger } from '../services/logger';
import { authenticate } from '../utils/middleware';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { merchantId } = req.query;
    
    const results = await db.query.contracts.findMany({
      where: merchantId ? eq(contracts.merchantId, Number(merchantId)) : undefined,
      with: {
        merchant: true,
        customer: true,  // Include the customer relationship
      },
    });

    // Transform the results to include formatted customer information
    const formattedResults = results.map(contract => {
      return {
        ...contract,
        customerFirstName: contract.customer?.firstName || '',
        customerLastName: contract.customer?.lastName || '',
        customerName: contract.customer 
          ? `${contract.customer.firstName || ''} ${contract.customer.lastName || ''}`.trim() || contract.customer.name || 'Unknown Customer'
          : 'Unknown Customer'
      };
    });

    return res.json(formattedResults);
  } catch (error) {
    logger.error({
      message: `Error fetching contracts: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: { error: error instanceof Error ? error.stack : null }
    });
    return res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// Other routes remain the same...

export default router;
