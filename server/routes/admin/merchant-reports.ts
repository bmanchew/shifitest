import { Router, Request, Response } from 'express';
import { storage } from '../../storage';
import { logger } from '../../services/logger';
import { authenticateToken, isAdmin } from '../../middleware/auth';
import { middeskService } from '../../services/middesk';
import { eq } from 'drizzle-orm';

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

// Update business details
router.put('/:merchantId/business-details', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID format" 
      });
    }
    
    logger.info({
      message: `Admin updating business details for merchant ${merchantId}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        merchantId,
        path: req.path,
        method: req.method
      }
    });
    
    // Get the current business details
    const businessDetails = await storage.getMerchantBusinessDetails(merchantId);
    
    if (!businessDetails) {
      return res.status(404).json({
        success: false,
        message: "No business details found for this merchant"
      });
    }
    
    const updateData = {
      legalName: req.body.legalName || businessDetails.legalName,
      ein: req.body.ein || businessDetails.ein,
      businessType: req.body.businessType || businessDetails.businessType,
      industry: req.body.industry || businessDetails.industry,
      yearFounded: req.body.yearFounded !== undefined ? req.body.yearFounded : businessDetails.yearFounded,
      annualRevenue: req.body.annualRevenue !== undefined ? req.body.annualRevenue : businessDetails.annualRevenue,
      addressLine1: req.body.addressLine1 || businessDetails.addressLine1,
      addressLine2: req.body.addressLine2 || businessDetails.addressLine2,
      city: req.body.city || businessDetails.city,
      state: req.body.state || businessDetails.state,
      zipCode: req.body.zipCode || businessDetails.zipCode,
      phone: req.body.phone || businessDetails.phone,
      websiteUrl: req.body.websiteUrl || businessDetails.websiteUrl
    };
    
    // Update the business details
    await storage.updateMerchantBusinessDetails(businessDetails.id, updateData);
    
    // Get the updated business details
    const updatedBusinessDetails = await storage.getMerchantBusinessDetails(merchantId);
    
    res.json({
      success: true,
      message: "Business details updated successfully",
      businessDetails: updatedBusinessDetails
    });
  } catch (error) {
    logger.error({
      message: `Error updating business details: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Failed to update business details"
    });
  }
});

// Generate additional MidDesk report
router.post('/:merchantId/run-middesk-report', async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID format" 
      });
    }
    
    logger.info({
      message: `Admin running additional MidDesk report for merchant ${merchantId}`,
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
    
    // Make sure business is already verified
    if (businessDetails.verificationStatus !== 'verified') {
      return res.status(400).json({
        success: false,
        message: "Business must be verified before running additional reports"
      });
    }
    
    // Run additional report with MidDesk
    const reportResult = await middeskService.runAdditionalReport(businessDetails.middeskBusinessId);
    
    if (!reportResult || !reportResult.reportId) {
      return res.status(500).json({
        success: false,
        message: "Failed to run additional MidDesk report"
      });
    }
    
    // Add a record of this report to our database
    const timestamp = new Date().toISOString();
    const reportData = {
      businessId: businessDetails.middeskBusinessId,
      reportId: reportResult.reportId,
      reportType: reportResult.reportType || 'verification',
      status: reportResult.status || 'pending',
      timestamp,
      details: reportResult.details || null
    };
    
    // We'll store this as verification data with a timestamp
    let existingData;
    try {
      existingData = businessDetails.verificationData ? JSON.parse(businessDetails.verificationData) : {};
    } catch (e) {
      existingData = {};
    }
    
    // Add new report data
    existingData.additionalReports = existingData.additionalReports || [];
    existingData.additionalReports.push(reportData);
    
    // Update business details with the new report data
    await storage.updateMerchantBusinessDetails(businessDetails.id, {
      verificationData: JSON.stringify(existingData)
    });
    
    res.json({
      success: true,
      message: "Additional MidDesk report requested successfully",
      reportId: reportResult.reportId,
      timestamp
    });
  } catch (error) {
    logger.error({
      message: `Error running additional MidDesk report: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Failed to run additional MidDesk report"
    });
  }
});

export default router;