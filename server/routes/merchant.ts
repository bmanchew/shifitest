
import express from 'express';
import multer from 'multer';
import { storage } from '../storage';
import { plaidService } from '../services/plaid';
import { diditService } from '../services/didit';
import { logger } from '../services/logger';
import emailService from '../services/email';
import crypto from 'crypto';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/signup', upload.any(), async (req, res) => {
  try {
    const { 
      firstName, lastName, email, phone, companyName,
      legalBusinessName, ein, businessStructure,
      plaidPublicToken, plaidAccountId
    } = req.body;

    // First verify revenue requirements using Plaid
    if (!plaidPublicToken || !plaidAccountId) {
      return res.status(400).json({
        success: false,
        message: "Bank account verification required for merchant onboarding"
      });
    }

    // Exchange public token for access token
    const { accessToken } = await plaidService.exchangePublicToken(plaidPublicToken);

    // Create asset report for 2 years of data
    const assetReport = await plaidService.createAssetReport(accessToken, 730); // 2 years
    
    // Analyze the asset report for revenue verification
    const analysis = await plaidService.analyzeAssetReportForUnderwriting(assetReport.assetReportToken);

    // Calculate average monthly revenue
    const monthlyRevenue = analysis?.income?.monthlyIncome || 0;
    const hasRequiredHistory = analysis?.employment?.employmentMonths >= 24;

    if (monthlyRevenue < 100000 || !hasRequiredHistory) {
      return res.status(400).json({
        success: false,
        message: "Merchant does not meet minimum revenue requirements of $100k/month for 2 years",
        monthlyRevenue,
        monthsHistory: analysis?.employment?.employmentMonths
      });
    }

    // Generate a temporary password for the merchant
    const temporaryPassword = crypto.randomBytes(6).toString('hex');
    
    // First create a user account with merchant role
    const newUser = await storage.createUser({
      email,
      password: temporaryPassword,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`, // For backward compatibility
      role: 'merchant',
      phone
    });
    
    // Create merchant record associated with the user
    const merchant = await storage.createMerchant({
      name: companyName,
      contactName: `${firstName} ${lastName}`,
      email,
      phone,
      userId: newUser.id // Link merchant to user account
    });

    // Send welcome email with credentials
    await emailService.sendMerchantWelcome(
      email,
      `${firstName} ${lastName}`,
      temporaryPassword
    );

    // Log email sent
    await logger.info({
      message: `Welcome email sent to merchant: ${email}`,
      category: 'system',
      source: 'internal',
      metadata: {
        emailInfo: JSON.stringify({
          merchantId: merchant.id,
          userId: newUser.id,
          template: 'merchant_welcome'
        })
      }
    });

    // Store business details
    await storage.createMerchantBusinessDetails({
      merchantId: merchant.id,
      legalName: legalBusinessName,
      ein,
      businessStructure,
      // Add other fields as needed
    });

    // Process file uploads if any
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const files = req.files as Express.Multer.File[];
      for (const file of files) {
        // Ensure we have a buffer before trying to convert it
        if (file.buffer) {
          await storage.createMerchantDocument({
            merchantId: merchant.id,
            type: file.fieldname,
            data: file.buffer.toString('base64'), // Convert Buffer to base64 string
            filename: file.originalname
          });
        }
      }
    }

    // Initiate KYC verification with DiDit
    const kycSession = await diditService.createVerificationSession({
      contractId: merchant.id.toString(),
      callbackUrl: `${req.protocol}://${req.get('host')}/api/kyc/webhook`,
      requiredFields: ['first_name', 'last_name', 'date_of_birth', 'document_number']
    });

    if (!kycSession) {
      throw new Error('Failed to create KYC verification session');
    }

    res.json({
      success: true,
      merchantId: merchant.id,
      kycSessionUrl: kycSession.session_url,
      revenueVerified: true,
      monthlyRevenue: monthlyRevenue
    });

  } catch (error) {
    logger.error({
      message: `Error in merchant signup: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: { 
        errorDetails: error instanceof Error ? error.stack : String(error) 
      }
    });

    res.status(500).json({
      success: false,
      message: 'Failed to complete merchant signup'
    });
  }
});

// Test email route (for development purposes)
router.post('/test-email', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email and name are required'
      });
    }
    
    // Generate a test password
    const testPassword = crypto.randomBytes(6).toString('hex');
    
    // Send a test welcome email
    const emailSent = await emailService.sendMerchantWelcome(
      email,
      name,
      testPassword
    );
    
    if (emailSent) {
      await logger.info({
        message: `Test welcome email sent to: ${email}`,
        category: 'system',
        source: 'internal',
        metadata: {
          emailInfo: JSON.stringify({
            template: 'merchant_welcome',
            testMode: true
          })
        }
      });
      
      res.json({
        success: true,
        message: 'Test email sent successfully',
        recipient: email,
        tempPassword: testPassword
      });
    } else {
      throw new Error('Failed to send test email');
    }
  } catch (error) {
    await logger.error({
      message: `Error sending test email: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      source: 'internal',
      metadata: { 
        errorDetails: error instanceof Error ? error.stack : String(error) 
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to send test email'
    });
  }
});

export default router;
