import { Router, Request, Response } from 'express';
import { storage } from '../../storage';
import { logger } from '../../services/logger';
import { authenticateToken, isAdmin } from '../../middleware/auth';
import { middeskService } from '../../services/middesk';

const router = Router();

// Apply authentication and admin checks to all routes
router.use(authenticateToken);
router.use(isAdmin);

// Get all asset reports for a merchant
router.get('/:merchantId/asset-reports', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID format" 
      });
    }
    
    logger.info({
      message: `Admin requesting asset reports for merchant ${merchantId}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        merchantId,
        path: req.path,
        method: req.method
      }
    });
    
    // First, get all contracts for this merchant
    const contracts = await storage.getContractsByMerchantId(merchantId);
    
    if (!contracts || contracts.length === 0) {
      return res.json({
        success: true,
        assetReports: []
      });
    }
    
    // Get asset reports for all contracts
    let allAssetReports = [];
    for (const contract of contracts) {
      const reports = await storage.getAssetReportsByContractId(contract.id);
      if (reports && reports.length > 0) {
        allAssetReports = [...allAssetReports, ...reports];
      }
    }
    
    // Also check for any asset reports tied directly to the merchant's user ID
    const merchant = await storage.getMerchant(merchantId);
    if (merchant && merchant.userId) {
      const userReports = await storage.getAssetReportsByUserId(merchant.userId);
      if (userReports && userReports.length > 0) {
        allAssetReports = [...allAssetReports, ...userReports];
      }
    }
    
    // Sort by most recent first
    allAssetReports.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    res.json({
      success: true,
      assetReports: allAssetReports
    });
  } catch (error) {
    logger.error({
      message: `Error fetching asset reports: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        merchantId: req.params.merchantId,
        error: error instanceof Error ? error.stack : String(error),
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to fetch asset reports"
    });
  }
});

// Get business verification details for a merchant
router.get('/:merchantId/business-verification', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID format" 
      });
    }
    
    logger.info({
      message: `Admin requesting business verification details for merchant ${merchantId}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        merchantId,
        path: req.path,
        method: req.method
      }
    });
    
    // Get the merchant business details
    const businessDetails = await storage.getMerchantBusinessDetails(merchantId);
    
    if (!businessDetails || !businessDetails.middeskBusinessId) {
      return res.status(404).json({
        success: false,
        message: "No MidDesk business ID found for this merchant"
      });
    }
    
    // Get the verification details from MidDesk
    const verificationDetails = await middeskService.getBusinessDetails(businessDetails.middeskBusinessId);
    
    if (!verificationDetails) {
      return res.status(404).json({
        success: false,
        message: "No verification details found for this business ID"
      });
    }
    
    res.json({
      success: true,
      businessId: businessDetails.middeskBusinessId,
      businessName: businessDetails.legalName || "Unknown",
      verificationStatus: businessDetails.verificationStatus || "not_started",
      status: verificationDetails.status || "unknown",
      lastUpdated: verificationDetails.lastUpdated || new Date().toISOString(),
      isVerified: verificationDetails.isVerified || false,
      details: verificationDetails.details || null
    });
  } catch (error) {
    logger.error({
      message: `Error fetching business verification: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        merchantId: req.params.merchantId,
        error: error instanceof Error ? error.stack : String(error),
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to fetch business verification details"
    });
  }
});

// Initiate business verification for a merchant
router.post('/:merchantId/verify-business', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID format" 
      });
    }
    
    logger.info({
      message: `Admin initiating business verification for merchant ${merchantId}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        merchantId,
        path: req.path,
        method: req.method
      }
    });
    
    // Get the merchant business details
    const businessDetails = await storage.getMerchantBusinessDetails(merchantId);
    
    if (!businessDetails) {
      return res.status(404).json({
        success: false,
        message: "No business details found for this merchant"
      });
    }
    
    // If verification is already in progress or complete, don't initiate again
    if (businessDetails.verificationStatus === 'pending' || businessDetails.verificationStatus === 'verified') {
      return res.status(400).json({
        success: false,
        message: `Verification is already ${businessDetails.verificationStatus}`
      });
    }
    
    // Get the merchant details for required info
    const merchant = await storage.getMerchant(merchantId);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    // Prepare business data for MidDesk
    const businessData = {
      legalName: businessDetails.legalName || merchant.name,
      ein: businessDetails.ein || null,
      address: {
        line1: businessDetails.addressLine1 || merchant.address || null,
        line2: businessDetails.addressLine2 || null,
        city: businessDetails.city || null,
        state: businessDetails.state || null,
        zip: businessDetails.zipCode || null,
        country: 'US'
      },
      phone: businessDetails.phone || merchant.phone || null,
      email: merchant.email || null,
      website: businessDetails.websiteUrl || null
    };
    
    // Initiate verification with MidDesk
    const verificationResult = await middeskService.initiateBusinessVerification(businessData);
    
    if (!verificationResult || !verificationResult.businessId) {
      return res.status(500).json({
        success: false,
        message: "Failed to initiate business verification"
      });
    }
    
    // Update the business details with the MidDesk business ID and status
    await storage.updateMerchantBusinessDetails(businessDetails.id, {
      middeskBusinessId: verificationResult.businessId,
      verificationStatus: 'pending',
      updatedAt: new Date()
    });
    
    res.json({
      success: true,
      message: "Business verification initiated successfully",
      businessId: verificationResult.businessId,
      status: 'pending'
    });
  } catch (error) {
    logger.error({
      message: `Error initiating business verification: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        merchantId: req.params.merchantId,
        error: error instanceof Error ? error.stack : String(error),
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to initiate business verification"
    });
  }
});

export default router;