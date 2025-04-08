/**
 * Admin routes for configuring merchant Zapier integration settings
 */
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { merchants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { zapierService } from '../../services/zapier';
import { logger, LogSource } from '../../utils/logger';

const router = Router();

// Schema for validating merchant Zapier settings update
const updateMerchantZapierSettingsSchema = z.object({
  zapierIntegrationEnabled: z.boolean().optional(),
  zapierWebhookUrl: z.string().nullable().optional(),
  zapierIntegrationSettings: z.object({
    notifyOnNewApplication: z.boolean().optional(),
    notifyOnStatusChange: z.boolean().optional(),
    notifyOnContractSigning: z.boolean().optional(),
    customFields: z.record(z.string()).optional(),
  }).optional().nullable(),
});

/**
 * Get Zapier integration settings for a specific merchant
 */
router.get('/:merchantId', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ message: 'Invalid merchant ID' });
    }
    
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
    });
    
    if (!merchant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }
    
    // Return only Zapier related settings
    return res.status(200).json({
      merchantId: merchant.id,
      zapierIntegrationEnabled: merchant.zapierIntegrationEnabled,
      zapierWebhookUrl: merchant.zapierWebhookUrl,
      zapierIntegrationSettings: merchant.zapierIntegrationSettings,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      message: `Error getting merchant Zapier settings: ${errorMessage}`,
      category: 'api',
      source: 'internal' as LogSource,
      metadata: {
        merchantId: req.params.merchantId,
        error: errorMessage
      }
    });
    
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Update Zapier integration settings for a merchant
 */
router.patch('/:merchantId', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ message: 'Invalid merchant ID' });
    }
    
    // Validate request body
    const validationResult = updateMerchantZapierSettingsSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body',
        errors: validationResult.error.format()
      });
    }
    
    const updateData = validationResult.data;
    
    // Validate webhook URL if provided
    if (updateData.zapierWebhookUrl) {
      const isValidUrl = zapierService.validateWebhookUrl(updateData.zapierWebhookUrl);
      
      if (!isValidUrl) {
        return res.status(400).json({
          message: 'Invalid Zapier webhook URL',
          details: 'The URL provided is not a valid Zapier webhook URL'
        });
      }
    }
    
    // Fetch the merchant to check if it exists
    const existingMerchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
    });
    
    if (!existingMerchant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }
    
    // Update the merchant with new Zapier settings
    await db.update(merchants)
      .set({
        zapierIntegrationEnabled: updateData.zapierIntegrationEnabled ?? existingMerchant.zapierIntegrationEnabled,
        zapierWebhookUrl: updateData.zapierWebhookUrl ?? existingMerchant.zapierWebhookUrl,
        zapierIntegrationSettings: updateData.zapierIntegrationSettings ?? existingMerchant.zapierIntegrationSettings,
      })
      .where(eq(merchants.id, merchantId));
    
    // Get the updated merchant
    const updatedMerchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
    });
    
    if (!updatedMerchant) {
      return res.status(500).json({ message: 'Failed to retrieve updated merchant' });
    }
    
    logger.info({
      message: `Updated Zapier integration settings for merchant ${merchantId}`,
      category: 'integration',
      source: 'zapier' as LogSource,
      metadata: {
        merchantId,
        enabled: updatedMerchant.zapierIntegrationEnabled
      }
    });
    
    // Return only the Zapier-related settings
    return res.status(200).json({
      merchantId: updatedMerchant.id,
      zapierIntegrationEnabled: updatedMerchant.zapierIntegrationEnabled,
      zapierWebhookUrl: updatedMerchant.zapierWebhookUrl,
      zapierIntegrationSettings: updatedMerchant.zapierIntegrationSettings,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      message: `Error updating merchant Zapier settings: ${errorMessage}`,
      category: 'api',
      source: 'internal' as LogSource,
      metadata: {
        merchantId: req.params.merchantId,
        error: errorMessage
      }
    });
    
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Test Zapier integration by sending a test payload to the webhook
 */
router.post('/:merchantId/test', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ message: 'Invalid merchant ID' });
    }
    
    // Get the merchant
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
    });
    
    if (!merchant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }
    
    if (!merchant.zapierIntegrationEnabled) {
      return res.status(400).json({ message: 'Zapier integration is not enabled for this merchant' });
    }
    
    if (!merchant.zapierWebhookUrl) {
      return res.status(400).json({ message: 'No webhook URL configured for this merchant' });
    }
    
    // Create a test payload
    const testPayload = {
      contractId: 0,
      contractNumber: 'TEST-CONTRACT-0123', 
      merchantId: merchant.id,
      merchantName: merchant.name,
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      customerPhone: '+1234567890',
      amount: 5000,
      financedAmount: 4500,
      downPayment: 500,
      monthlyPayment: 250,
      termMonths: 24,
      interestRate: 0.05,
      programName: 'Test Program',
      applicationDate: new Date().toISOString(),
      status: 'test',
      currentStep: 'test',
      customFields: merchant.zapierIntegrationSettings?.customFields || {
        test_key: 'test_value'
      }
    };
    
    // Send the test payload
    const result = await zapierService.sendApplicationToZapier(
      merchant.zapierWebhookUrl,
      testPayload
    );
    
    if (result) {
      logger.info({
        message: `Test payload sent successfully to Zapier for merchant ${merchantId}`,
        category: 'integration',
        source: 'zapier' as LogSource,
        metadata: {
          merchantId,
          webhookUrl: '(URL redacted)'
        }
      });
      
      return res.status(200).json({
        message: 'Test payload sent successfully',
        success: true
      });
    } else {
      logger.error({
        message: `Failed to send test payload to Zapier for merchant ${merchantId}`,
        category: 'integration',
        source: 'zapier' as LogSource,
        metadata: {
          merchantId,
          webhookUrl: '(URL redacted)'
        }
      });
      
      return res.status(500).json({
        message: 'Failed to send test payload',
        success: false
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      message: `Error testing Zapier integration: ${errorMessage}`,
      category: 'integration',
      source: 'zapier' as LogSource,
      metadata: {
        merchantId: req.params.merchantId,
        error: errorMessage
      }
    });
    
    return res.status(500).json({ 
      message: 'Internal server error',
      success: false
    });
  }
});

export default router;