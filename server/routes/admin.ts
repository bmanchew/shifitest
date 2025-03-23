
import express, { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { authenticateAdmin } from "../middleware/auth";

const adminRouter = express.Router();

// Middleware to ensure only admins can access these routes
adminRouter.use(authenticateAdmin);

// Get all merchants with status (including Plaid onboarding status)
adminRouter.get("/merchants", async (req: Request, res: Response) => {
  try {
    const merchants = await storage.getAllMerchants();
    
    // Get Plaid statuses for all merchants
    const merchantsWithStatus = await Promise.all(
      merchants.map(async (merchant) => {
        let status = "Not Started";
        
        // Check if merchant has Plaid integration
        const plaidMerchant = await storage.getPlaidMerchantByMerchantId(merchant.id);
        
        if (plaidMerchant) {
          status = plaidMerchant.onboardingStatus || "pending";
        }
        
        return {
          ...merchant,
          plaidStatus: status,
        };
      })
    );
    
    res.status(200).json({
      success: true,
      merchants: merchantsWithStatus,
    });
  } catch (error) {
    logger.error({
      message: `Failed to fetch merchants for admin: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
      },
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to fetch merchants",
    });
  }
});

// Get a specific merchant with all details including Plaid status
adminRouter.get("/merchants/:id", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.id);
    
    // Get merchant details
    const merchant = await storage.getMerchant(merchantId);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }
    
    // Get Plaid merchant details if available
    const plaidMerchant = await storage.getPlaidMerchantByMerchantId(merchantId);
    
    // Get merchant business details if available
    const businessDetails = await storage.getMerchantBusinessDetails(merchantId);
    
    res.status(200).json({
      success: true,
      merchant,
      plaidMerchant,
      businessDetails,
    });
  } catch (error) {
    logger.error({
      message: `Failed to fetch merchant details for admin: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.stack : String(error),
      },
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to fetch merchant details",
    });
  }
});

export default adminRouter;


import crypto from 'crypto';
import { storage } from '../storage';
import { emailService } from '../services/email';
import { logger } from '../services/logger';

// Admin route to reset merchant password
router.post('/merchants/:id/reset-password', async (req, res) => {
  try {
    const merchantId = parseInt(req.params.id);
    
    // Get merchant details
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant || !merchant.userId) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // Get user details
    const user = await storage.getUser(merchant.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Store reset token with expiration (24 hours)
    await storage.storePasswordResetToken(user.id, resetToken);

    // Send reset email
    await emailService.sendMerchantPasswordReset(
      user.email,
      merchant.contactName,  
      resetToken
    );

    await logger.info({
      message: `Password reset email sent to merchant: ${user.email}`,
      category: 'security',
      metadata: {
        merchantId: merchant.id,
        userId: user.id
      }
    });

    res.json({
      success: true,
      message: 'Password reset email sent successfully'
    });

  } catch (error) {
    await logger.error({
      message: `Error sending password reset email: ${error instanceof Error ? error.message : String(error)}`,
      category: 'security',
      metadata: { error: error instanceof Error ? error.stack : String(error) }
    });

    res.status(500).json({
      success: false,
      message: 'Failed to send password reset email'
    });
  }
});
