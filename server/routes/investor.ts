/**
 * Investor Portal API Routes
 * 
 * These routes handle the investor portal functionality including:
 * - Investor profiles and KYC verification
 * - Investment offerings
 * - Investments management
 * - Data room document access
 * 
 * The investor portal allows accredited investors to:
 * 1. Register and verify identity (KYC)
 * 2. Access confidential documents in a data room
 * 3. Select and invest in tokenized contract offerings
 * 4. Track their investments and portfolio performance
 */
import express, { Request, Response, Router } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";
import { 
  insertInvestorProfileSchema,
  insertInvestmentOfferingSchema,
  insertInvestmentSchema,
  insertDocumentLibrarySchema,
  type InsertInvestorProfile,
  type InvestorProfile,
  type InvestmentOffering,
  type InsertInvestmentOffering,
  type Investment,
  type InsertInvestment,
  type DocumentLibrary,
  type InsertDocumentLibrary,
  type User
} from "@shared/schema";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { authenticateToken, isInvestor, isAdmin } from "../middleware/auth";
import { blockchainService } from "../services/blockchain";
import { plaidService } from "../services/plaidService";
import { generateJwtToken } from "../services/auth";
import { diditService } from "../services/didit";
import emailService from "../services/email";
import crypto from "crypto";
import bcrypt from "bcrypt";

const router = express.Router();

/**
 * @route POST /api/investor/applications
 * @desc Submit a new investor application
 * @access Public - No authentication required
 */
router.post("/applications", async (req: Request, res: Response) => {
  try {
    const applicationSchema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(10),
      company: z.string().optional(),
      investmentAmount: z.string().min(1),
      investmentGoals: z.string().min(1),
      isAccredited: z.boolean(),
      agreeToTerms: z.boolean(),
    });
    
    const application = applicationSchema.parse(req.body);
    
    // Log the application
    logger.info({
      message: `New investor application received from ${application.name} (${application.email})`,
      category: "system",
      source: "internal",
      metadata: {
        email: application.email,
        name: application.name
      }
    });
    
    // Check if the email already exists
    const existingUser = await storage.getUserByEmail(application.email);
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists. Please login or use a different email address.",
        existingUser: true
      });
    }
    
    // Split name into first and last name
    const nameParts = application.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Generate a temporary password
    const temporaryPassword = crypto.randomBytes(8).toString('hex');
    
    // Hash the password before storing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(temporaryPassword, salt);
    
    // Create user account for the investor
    const user = await storage.createUser({
      email: application.email,
      firstName,
      lastName,
      name: application.name || firstName + ' ' + lastName, // Ensure name is never empty as it's NOT NULL in the database
      role: 'investor',
      password: hashedPassword,
      phone: application.phone
    });
    
    // Send welcome email with temporary password
    const emailSent = await emailService.sendInvestorWelcome(
      application.email,
      application.name,
      temporaryPassword
    );
    
    // Log email status
    logger.info({
      message: `Investor welcome email ${emailSent ? 'sent' : 'failed'} for ${application.email}`,
      category: "system",
      source: "internal",
      metadata: {
        investorEmail: application.email,
        emailSent
      }
    });
    
    // Create investor profile with the schema that matches the database
    await storage.createInvestorProfile({
      userId: user.id,
      accreditationStatus: application.isAccredited,
      verificationStatus: 'pending',
      investmentGoals: application.investmentGoals,
      kycCompleted: false,
      documentVerificationCompleted: false
    });
    
    // Generate a proper JWT token for the user
    const token = generateJwtToken(user);
    
    return res.status(201).json({
      success: true,
      message: "Application approved! Continue to verification.",
      userId: user.id,
      token
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({
        success: false,
        message: "Invalid application data",
        errors: validationError.details
      });
    }
    
    logger.error({
      message: `Error processing investor application: ${error instanceof Error ? error.message : String(error)}`,
      category: "system",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to process application"
    });
  }
});

// Apply authentication to all subsequent routes
router.use(authenticateToken);

/**
 * @route GET /api/investor/profile
 * @desc Get investor profile for the authenticated user
 * @access Private - Investor only
 */
