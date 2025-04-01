import express, { Request, Response } from 'express';
import multer from 'multer';
import { storage } from '../storage';
import { plaidService } from '../services/plaid';
import { diditService } from '../services/didit';
import { middeskService } from '../services/middesk';
import { logger } from '../services/logger';
import emailService from '../services/email';
import crypto from 'crypto';
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { insertMerchantSchema } from '../../shared/schemas/merchant.schema';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all merchants with proper error handling
router.get("/", async (req: Request, res: Response) => {
  try {
    const merchants = await storage.getAllMerchants();
    return res.json({
      success: true,
      merchants
    });
  } catch (error) {
    logger.error({
      message: `Error fetching all merchants: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch merchants"
    });
  }
});

// Create a new merchant with proper validation
router.post("/", async (req: Request, res: Response) => {
  try {
    const merchantData = insertMerchantSchema.parse(req.body);

    // If there's a userId, make sure the user exists and has role 'merchant'
    if (merchantData.userId) {
      const user = await storage.getUser(merchantData.userId);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }
      if (user.role !== "merchant") {
        return res.status(400).json({ 
          success: false, 
          message: "User is not a merchant" 
        });
      }
    }

    const newMerchant = await storage.createMerchant(merchantData);

    // Create log for merchant creation
    await logger.info({
      message: `Merchant created: ${newMerchant.name}`,
      category: "api",
      source: "internal",
      metadata: {
        id: newMerchant.id,
        email: newMerchant.email,
      }
    });

    return res.status(201).json({
      success: true,
      merchant: newMerchant
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedError = fromZodError(error);
      return res
        .status(400)
        .json({ 
          success: false, 
          message: "Validation error", 
          errors: formattedError 
        });
    }
    
    logger.error({
      message: `Create merchant error: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        requestBody: JSON.stringify(req.body)
      }
    });
    
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

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
    
    // Extract business address from request if available
    const businessAddress = req.body.streetAddress ? {
      line1: req.body.streetAddress,
      line2: req.body.streetAddress2 || null,
      city: req.body.city || '',
      state: req.body.state || '',
      postal_code: req.body.zipCode || '',
      country: 'US',
      address_type: 'business'
    } : null;
    
    // Start MidDesk business verification
    let middeskBusinessId = null;
    let businessVerificationStarted = false;
    
    try {
      if (middeskService.isInitialized()) {
        // Create MidDesk business verification request
        const middeskResponse = await middeskService.createBusinessVerification({
          name: legalBusinessName,
          tax_id: ein,
          phone: phone,
          addresses: businessAddress ? [businessAddress] : undefined,
          persons: [{
            first_name: firstName,
            last_name: lastName,
            email: email,
            title: 'Owner'
          }],
          external_id: merchant.id.toString(),
          metadata: {
            merchant_id: merchant.id.toString(),
            monthly_revenue: monthlyRevenue.toString()
          }
        });
        
        if (middeskResponse) {
          middeskBusinessId = middeskResponse.id;
          businessVerificationStarted = true;
          
          logger.info({
            message: 'MidDesk business verification initiated successfully',
            category: 'api',
            source: 'internal',
            metadata: {
              merchantId: merchant.id,
              middeskBusinessId,
              status: middeskResponse.status
            }
          });
          
          // Store the MidDesk business ID with the merchant for future reference
          await storage.updateMerchantBusinessDetails(merchant.id, {
            middeskBusinessId,
            verificationStatus: 'pending'
          });
        }
      } else {
        logger.warn({
          message: 'MidDesk service not initialized, skipping business verification',
          category: 'api',
          source: 'internal',
          metadata: { merchantId: merchant.id }
        });
      }
    } catch (middeskError) {
      // Log the error but continue with KYC verification
      logger.error({
        message: `MidDesk business verification failed: ${middeskError instanceof Error ? middeskError.message : String(middeskError)}`,
        category: 'api',
        source: 'internal',
        metadata: {
          merchantId: merchant.id,
          error: middeskError instanceof Error ? middeskError.stack : String(middeskError)
        }
      });
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
      monthlyRevenue: monthlyRevenue,
      businessVerificationStarted: businessVerificationStarted,
      businessVerificationId: middeskBusinessId
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

// Get merchant by ID with better error handling
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.id);
    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID format" 
      });
    }

    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({ 
        success: false,
        message: "Merchant not found" 
      });
    }

    return res.json({
      success: true,
      merchant
    });
  } catch (error) {
    logger.error({
      message: `Error fetching merchant: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to fetch merchant details"
    });
  }
});

// Update merchant with enhanced error handling
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.id);
    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID format" 
      });
    }

    // Validate merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({ 
        success: false,
        message: "Merchant not found" 
      });
    }

    // Extract fields to update
    const updateData = {};
    const allowedFields = ['name', 'contactName', 'email', 'phone', 'address', 'active'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update"
      });
    }

    // Update the merchant
    const updatedMerchant = await storage.updateMerchant(merchantId, updateData);

    // Log the successful update
    logger.info({
      message: `Merchant ${merchantId} updated successfully`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId,
        fields: Object.keys(updateData)
      }
    });

    return res.json({
      success: true,
      merchant: updatedMerchant
    });
  } catch (error) {
    logger.error({
      message: `Error updating merchant: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: req.params.id,
        requestBody: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to update merchant"
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

// Route to get merchant contracts
router.get('/:id/contracts', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.id);

    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID format"
      });
    }

    // Get all contracts for this merchant using the storage method
    const allContracts = await storage.getContractsByMerchantId(merchantId);
    
    // Filter to only include active contracts
    const activeContracts = allContracts.filter(contract => contract.status === "active");

    // Return the filtered contracts array
    res.json(activeContracts || []);
  } catch (error) {
    console.error('Error fetching merchant contracts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve merchant contracts'
    });
  }
});

