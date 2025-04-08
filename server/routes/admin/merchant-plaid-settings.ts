import { Request, Response } from 'express';
import { db } from '../../db';
import { plaidMerchants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../services/logger';
import { z } from 'zod';
import { storage } from '../../storage';

// Schema for update credentials
const updatePlaidCredentialsSchema = z.object({
  clientId: z.string().optional(),
  accessToken: z.string().optional(),
  defaultFundingAccount: z.string().optional()
});

/**
 * @route GET /api/admin/merchants/:merchantId/plaid-settings
 * @desc Get Plaid settings for a specific merchant
 * @access Private - Admin only
 */
export async function getPlaidSettings(req: Request, res: Response) {
  try {
    const merchantId = parseInt(req.params.merchantId);
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid merchant ID'
      });
    }

    const plaidMerchant = await db.query.plaidMerchants.findFirst({
      where: eq(plaidMerchants.merchantId, merchantId)
    });

    // If no record exists, return a 404
    if (!plaidMerchant) {
      return res.status(404).json({
        success: false,
        message: 'No Plaid settings found for this merchant'
      });
    }

    // Fetch the merchant name for reference
    const merchant = await storage.getMerchant(merchantId);
    const merchantName = merchant ? merchant.name : null;

    // Return the Plaid settings with merchant name
    return res.status(200).json({
      success: true,
      plaidSettings: {
        ...plaidMerchant,
        merchantName
      }
    });
  } catch (error) {
    logger.error({
      message: `Error fetching merchant Plaid settings: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : null,
      }
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Plaid settings'
    });
  }
}

/**
 * @route PATCH /api/admin/merchants/:merchantId/plaid-settings
 * @desc Update Plaid settings for a specific merchant
 * @access Private - Admin only
 */
export async function updatePlaidSettings(req: Request, res: Response) {
  try {
    const merchantId = parseInt(req.params.merchantId);
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid merchant ID'
      });
    }

    // Validate request body
    const validationResult = updatePlaidCredentialsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validationResult.error.format()
      });
    }

    const { clientId, accessToken, defaultFundingAccount } = validationResult.data;
    
    // Check if we already have a record for this merchant
    let plaidMerchant = await db.query.plaidMerchants.findFirst({
      where: eq(plaidMerchants.merchantId, merchantId)
    });

    let updatedSettings;

    if (plaidMerchant) {
      // Update existing record
      updatedSettings = await db.update(plaidMerchants)
        .set({
          clientId: clientId !== undefined ? clientId : plaidMerchant.clientId,
          accessToken: accessToken !== undefined ? accessToken : plaidMerchant.accessToken,
          defaultFundingAccount: defaultFundingAccount !== undefined 
            ? defaultFundingAccount 
            : plaidMerchant.defaultFundingAccount,
          updatedAt: new Date()
        })
        .where(eq(plaidMerchants.merchantId, merchantId))
        .returning();
    } else {
      // Create a new record if one doesn't exist
      updatedSettings = await db.insert(plaidMerchants)
        .values({
          merchantId,
          clientId: clientId || null,
          accessToken: accessToken || null,
          defaultFundingAccount: defaultFundingAccount || null,
          onboardingStatus: 'pending',
          createdAt: new Date()
        })
        .returning();
    }

    logger.info({
      message: 'Plaid credentials updated for merchant',
      category: 'plaid',
      source: 'internal',
      userId: req.user?.id,
      metadata: {
        merchantId,
        updatedById: req.user?.id
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Plaid settings updated successfully',
      plaidSettings: updatedSettings[0]
    });
  } catch (error) {
    logger.error({
      message: `Error updating merchant Plaid settings: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : null,
      }
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to update Plaid settings'
    });
  }
}