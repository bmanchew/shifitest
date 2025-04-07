import express, { Request, Response } from "express";
import { storage } from "../../storage";
import { logger } from "../../services/logger";

const router = express.Router();

// Get all merchants
router.get("/", async (req: Request, res: Response) => {
  try {
    logger.info({
      message: "Admin requesting all merchants list",
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        path: req.path,
        method: req.method
      }
    });
    
    // Use the enhanced method to get merchants with their business details
    const merchantsWithDetails = await storage.getAllMerchantsWithDetails();
    
    // Format the response to include AI verification status
    const merchants = merchantsWithDetails.map(merchant => {
      const formattedMerchant = {
        ...merchant,
        aiVerificationStatus: merchant.businessDetails?.aiVerificationStatus || null,
        aiVerificationScore: merchant.businessDetails?.aiVerificationScore || null,
        aiVerificationDate: merchant.businessDetails?.aiVerificationDate || null,
        adminReviewed: merchant.businessDetails?.adminReviewedAt ? true : false,
        adminReviewNotes: merchant.businessDetails?.adminReviewNotes || null,
        verificationStatus: merchant.businessDetails?.verificationStatus || 'not_started'
      };
      
      // Remove the nested businessDetails to flatten the structure
      delete formattedMerchant.businessDetails;
      
      return formattedMerchant;
    });
    
    res.json({ success: true, merchants });
  } catch (error) {
    logger.error({
      message: `Error fetching merchants: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch merchants",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get pending merchants that need AI verification review
router.get("/pending-verification", async (req: Request, res: Response) => {
  try {
    logger.info({
      message: "Admin requesting merchants pending AI verification",
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        path: req.path,
        method: req.method
      }
    });
    
    // Get merchants with their business details
    const merchantsWithDetails = await storage.getAllMerchantsWithDetails();
    
    // Filter and format merchants that need admin review of AI verification
    const pendingMerchants = merchantsWithDetails
      .filter(merchant => {
        // Include merchants where AI has performed verification but admin hasn't reviewed
        return (
          merchant.businessDetails?.aiVerificationStatus && 
          !merchant.businessDetails?.adminReviewedAt
        );
      })
      .map(merchant => {
        // Format the response with AI verification data
        return {
          id: merchant.id,
          name: merchant.name,
          email: merchant.email,
          phone: merchant.phone,
          contactName: merchant.contactName,
          createdAt: merchant.createdAt,
          aiVerificationStatus: merchant.businessDetails?.aiVerificationStatus || null,
          aiVerificationScore: merchant.businessDetails?.aiVerificationScore || null,
          aiVerificationDate: merchant.businessDetails?.aiVerificationDate || null,
          aiVerificationDetails: merchant.businessDetails?.aiVerificationDetails || null,
          aiVerificationRecommendations: merchant.businessDetails?.aiVerificationRecommendations || null,
          businessType: merchant.businessDetails?.businessType || null,
          industryCategory: merchant.businessDetails?.industryCategory || null,
          yearEstablished: merchant.businessDetails?.yearEstablished || null,
          annualRevenue: merchant.businessDetails?.annualRevenue || null
        };
      });
    
    res.json({ 
      success: true, 
      pendingMerchants,
      totalCount: pendingMerchants.length
    });
  } catch (error) {
    logger.error({
      message: `Error fetching merchants pending AI verification: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch merchants pending AI verification",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Approve or reject a merchant's AI verification
router.post("/:id/review-verification", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.id);
    const { isApproved, adminReviewNotes } = req.body;
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID" 
      });
    }
    
    logger.info({
      message: `Admin reviewing AI verification for merchant ${merchantId}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        merchantId,
        isApproved,
        path: req.path,
        method: req.method
      }
    });
    
    // Get the merchant's business details
    const merchantBusinessDetails = await storage.getMerchantBusinessDetailsByMerchantId(merchantId);
    
    if (!merchantBusinessDetails) {
      return res.status(404).json({ 
        success: false, 
        message: "Merchant business details not found" 
      });
    }
    
    // Update the merchant's business details with admin review
    const updatedBusinessDetails = await storage.updateMerchantBusinessDetails(
      merchantBusinessDetails.id, 
      {
        adminReviewedAt: new Date(),
        adminReviewNotes: adminReviewNotes || null,
        verificationStatus: isApproved ? "verified" : "rejected"
      }
    );
    
    // Also update the merchant record to reflect verification status
    const merchant = await storage.getMerchant(merchantId);
    if (merchant) {
      await storage.updateMerchant(
        merchantId, 
        { 
          active: isApproved, 
          // If approved, enable funding capabilities
          shifiFundingEnabled: isApproved ? true : false
        }
      );
    }
    
    res.json({ 
      success: true, 
      message: `Merchant AI verification ${isApproved ? 'approved' : 'rejected'} successfully`,
      merchantBusinessDetails: updatedBusinessDetails
    });
  } catch (error) {
    logger.error({
      message: `Error reviewing merchant AI verification: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to review merchant AI verification",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get single merchant by ID with details
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.id);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid merchant ID format" 
      });
    }
    
    logger.info({
      message: `Admin requesting merchant details for ID ${merchantId}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        merchantId,
        path: req.path,
        method: req.method
      }
    });
    
    // Get the basic merchant information
    const merchant = await storage.getMerchant(merchantId);
    
    if (!merchant) {
      return res.status(404).json({ 
        success: false, 
        message: "Merchant not found" 
      });
    }

    // Get additional merchant details such as Plaid information and business details
    const plaidMerchant = await storage.getPlaidMerchantByMerchantId(merchantId);
    
    // Try to get business details, but handle errors gracefully
    let businessDetails = null;
    try {
      businessDetails = await storage.getMerchantBusinessDetailsByMerchantId(merchantId);
    } catch (detailsError) {
      logger.warn({
        message: `Could not fetch business details for merchant ${merchantId}: ${detailsError instanceof Error ? detailsError.message : String(detailsError)}`,
        category: "api",
        userId: req.user?.id,
        source: "internal",
        metadata: {
          merchantId,
          error: detailsError instanceof Error ? detailsError.message : String(detailsError)
        }
      });
      // Continue without business details
    }
    
    res.json({
      success: true,
      merchant,
      plaidMerchant: plaidMerchant || null,
      businessDetails: businessDetails || null
    });
  } catch (error) {
    logger.error({
      message: `Error fetching merchant details: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch merchant details",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;