
import { Router } from "express";
import { merchantAnalyticsService } from "../services/merchantAnalytics";
import { authenticateToken, isAdmin, isMerchantUser } from "../routes";

const router = Router();

// Get merchant performance (merchant's own performance)
router.get("/merchant-performance", authenticateToken, isMerchantUser, async (req, res) => {
  try {
    const merchantId = req.user?.merchantId;
    
    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID not found" });
    }
    
    const performance = await merchantAnalyticsService.getMerchantPerformance(merchantId);
    
    // For merchants, only return grade and basic stats
    const merchantView = {
      grade: performance.grade,
      performanceScore: performance.performanceScore,
      totalContracts: performance.totalContracts,
      activeContracts: performance.activeContracts,
      completedContracts: performance.completedContracts,
      lastUpdated: performance.lastUpdated
    };
    
    res.json(merchantView);
  } catch (error) {
    console.error("Error fetching merchant performance:", error);
    res.status(500).json({ error: "Failed to fetch merchant performance" });
  }
});

// Admin routes for merchant performance

// Get all merchant performances
router.get("/admin/merchant-performances", authenticateToken, isAdmin, async (req, res) => {
  try {
    const performances = await merchantAnalyticsService.getAllMerchantPerformances();
    res.json(performances);
  } catch (error) {
    console.error("Error fetching all merchant performances:", error);
    res.status(500).json({ error: "Failed to fetch merchant performances" });
  }
});

// Get detailed merchant performance by ID
router.get("/admin/merchant-performance/:merchantId", authenticateToken, isAdmin, async (req, res) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ error: "Invalid merchant ID" });
    }
    
    const performance = await merchantAnalyticsService.getMerchantPerformance(merchantId);
    res.json(performance);
  } catch (error) {
    console.error("Error fetching detailed merchant performance:", error);
    res.status(500).json({ error: "Failed to fetch merchant performance details" });
  }
});

// Update specific merchant performance
router.post("/admin/update-merchant-performance/:merchantId", authenticateToken, isAdmin, async (req, res) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ error: "Invalid merchant ID" });
    }
    
    await merchantAnalyticsService.updateMerchantPerformance(merchantId);
    res.json({ success: true, message: "Merchant performance updated successfully" });
  } catch (error) {
    console.error("Error updating merchant performance:", error);
    res.status(500).json({ error: "Failed to update merchant performance" });
  }
});

// Update all merchant performances
router.post("/admin/update-all-merchant-performances", authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await merchantAnalyticsService.updateAllMerchantPerformances();
    res.json({ success: true, message: `Updated ${result.count} merchant performances` });
  } catch (error) {
    console.error("Error updating all merchant performances:", error);
    res.status(500).json({ error: "Failed to update merchant performances" });
  }
});

export default router;
