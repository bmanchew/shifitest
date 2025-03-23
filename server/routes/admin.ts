import express, { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { authenticateAdmin } from "../middleware/auth";
import crypto from 'crypto';
import emailService from '../services/email';

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

// Admin route to reset merchant password
adminRouter.post('/merchants/:id/reset-password', async (req: Request, res: Response) => {
  const merchantId = parseInt(req.params.id);

  try {
    // Generate a random password
    const newPassword = crypto.randomBytes(8).toString('hex');

    // Hash the password before storing
    const hashedPassword = crypto.createHash('sha256').update(newPassword).digest('hex');

    // Update the merchant's password
    await storage.updateMerchant(merchantId, { password: hashedPassword });

    // Get the merchant's email
    const merchant = await storage.getMerchant(merchantId);

    if (!merchant || !merchant.email) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Send the new password to the merchant's email
    await emailService.sendPasswordReset(merchant.email, newPassword);

    logger.info({
      message: `Password reset for merchant ${merchantId}`,
      category: 'admin',
      source: 'api'
    });

    res.json({ success: true });
  } catch (error) {
    logger.error({
      message: `Failed to reset password for merchant ${merchantId}: ${error instanceof Error ? error.message : String(error)}`,
      category: 'admin',
      source: 'api',
      metadata: {
        merchantId,
        error: error instanceof Error ? error.stack : null
      }
    });

    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

export default adminRouter;