// Add endpoint to submit a business for verification
router.post('/:id/submit-verification', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.id);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID format"
      });
    }

    // First, get the merchant's business details
    const merchantDetails = await storage.getMerchantBusinessDetailsByMerchantId(merchantId);

    if (!merchantDetails) {
      return res.status(404).json({
        success: false,
        message: "Merchant business details not found"
      });
    }

    // Check if the business is already verified
    if (merchantDetails.middeskBusinessId) {
      return res.status(400).json({
        success: false,
        message: "Business verification has already been submitted",
        verificationStatus: merchantDetails.verificationStatus,
        middeskBusinessId: merchantDetails.middeskBusinessId
      });
    }

    // Make sure MidDesk service is initialized
    if (!middeskService.isInitialized()) {
      return res.status(503).json({
        success: false,
        message: "MidDesk service not available"
      });
    }

    // Submit business to MidDesk for verification
    const verificationResult = await middeskService.submitBusinessVerification({
      legalName: merchantDetails.legalName || '',
      ein: merchantDetails.ein || '',
      addressLine1: merchantDetails.addressLine1 || '',
      addressLine2: merchantDetails.addressLine2 || '',
      city: merchantDetails.city || '',
      state: merchantDetails.state || '',
      zipCode: merchantDetails.zipCode || '',
      phoneNumber: merchantDetails.phone || '',
      businessType: merchantDetails.businessStructure || 'LLC',
      website: merchantDetails.websiteUrl || ''
    });

    if (!verificationResult || !verificationResult.id) {
      return res.status(500).json({
        success: false,
        message: "Failed to submit business for verification"
      });
    }

    // Update the merchant business details with MidDesk business ID and status
    await storage.updateMerchantBusinessDetailsByMerchantId(merchantId, {
      middeskBusinessId: verificationResult.id,
      verificationStatus: 'pending',
      verificationData: JSON.stringify(verificationResult)
    });

    // Return success response
    return res.json({
      success: true,
      message: "Business verification submitted successfully",
      middeskBusinessId: verificationResult.id,
      verificationStatus: 'pending'
    });

  } catch (error) {
    logger.error({
      message: `Error submitting business verification: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to submit business verification"
    });
  }
});

// Route to check MidDesk business verification status
router.get('/:id/business-verification', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.id);

    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID format"
      });
    }

    // First, get the merchant's business details to retrieve the MidDesk business ID
    const merchantDetails = await storage.getMerchantBusinessDetailsByMerchantId(merchantId);

    if (!merchantDetails) {
      return res.status(404).json({
        success: false,
        message: "Merchant business details not found"
      });
    }

    // Check if MidDesk verification was initiated
    if (!merchantDetails.middeskBusinessId) {
      return res.json({
        success: true,
        verificationStatus: "not_started",
        message: "Business verification has not been initiated yet"
      });
    }

    // Check if MidDesk service is initialized
    if (!middeskService.isInitialized()) {
      return res.status(503).json({
        success: false,
        message: "MidDesk service not available",
        verificationStatus: merchantDetails.verificationStatus || "unknown"
      });
    }

    // Get the verification status from MidDesk
    const businessVerification = await middeskService.getBusinessVerificationStatus(
      merchantDetails.middeskBusinessId
    );

    if (!businessVerification) {
      return res.status(404).json({
        success: false,
        message: "Business verification details not found on MidDesk",
        verificationStatus: merchantDetails.verificationStatus || "unknown"
      });
    }

    // Map MidDesk status to our internal status
    const internalStatus = middeskService.mapVerificationStatus(businessVerification.status);
    
    // Check if status has changed since we last updated our records
    if (internalStatus !== merchantDetails.verificationStatus) {
      // Update the merchant business details with new status
      await storage.updateMerchantBusinessDetailsByMerchantId(merchantId, {
        verificationStatus: internalStatus
      });
    }

    return res.json({
      success: true,
      verificationStatus: internalStatus,
      businessId: businessVerification.id,
      businessName: businessVerification.name,
      status: businessVerification.status,
      lastUpdated: businessVerification.updated_at,
      isVerified: middeskService.isBusinessVerified(businessVerification)
    });

  } catch (error) {
    logger.error({
      message: `Error checking business verification status: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to check business verification status"
    });
  }
});

export default router;