router.get("/profile", isInvestor, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Get investor profile
    const investorProfile = await storage.getInvestorProfileByUserId(userId);

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: "Investor profile not found"
      });
    }

    res.json({
      success: true,
      profile: investorProfile
    });
  } catch (error) {
    logger.error({
      message: `Error fetching investor profile: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch investor profile"
    });
  }
});

/**
 * @route POST /api/investor/profile
 * @desc Create or update investor profile
 * @access Private - Investor only
 */
router.post("/profile", isInvestor, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check if profile already exists
    const existingProfile = await storage.getInvestorProfileByUserId(userId);

    try {
      const validatedData = insertInvestorProfileSchema.parse({
        ...req.body,
        userId
      });

      let profile: InvestorProfile;

      if (existingProfile) {
        // Update existing profile
        profile = await storage.updateInvestorProfile(existingProfile.id, validatedData);
        
        logger.info({
          message: `Investor profile updated: ${profile.id}`,
          category: "investor",
          source: "api",
          metadata: {
            profileId: profile.id,
            userId
          }
        });
      } else {
        // Create new profile
        profile = await storage.createInvestorProfile(validatedData);
        
        logger.info({
          message: `Investor profile created: ${profile.id}`,
          category: "investor",
          source: "api",
          metadata: {
            profileId: profile.id,
            userId
          }
        });
      }

      res.json({
        success: true,
        profile
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: validationError.details
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error({
      message: `Error updating investor profile: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to update investor profile"
    });
  }
});

/**
 * @route GET /api/investor/offerings
 * @desc Get all available investment offerings
 * @access Private - Investor only
 */
router.get("/offerings", isInvestor, async (req: Request, res: Response) => {
  try {
    // Get investment offerings
    const offerings = await storage.getInvestmentOfferings();

    res.json({
      success: true,
      offerings
    });
  } catch (error) {
    logger.error({
      message: `Error fetching investment offerings: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch investment offerings"
    });
  }
});

/**
 * @route GET /api/investor/offerings/:id
 * @desc Get a specific investment offering by ID
 * @access Private - Investor only
 */
router.get("/offerings/:id", isInvestor, async (req: Request, res: Response) => {
  try {
    const offeringId = parseInt(req.params.id);

    if (isNaN(offeringId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offering ID"
      });
    }

    // Get offering by ID
    const offering = await storage.getInvestmentOffering(offeringId);

    if (!offering) {
      return res.status(404).json({
        success: false,
        message: "Investment offering not found"
      });
    }

    // Get tokenized contract details if available
    let tokenDetails = null;
    if (offering.contractId) {
      const contract = await storage.getContract(offering.contractId);
      if (contract && contract.tokenId) {
        try {
          tokenDetails = await blockchainService.getTokenDetails(contract.tokenId);
        } catch (error) {
          logger.warn({
            message: `Could not fetch token details: ${error instanceof Error ? error.message : String(error)}`,
            category: "blockchain",
            source: "investor",
            metadata: {
              tokenId: contract.tokenId,
              contractId: contract.id
            }
          });
        }
      }
    }

    res.json({
      success: true,
      offering,
      tokenDetails
    });
  } catch (error) {
    logger.error({
      message: `Error fetching investment offering: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        offeringId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch investment offering"
    });
  }
});

/**
 * @route POST /api/investor/offerings
 * @desc Create a new investment offering (admin only)
 * @access Private - Admin only
 */
