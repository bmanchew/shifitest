import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { logger } from "../../services/logger";
import { z } from "zod";
import { merchants } from "@shared/schemas/merchant.schema";
import { eq } from "drizzle-orm";
import { coveredCareService } from "../../services/coveredCare";

const router = Router();

/**
 * Get funding providers settings for a merchant
 */
router.get("/:merchantId", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);

    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID" 
      });
    }

    const merchant = await storage.getMerchant(merchantId);
    
    if (!merchant) {
      return res.status(404).json({ 
        success: false, 
        message: "Merchant not found" 
      });
    }

    // Get funding settings with default values if not present
    const fundingSettings = {
      shifiFundingEnabled: merchant.shifiFundingEnabled ?? true,
      coveredCareFundingEnabled: merchant.coveredCareFundingEnabled ?? false,
      fundingSettings: merchant.fundingSettings ?? {}
    };

    return res.status(200).json({
      success: true,
      merchantId,
      fundingSettings
    });
  } catch (error) {
    logger.error({
      message: `Error fetching merchant funding settings: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null,
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to fetch merchant funding settings"
    });
  }
});

/**
 * Update funding provider settings for a merchant
 */
router.put("/:merchantId", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);

    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID" 
      });
    }

    // Validate request body
    const updateSchema = z.object({
      shifiFundingEnabled: z.boolean().optional(),
      coveredCareFundingEnabled: z.boolean().optional(),
      fundingSettings: z.record(z.unknown()).optional()
    });

    const validationResult = updateSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body",
        errors: validationResult.error.format()
      });
    }

    const updateData = validationResult.data;
    
    // Check if merchant exists
    const merchant = await storage.getMerchant(merchantId);
    
    if (!merchant) {
      return res.status(404).json({ 
        success: false, 
        message: "Merchant not found" 
      });
    }

    // Update merchant with new funding settings
    await db.update(merchants)
      .set({
        shifiFundingEnabled: updateData.shifiFundingEnabled,
        coveredCareFundingEnabled: updateData.coveredCareFundingEnabled,
        fundingSettings: updateData.fundingSettings as any
      })
      .where(eq(merchants.id, merchantId));

    // Log the change
    logger.info({
      message: "Merchant funding settings updated",
      category: "admin",
      source: "internal",
      userId: req.user?.id,
      metadata: {
        merchantId,
        updatedSettings: updateData
      }
    });

    // If enabling CoveredCare, check if we need to register the merchant with CoveredCare
    if (updateData.coveredCareFundingEnabled && 
        !merchant.coveredCareFundingEnabled && 
        coveredCareService.isInitialized()) {
      
      try {
        // Check if merchant has CoveredCare info in fundingSettings
        const existingSettings = merchant.fundingSettings as any || {};
        const coveredCareSettings = existingSettings.coveredCare || {};
        
        if (!coveredCareSettings.providerGuid) {
          // We should register the merchant with CoveredCare
          // This would typically be handled by a separate onboarding process
          logger.info({
            message: "Merchant needs to be registered with CoveredCare",
            category: "admin",
            source: "internal",
            userId: req.user?.id,
            metadata: {
              merchantId
            }
          });
        }
      } catch (integrationError) {
        // Log the error but don't fail the request
        logger.error({
          message: `Error with CoveredCare integration: ${integrationError instanceof Error ? integrationError.message : String(integrationError)}`,
          category: "api",
          source: "external",
          metadata: {
            error: integrationError instanceof Error ? integrationError.stack : null,
            merchantId
          }
        });
      }
    }

    // Return updated funding settings
    const updatedMerchant = await storage.getMerchant(merchantId);
    
    return res.status(200).json({
      success: true,
      merchantId,
      fundingSettings: {
        shifiFundingEnabled: updatedMerchant?.shifiFundingEnabled ?? true,
        coveredCareFundingEnabled: updatedMerchant?.coveredCareFundingEnabled ?? false,
        fundingSettings: updatedMerchant?.fundingSettings ?? {}
      }
    });
  } catch (error) {
    logger.error({
      message: `Error updating merchant funding settings: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null,
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to update merchant funding settings"
    });
  }
});

/**
 * Configure CoveredCare settings for a merchant
 */
router.post("/:merchantId/coveredcare-settings", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);

    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID" 
      });
    }

    // Validate request body
    const configSchema = z.object({
      providerGuid: z.string(),
      branchLocationGuid: z.string(),
      productTypeGuid: z.string().optional(),
      additionalSettings: z.record(z.unknown()).optional()
    });

    const validationResult = configSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body",
        errors: validationResult.error.format()
      });
    }

    const configData = validationResult.data;
    
    // Check if merchant exists
    const merchant = await storage.getMerchant(merchantId);
    
    if (!merchant) {
      return res.status(404).json({ 
        success: false, 
        message: "Merchant not found" 
      });
    }

    // Get existing funding settings
    const existingSettings = merchant.fundingSettings as any || {};
    
    // Update CoveredCare-specific settings
    const coveredCareSettings = {
      ...existingSettings.coveredCare,
      providerGuid: configData.providerGuid,
      branchLocationGuid: configData.branchLocationGuid,
      productTypeGuid: configData.productTypeGuid,
      ...configData.additionalSettings
    };

    // Update merchant with new funding settings
    await db.update(merchants)
      .set({
        coveredCareFundingEnabled: true, // Automatically enable CoveredCare funding
        fundingSettings: {
          ...existingSettings,
          coveredCare: coveredCareSettings
        } as any
      })
      .where(eq(merchants.id, merchantId));

    // Log the change
    logger.info({
      message: "Merchant CoveredCare settings updated",
      category: "admin",
      source: "internal",
      userId: req.user?.id,
      metadata: {
        merchantId,
        coveredCareSettings
      }
    });

    return res.status(200).json({
      success: true,
      merchantId,
      coveredCareSettings
    });
  } catch (error) {
    logger.error({
      message: `Error updating merchant CoveredCare settings: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null,
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to update merchant CoveredCare settings"
    });
  }
});

/**
 * Get all merchants with their funding settings
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const merchants = await storage.getAllMerchants();

    // Map merchants to include funding settings
    const merchantsWithFundingSettings = merchants.map(merchant => ({
      id: merchant.id,
      name: merchant.name,
      email: merchant.email,
      contactName: merchant.contactName,
      active: merchant.active,
      shifiFundingEnabled: merchant.shifiFundingEnabled ?? true,
      coveredCareFundingEnabled: merchant.coveredCareFundingEnabled ?? false,
      hasCoveredCareConfig: !!((merchant.fundingSettings as any)?.coveredCare?.providerGuid)
    }));

    return res.status(200).json({
      success: true,
      merchants: merchantsWithFundingSettings
    });
  } catch (error) {
    logger.error({
      message: `Error fetching merchants with funding settings: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null,
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to fetch merchants with funding settings"
    });
  }
});

export default router;