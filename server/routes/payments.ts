
import express from 'express';
import { stripeService } from '../services/stripe';
import { storage } from '../storage';
import { logger } from '../services/logger';

const router = express.Router();

router.post('/create-intent', async (req, res) => {
  try {
    const { contractId, amount } = req.body;

    const contract = await storage.getContract(parseInt(contractId));
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    const paymentIntent = await stripeService.createPaymentIntent(amount, {
      contractId: contract.id.toString(),
      contractNumber: contract.contractNumber
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    logger.error({
      message: `Error creating payment intent: ${error instanceof Error ? error.message : String(error)}`,
      category: 'payment',
      source: 'stripe',
      metadata: { error: error instanceof Error ? error.stack : null }
    });
    
    res.status(500).json({ message: 'Error creating payment' });
  }
});

export default router;