router.post("/offerings", isAdmin, async (req: Request, res: Response) => {
  try {
    try {
      const validatedData = insertInvestmentOfferingSchema.parse(req.body);

      // If connected to a contract, verify it exists and is tokenized
      if (validatedData.contractId) {
        const contract = await storage.getContract(validatedData.contractId);
        
        if (!contract) {
          return res.status(400).json({
            success: false,
            message: "Contract not found"
          });
        }
        
        if (contract.tokenizationStatus !== 'tokenized' || !contract.tokenId) {
          return res.status(400).json({
            success: false,
            message: "Contract must be tokenized before creating an investment offering"
          });
        }
      }

      // Create offering
      const offering = await storage.createInvestmentOffering(validatedData);
      
      logger.info({
        message: `Investment offering created: ${offering.id}`,
        category: "investor",
        source: "api",
        metadata: {
          offeringId: offering.id,
          contractId: validatedData.contractId,
          adminId: req.user?.id
        }
      });

      res.json({
        success: true,
        offering
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: validationError.details
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error({
      message: `Error creating investment offering: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to create investment offering"
    });
  }
});

/**
 * @route GET /api/investor/investments
 * @desc Get all investments for the authenticated investor
 * @access Private - Investor only
 */
router.get("/investments", isInvestor, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Get investor profile
    const investorProfile = await storage.getInvestorProfileByUserId(userId);

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: "Investor profile not found"
      });
    }

    // Get investments for this investor
    const investments = await storage.getInvestmentsByInvestorId(investorProfile.id);

    // Enrich with offering details
    const enrichedInvestments = await Promise.all(
      investments.map(async (investment) => {
        const offering = await storage.getInvestmentOffering(investment.offeringId);
        return {
          ...investment,
          offering
        };
      })
    );

    res.json({
      success: true,
      investments: enrichedInvestments
    });
  } catch (error) {
    logger.error({
      message: `Error fetching investor investments: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch investments"
    });
  }
});

/**
 * @route POST /api/investor/investments
 * @desc Create a new investment
 * @access Private - Investor only
 */
router.post("/investments", isInvestor, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Get investor profile
    const investorProfile = await storage.getInvestorProfileByUserId(userId);

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: "Investor profile not found"
      });
    }

    // Verify KYC is completed
    if (!investorProfile.kycCompleted) {
      return res.status(400).json({
        success: false,
        message: "KYC verification must be completed before investing"
      });
    }

    try {
      const validatedData = insertInvestmentSchema.parse({
        ...req.body,
        investorId: investorProfile.id
      });

      // Verify the offering exists
      const offering = await storage.getInvestmentOffering(validatedData.offeringId);
      
      if (!offering) {
        return res.status(404).json({
          success: false,
          message: "Investment offering not found"
        });
      }

      // Verify minimum investment amount
      if (validatedData.amount < offering.minimumInvestment) {
        return res.status(400).json({
          success: false,
          message: `Investment amount must be at least ${offering.minimumInvestment}`
        });
      }

      // Verify there's enough available amount
      if (validatedData.amount > offering.availableAmount) {
        return res.status(400).json({
          success: false,
          message: `Only ${offering.availableAmount} is available for investment`
        });
      }

      // Calculate expected return based on offering type and amount
      let expectedReturn = 0;
      if (offering.offeringType === 'fixed_15_percent') {
        // 15% APY for 2 years
        expectedReturn = validatedData.amount * 0.15 * 2;
      } else if (offering.offeringType === 'fixed_18_percent') {
        // 18% APY for 4 years
        expectedReturn = validatedData.amount * 0.18 * 4;
      }

      // Create investment with calculated return
      const investment = await storage.createInvestment({
        ...validatedData,
        expectedReturn,
        status: 'pending',
        investmentDate: new Date(),
        // Calculate maturity date based on offering term
        maturityDate: new Date(Date.now() + (offering.termLength * 30 * 24 * 60 * 60 * 1000))
      });

      // Update available amount in offering
      await storage.updateInvestmentOffering(offering.id, {
        availableAmount: offering.availableAmount - validatedData.amount
      });
      
      logger.info({
        message: `Investment created: ${investment.id}`,
        category: "investor",
        source: "api",
        metadata: {
          investmentId: investment.id,
          investorId: investorProfile.id,
          offeringId: offering.id,
          amount: validatedData.amount
        }
      });

      res.json({
        success: true,
        investment
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: validationError.details
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error({
      message: `Error creating investment: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to create investment"
    });
  }
});

/**
 * @route GET /api/investor/investments/:id
 * @desc Get a specific investment by ID
 * @access Private - Investor only
 */
router.get("/investments/:id", isInvestor, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const investmentId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    if (isNaN(investmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid investment ID"
      });
    }

    // Get investor profile
    const investorProfile = await storage.getInvestorProfileByUserId(userId);

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: "Investor profile not found"
      });
    }

    // Get investment by ID
    const investment = await storage.getInvestment(investmentId);

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: "Investment not found"
      });
    }

    // Verify this investment belongs to the authenticated investor
    if (investment.investorId !== investorProfile.id) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to this investment"
      });
    }

    // Get associated offering
    const offering = await storage.getInvestmentOffering(investment.offeringId);

    res.json({
      success: true,
      investment: {
        ...investment,
        offering
      }
    });
  } catch (error) {
    logger.error({
      message: `Error fetching investment: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        investmentId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch investment"
    });
  }
});

/**
 * @route POST /api/investor/plaid/create-link-token
 * @desc Create a Plaid link token for bank account connection
 * @access Private - Investor only
 */
router.post("/plaid/create-link-token", isInvestor, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Get investor profile
    const investorProfile = await storage.getInvestorProfileByUserId(userId);

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: "Investor profile not found"
      });
    }

    // Create a Plaid link token
    const linkTokenResponse = await plaidService.createLinkToken(userId);

    logger.info({
      message: `Created Plaid link token for investor ${investorProfile.id}`,
      category: "plaid",
      action: "create_link_token",
      metadata: { userId }
    });

    return res.json({
      success: true,
      linkToken: linkTokenResponse.link_token,
      expiration: linkTokenResponse.expiration
    });
  } catch (error) {
    logger.error({
      message: `Error creating Plaid link token: ${error instanceof Error ? error.message : String(error)}`,
      category: "plaid",
      action: "create_link_token_error",
      metadata: { userId: req.user?.id }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to create Plaid link token"
    });
  }
});

