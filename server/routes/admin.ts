
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
