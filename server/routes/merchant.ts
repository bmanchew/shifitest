
import express from 'express';
import multer from 'multer';
import { storage } from '../storage';
import { plaidService } from '../services/plaid';
import { diditService } from '../services/didit';
import { logger } from '../services/logger';

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

    // Create merchant record
    const merchant = await storage.createMerchant({
      name: companyName,
      contactName: `${firstName} ${lastName}`,
      email,
      phone
    });

    // Store business details
    await storage.createMerchantBusinessDetails({
      merchantId: merchant.id,
      legalName: legalBusinessName,
      ein,
      businessStructure,
      // Add other fields as needed
    });

    // Process file uploads
    const files = req.files as Express.Multer.File[];
    for (const file of files) {
      await storage.createMerchantDocument({
        merchantId: merchant.id,
        type: file.fieldname,
        data: file.buffer,
        filename: file.originalname
      });
    }

    // Initiate KYC verification with DiDit
    const kycSession = await diditService.createVerificationSession({
      contractId: merchant.id.toString(),
      callbackUrl: `${req.protocol}://${req.get('host')}/api/kyc/webhook`,
      requiredFields: ['first_name', 'last_name', 'date_of_birth', 'document_number']
    });

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
      source: 'merchant',
      metadata: { error: error instanceof Error ? error.stack : null }
    });

    res.status(500).json({
      success: false,
      message: 'Failed to complete merchant signup'
    });
  }
});

export default router;