/**
 * @route POST /api/investor/plaid/exchange-token
 * @desc Exchange a Plaid public token for an access token and store it
 * @access Private - Investor only
 */
router.post("/plaid/exchange-token", isInvestor, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Validate request body
    const exchangeSchema = z.object({
      publicToken: z.string(),
      accountId: z.string(),
      accountName: z.string(),
      accountType: z.string(),
      institution: z.string()
    });

    const { publicToken, accountId, accountName, accountType, institution } = exchangeSchema.parse(req.body);

    // Get investor profile
    const investorProfile = await storage.getInvestorProfileByUserId(userId);

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: "Investor profile not found"
      });
    }

    // Exchange the public token for an access token
    const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);

    // Get account information to verify the account
    const accountInfo = await plaidService.getAccountInfo(accessToken);

    // Format linked account data
    const linkedAccount = {
      plaidItemId: itemId,
      plaidAccessToken: accessToken,
      accountId,
      accountName,
      accountType,
      institution,
      lastVerified: new Date()
    };

    // Update investor profile with linked account
    const updatedProfile = await storage.updateInvestorProfile(investorProfile.id, {
      linkedAccounts: [...(investorProfile.linkedAccounts || []), linkedAccount]
    });

    logger.info({
      message: `Bank account successfully linked for investor ${investorProfile.id}`,
      category: "plaid",
      action: "link_account_success",
      metadata: { userId }
    });

    return res.json({
      success: true,
      message: "Bank account successfully linked",
      linkedAccounts: updatedProfile.linkedAccounts
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationError.details
      });
    }

    logger.error({
      message: `Error exchanging Plaid token: ${error instanceof Error ? error.message : String(error)}`,
      category: "plaid",
      action: "exchange_token_error",
      metadata: { userId: req.user?.id }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to link bank account"
    });
  }
});

/**
 * @route GET /api/investor/documents
 * @desc Get all documents in the data room
 * @access Private - Investor only
 */
router.get("/documents", isInvestor, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Get investor profile
    const investorProfile = await storage.getInvestorProfileByUserId(userId);

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: "Investor profile not found"
      });
    }

    // Check if NDA is signed
    if (!investorProfile.documentVerificationCompleted) {
      return res.status(403).json({
        success: false,
        message: "NDA must be signed before accessing documents"
      });
    }

    // Get all documents
    const documents = await storage.getDocumentLibrary();

    // Filter documents based on access rights
    // Public documents + those that don't require NDA
    const accessibleDocuments = documents.filter(
      doc => doc.isPublic || !doc.requiresNda
    );

    res.json({
      success: true,
      documents: accessibleDocuments
    });
  } catch (error) {
    logger.error({
      message: `Error fetching documents: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch documents"
    });
  }
});

/**
 * @route GET /api/investor/documents/:id
 * @desc Get a specific document by ID
 * @access Private - Investor only
 */
router.get("/documents/:id", isInvestor, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const documentId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    if (isNaN(documentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID"
      });
    }

    // Get investor profile
    const investorProfile = await storage.getInvestorProfileByUserId(userId);

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: "Investor profile not found"
      });
    }

    // Check if NDA is signed if required
    if (!investorProfile.documentVerificationCompleted) {
      return res.status(403).json({
        success: false,
        message: "NDA must be signed before accessing documents"
      });
    }

    // Get document by ID
    const document = await storage.getDocumentLibraryItem(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    // Check if document requires NDA and if user has signed it
    if (document.requiresNda && !investorProfile.documentVerificationCompleted) {
      return res.status(403).json({
        success: false,
        message: "NDA must be signed before accessing this document"
      });
    }

    // Generate temporary signed URL for document download
    // In a real implementation, this would use AWS S3 or similar service
    // For now, we'll just return the file_url directly
    const downloadUrl = document.fileUrl;

    res.json({
      success: true,
      document,
      downloadUrl
    });
  } catch (error) {
    logger.error({
      message: `Error fetching document: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        documentId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch document"
    });
  }
});

