/**
 * Webhook endpoint for receiving data from Zapier
 */
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import { zapierService, ZapierContractStatusUpdate } from '../../services/zapier';

const router = Router();

// Schema for validating webhook data
const zapierContractUpdateSchema = z.object({
  contractNumber: z.string(),
  contractId: z.number(),
  status: z.string().optional(),
  applicationProgress: z.object({
    step: z.string().optional(),
    completed: z.boolean().optional(),
  }).optional(),
  notes: z.string().optional(),
  externalId: z.string().optional(),
  approvedAmount: z.number().optional(),
});

/**
 * Webhook endpoint for receiving contract status updates from Zapier
 */
router.post('/contract-update', async (req: Request, res: Response) => {
  try {
    // Validate incoming webhook data
    const validationResult = zapierContractUpdateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      logger.error({
        message: 'Invalid webhook data received from Zapier',
        category: 'integration',
        source: 'webhook',
        metadata: {
          errors: validationResult.error.format(),
          body: req.body
        }
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook data',
        errors: validationResult.error.format()
      });
    }
    
    const webhookData = validationResult.data;
    
    // Ensure status is not undefined before passing to service
    const updateData: ZapierContractStatusUpdate = {
      ...webhookData,
      status: webhookData.status || 'pending' // Provide a default status if none provided
    };
    
    // Process the contract status update
    const success = await zapierService.updateContractStatus(updateData);
    
    if (success) {
      logger.info({
        message: `Successfully processed contract update from Zapier: ${webhookData.contractNumber}`,
        category: 'integration',
        source: 'webhook',
        metadata: {
          contractId: webhookData.contractId,
          contractNumber: webhookData.contractNumber,
          status: webhookData.status,
          applicationProgress: webhookData.applicationProgress,
        }
      });
      
      return res.status(200).json({
        success: true,
        message: 'Contract update processed successfully'
      });
    } else {
      logger.error({
        message: `Failed to process contract update from Zapier: ${webhookData.contractNumber}`,
        category: 'integration',
        source: 'webhook',
        metadata: {
          contractId: webhookData.contractId,
          contractNumber: webhookData.contractNumber,
          status: webhookData.status
        }
      });
      
      return res.status(400).json({
        success: false,
        message: 'Failed to process contract update'
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      message: `Error processing webhook from Zapier: ${errorMessage}`,
      category: 'integration',
      source: 'webhook',
      metadata: {
        error: errorMessage,
        body: req.body
      }
    });
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error processing webhook'
    });
  }
});

/**
 * Webhook endpoint for verifying Zapier integration
 * This endpoint is used by Zapier to verify the webhook is valid
 */
router.post('/test', (req: Request, res: Response) => {
  logger.info({
    message: 'Received test webhook from Zapier',
    category: 'integration',
    source: 'webhook',
    metadata: {
      body: req.body,
      headers: req.headers,
      ip: req.ip
    }
  });
  
  return res.status(200).json({
    success: true,
    message: 'Test webhook received successfully',
    timestamp: new Date().toISOString()
  });
});

export default router;