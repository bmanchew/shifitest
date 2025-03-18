
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
      legalBusinessName, ein, businessStructure
    } = req.body;

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
      kycSessionUrl: kycSession.session_url
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