/**
 * @route POST /api/investor/documents
 * @desc Add a new document to the data room (admin only)
 * @access Private - Admin only
 */
router.post("/documents", isAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    try {
      const validatedData = insertDocumentLibrarySchema.parse({
        ...req.body,
        uploadedBy: userId
      });

      // Create document
      const document = await storage.createDocumentLibraryItem(validatedData);
      
      logger.info({
        message: `Document added to library: ${document.id}`,
        category: "investor",
        source: "api",
        metadata: {
          documentId: document.id,
          adminId: userId,
          fileName: document.fileName
        }
      });

      res.json({
        success: true,
        document
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: validationError.details
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error({
      message: `Error adding document: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to add document"
    });
  }
});

/**
 * @route POST /api/investor/kyc/create-session
 * @desc Create a Didit KYC verification session
 * @access Private - Investor only
 */
router.post("/kyc/create-session", isInvestor, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Get investor profile
    const investorProfile = await storage.getInvestorProfileByUserId(userId);

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: "Investor profile not found"
      });
    }

    // Check if Didit service is available
    if (!diditService.isInitialized()) {
      return res.status(503).json({
        success: false,
        message: "KYC verification service is not available at this time",
        serviceUnavailable: true
      });
    }

    // Create a verification session
    const callbackUrl = `${process.env.PUBLIC_URL || req.headers.origin}/investor/verify/kyc/success`;
    
    const sessionOptions = {
      contractId: investorProfile.id.toString(), // Using investorId as contractId
      callbackUrl,
      customFields: {
        userId: userId.toString(),
        investorId: investorProfile.id.toString(),
        email: req.user?.email || ""
      }
    };

    try {
      const session = await diditService.createVerificationSession(sessionOptions);

      if (!session) {
        logger.error({
          message: "DiDit verification session creation returned null",
          category: "api",
          source: "investor",
          metadata: {
            userId,
            investorId: investorProfile.id
          }
        });
        
        return res.status(503).json({
          success: false,
          message: "Identity verification service is temporarily unavailable. Please try again later.",
          errorCode: "VERIFICATION_SERVICE_ERROR",
          retryable: true
        });
      }

      if (!session.session_url) {
        logger.error({
          message: "DiDit verification session created but missing URL",
          category: "api",
          source: "investor",
          metadata: {
            userId,
            investorId: investorProfile.id,
            sessionId: session.session_id
          }
        });
        
        return res.status(500).json({
          success: false,
          message: "Unable to generate verification URL. Please contact support.",
          errorCode: "VERIFICATION_URL_MISSING"
        });
      }

    // Update the investor profile with session information
    await storage.updateInvestorProfile(investorProfile.id, {
      verificationStatus: 'pending',
      verificationSessionId: session.session_id
    });

    logger.info({
      message: `DiDit KYC session created for investor: ${investorProfile.id}`,
      category: "investor",
      source: "didit",
      metadata: {
        investorId: investorProfile.id,
        userId,
        sessionId: session.session_id
      }
    });

    res.json({
      success: true,
      sessionUrl: session.session_url,
      sessionId: session.session_id
    });
    } catch (innerError) {
      logger.error({
        message: `Error in DiDit session creation process: ${innerError instanceof Error ? innerError.message : String(innerError)}`,
        category: "api",
        source: "investor",
        metadata: {
          userId,
          investorId: investorProfile.id,
          error: innerError instanceof Error ? innerError.stack : undefined
        }
      });
      
      return res.status(500).json({
        success: false,
        message: "An unexpected error occurred during verification setup",
        errorCode: "VERIFICATION_SETUP_ERROR"
      });
    }
  } catch (error) {
    logger.error({
      message: `Error creating DiDit KYC session: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to create verification session"
    });
  }
});

/**
 * @route GET /api/investor/kyc/session/:sessionId
 * @desc Get the status of a Didit KYC verification session
 * @access Private - Investor only
 */
router.get("/kyc/session/:sessionId", isInvestor, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Get investor profile
    const investorProfile = await storage.getInvestorProfileByUserId(userId);

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: "Investor profile not found"
      });
    }

    // Ensure the session belongs to this investor
    if (investorProfile.verificationSessionId !== sessionId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to access this session"
      });
    }

    // Check session status
    const sessionStatus = await diditService.getVerificationSessionStatus(sessionId);

    if (!sessionStatus) {
      return res.status(404).json({
        success: false,
        message: "Session not found"
      });
    }

    // If session is completed and approved, update the investor profile
    if (sessionStatus.status === 'completed' && sessionStatus.decision?.status === 'approved') {
      await storage.updateInvestorProfile(investorProfile.id, {
        verificationStatus: 'approved',
        kycCompleted: true
      });
    }

    res.json({
      success: true,
      status: sessionStatus
    });
  } catch (error) {
    logger.error({
      message: `Error getting DiDit KYC session status: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        userId: req.user?.id,
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to get verification session status"
    });
  }
});

/**
 * @route POST /api/investor/kyc/webhook
 * @desc Handle Didit KYC verification webhook events
 * @access Public - No authentication required, uses signature validation
 */
router.post("/kyc/webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-didit-signature'] as string;
    const event = req.body;

    if (!event || !event.session_id) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload"
      });
    }

    // Process the webhook event
    const result = diditService.processWebhookEvent(event, signature);

    // Log event receipt
    logger.info({
      message: `DiDit webhook received: ${event.event_type}`,
      category: "investor",
      source: "didit",
      metadata: {
        sessionId: event.session_id,
        eventType: event.event_type,
        verified: result.isVerified
      }
    });

    // If the event is a verification completion and the verification is successful
    if (result.isCompleted && result.isApproved) {
      // Find the investor profile with this session ID
      const investorProfiles = await storage.getInvestorProfilesBySessionId(event.session_id);

      if (investorProfiles && investorProfiles.length > 0) {
        const investorProfile = investorProfiles[0];
        
        // Update the investor profile as verified
        await storage.updateInvestorProfile(investorProfile.id, {
          verificationStatus: 'approved',
          kycCompleted: true
        });

        logger.info({
          message: `Investor KYC automatically approved via DiDit webhook: ${investorProfile.id}`,
          category: "investor",
          source: "didit",
          metadata: {
            investorId: investorProfile.id,
            sessionId: event.session_id
          }
        });
      }
    }

    // Acknowledge receipt of the webhook
    res.status(200).json({
      success: true,
      message: "Webhook processed successfully"
    });
  } catch (error) {
    logger.error({
      message: `Error processing DiDit webhook: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        error: error instanceof Error ? error.stack : undefined
      }
    });

    // Still return 200 to acknowledge receipt even if processing failed
    res.status(200).json({
      success: true,
      message: "Webhook received, but processing failed"
    });
  }
});

