import { Router, Request, Response } from 'express';
import { storage } from '../../storage';
import { logger } from '../../services/logger';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/admin/plaid/merchants
 * Get all merchants with their Plaid credentials
 */
router.get('/merchants', async (req: Request, res: Response) => {
  try {
    logger.info({
      message: 'Admin requesting all merchants with Plaid credentials',
      category: 'api',
      userId: req.user?.id,
      source: 'plaid',
      metadata: {
        path: req.path,
        method: req.method
      }
    });

    // Get all plaid merchants
    const plaidMerchants = await storage.getAllPlaidMerchants();
    
    // Get merchant names for each plaid merchant
    const merchantsWithNames = await Promise.all(
      plaidMerchants.map(async (plaidMerchant) => {
        const merchant = await storage.getMerchant(plaidMerchant.merchantId);
        return {
          ...plaidMerchant,
          merchantName: merchant ? merchant.name : `Merchant #${plaidMerchant.merchantId}`
        };
      })
    );
    
    res.json({ 
      success: true, 
      merchants: merchantsWithNames 
    });
  } catch (error) {
    logger.error({
      message: `Error fetching Plaid merchants: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      userId: req.user?.id,
      source: 'plaid',
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching Plaid merchants'
    });
  }
});

/**
 * POST /api/admin/plaid/merchants/:id/generate-report
 * Generate an asset report for a specific merchant
 */
router.post('/merchants/:id/generate-report', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.id);
    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid merchant ID format' 
      });
    }

    // Check if merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({ 
        success: false, 
        message: 'Merchant not found' 
      });
    }

    // Get Plaid merchant
    const plaidMerchant = await storage.getPlaidMerchantByMerchantId(merchantId);
    if (!plaidMerchant) {
      return res.status(404).json({ 
        success: false, 
        message: 'No Plaid credentials found for this merchant' 
      });
    }

    if (!plaidMerchant.accessToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Merchant has no Plaid access token' 
      });
    }

    // Get days requested from request body or use default
    const daysRequested = req.body.daysRequested || 90;

    // Use the plaidService to generate an asset report
    const assetReportResult = await req.app.locals.plaidService.createAssetReport(
      plaidMerchant.accessToken,
      daysRequested,
      {
        client_report_id: `merchant-${merchantId}-${Date.now()}`,
        webhook: process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/plaid/webhook` : undefined,
        user: {
          client_user_id: `merchant-${merchantId}`,
        }
      }
    );

    // Store the asset report token in the database
    await storage.storeAssetReportToken(
      0, // No contract ID for merchant-specific reports
      assetReportResult.assetReportToken,
      assetReportResult.assetReportId,
      {
        userId: merchantId,
        daysRequested,
        metadata: JSON.stringify({
          generatedBy: 'admin-interface',
          adminId: req.user?.id,
          timestamp: new Date().toISOString()
        })
      }
    );

    res.json({
      success: true,
      assetReportId: assetReportResult.assetReportId,
      message: 'Asset report generation started'
    });
  } catch (error) {
    logger.error({
      message: `Error generating asset report: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      userId: req.user?.id,
      source: 'plaid',
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Error generating asset report'
    });
  }
});

/**
 * PATCH /api/admin/plaid/merchants/:id
 * Update a merchant's Plaid credentials
 */
router.patch('/merchants/:id', async (req: Request, res: Response) => {
  try {
    // Validate the request body
    const updateSchema = z.object({
      clientId: z.string().optional(),
      accessToken: z.string().optional(),
      onboardingStatus: z.string().optional(),
      defaultFundingAccount: z.string().optional()
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.format()
      });
    }

    const merchantId = parseInt(req.params.id);
    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid merchant ID format' 
      });
    }

    // Check if merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({ 
        success: false, 
        message: 'Merchant not found' 
      });
    }

    // Get existing Plaid merchant record if it exists
    const plaidMerchant = await storage.getPlaidMerchantByMerchantId(merchantId);
    
    let updatedPlaidMerchant;
    
    if (plaidMerchant) {
      // Update existing record
      updatedPlaidMerchant = await storage.updatePlaidMerchant(plaidMerchant.id, {
        ...validation.data,
        updatedAt: new Date()
      });
      
      logger.info({
        message: 'Admin updated Plaid credentials for merchant',
        category: 'api',
        userId: req.user?.id,
        source: 'plaid',
        metadata: {
          merchantId,
          plaidMerchantId: plaidMerchant.id,
          updatedFields: Object.keys(validation.data)
        }
      });
    } else {
      // Create new record
      updatedPlaidMerchant = await storage.createPlaidMerchant({
        merchantId,
        ...validation.data,
        onboardingStatus: validation.data.onboardingStatus || 'pending'
      });
      
      logger.info({
        message: 'Admin created new Plaid credentials for merchant',
        category: 'api',
        userId: req.user?.id,
        source: 'plaid',
        metadata: {
          merchantId,
          plaidMerchantId: updatedPlaidMerchant.id,
          fields: Object.keys(validation.data)
        }
      });
    }

    res.json({
      success: true,
      message: plaidMerchant ? 'Plaid credentials updated' : 'Plaid credentials created',
      plaidMerchant: updatedPlaidMerchant
    });
  } catch (error) {
    logger.error({
      message: `Error updating Plaid credentials: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      userId: req.user?.id,
      source: 'plaid',
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Error updating Plaid credentials'
    });
  }
});

export default router;