/**
 * @route POST /api/investor/kyc/verify
 * @desc Update investor KYC verification status (manual admin override)
 * @access Private - Admin only
 */
router.post("/kyc/verify", isAdmin, async (req: Request, res: Response) => {
  try {
    const { investorId, status, message } = req.body;

    if (!investorId || !status) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: investorId and status"
      });
    }

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'requires_additional_info'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Get investor profile
    const investorProfile = await storage.getInvestorProfile(investorId);

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: "Investor profile not found"
      });
    }

    // Update verification status
    const updatedProfile = await storage.updateInvestorProfile(investorId, {
      verificationStatus: status,
      kycCompleted: status === 'approved'
    });

    // Update KYC completed if approved
    if (status === 'approved') {
      await storage.updateInvestorProfile(investorId, {
        kycCompleted: true
      });
    }

    logger.info({
      message: `Investor KYC verification status manually updated by admin: ${investorId}`,
      category: "investor",
      source: "api",
      metadata: {
        investorId,
        status,
        adminId: req.user?.id
      }
    });

    res.json({
      success: true,
      profile: updatedProfile
    });
  } catch (error) {
    logger.error({
      message: `Error updating KYC status: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "investor",
      metadata: {
        investorId: req.body.investorId,
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : undefined
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to update KYC status"
    });
  }
});

// Import accreditation module and setup routes
import { setupInvestorRoutes } from "./investor/index";
setupInvestorRoutes(router, storage);

export default router;