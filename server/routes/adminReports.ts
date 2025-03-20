
import express, { Request, Response } from "express";
import { storage } from "../storage";
import { cfpbService } from "../services/cfpbService";
import { portfolioMonitorService } from "../services/portfolioMonitor";
import { aiAnalyticsService } from "../services/aiAnalytics";
import { logger } from "../services/logger";

export const adminReportsRouter = express.Router();

// Get CFPB complaint trends
adminReportsRouter.get("/cfpb-trends", async (req: Request, res: Response) => {
  try {
    const complaintTrends = await cfpbService.getComplaintTrends();
    
    res.json({
      success: true,
      data: complaintTrends
    });
  } catch (error) {
    logger.error({
      message: `Failed to get CFPB complaint trends: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get CFPB complaint trends"
    });
  }
});

// Get AI analytics data
adminReportsRouter.get("/ai-analytics", async (req: Request, res: Response) => {
  try {
    // First try to get real analytics, fallback to mock data
    try {
      const analyticsData = await aiAnalyticsService.analyzeComplaintTrends();
      res.json({
        success: true,
        data: analyticsData
      });
    } catch (analyticError) {
      logger.warn({
        message: `Could not get real AI analytics, using complaint trends data: ${analyticError instanceof Error ? analyticError.message : String(analyticError)}`,
        category: "api",
        source: "admin"
      });
      
      const trendsData = await cfpbService.getComplaintTrends();
      res.json({
        success: true,
        data: trendsData,
        isBackupData: true
      });
    }
  } catch (error) {
    logger.error({
      message: `Failed to get AI analytics: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get AI analytics"
    });
  }
});

// Get portfolio health dashboard
adminReportsRouter.get("/portfolio-health", async (req: Request, res: Response) => {
  try {
    const portfolioMetrics = await portfolioMonitorService.getPortfolioHealthMetrics();
    
    res.json({
      success: true,
      data: portfolioMetrics
    });
  } catch (error) {
    logger.error({
      message: `Failed to get portfolio health: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get portfolio health"
    });
  }
});

// Get complaint trends
adminReportsRouter.get("/complaint-trends", async (req: Request, res: Response) => {
  try {
    const trends = await aiAnalyticsService.analyzeComplaintTrends();
    
    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    logger.error({
      message: `Failed to get complaint trends: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get complaint trends"
    });
  }
});

// Get underwriting model recommendations
adminReportsRouter.get("/underwriting-recommendations", async (req: Request, res: Response) => {
  try {
    const recommendations = await aiAnalyticsService.generateModelAdjustmentRecommendations();
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    logger.error({
      message: `Failed to get underwriting recommendations: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get underwriting recommendations"
    });
  }
});

// Run portfolio monitoring tasks (credit checks and asset verifications)
adminReportsRouter.post("/run-portfolio-monitoring", async (req: Request, res: Response) => {
  try {
    const { type } = req.body;
    
    if (type === "credit-checks") {
      const results = await portfolioMonitorService.scheduleAllCreditChecks();
      res.json({
        success: true,
        message: "Credit checks scheduled successfully",
        data: results
      });
    } else if (type === "asset-verifications") {
      const results = await portfolioMonitorService.scheduleAllAssetVerifications();
      res.json({
        success: true,
        message: "Asset verifications scheduled successfully",
        data: results
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid monitoring type. Use 'credit-checks' or 'asset-verifications'."
      });
    }
  } catch (error) {
    logger.error({
      message: `Failed to run portfolio monitoring: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to run portfolio monitoring"
    });
  }
});

// Get portfolio monitoring schedule
adminReportsRouter.get("/monitoring-schedule", async (req: Request, res: Response) => {
  try {
    const schedule = await storage.getLatestPortfolioMonitoring();
    
    res.json({
      success: true,
      data: schedule || {
        lastCreditCheckDate: null,
        lastAssetVerificationDate: null,
        nextCreditCheckDate: null,
        nextAssetVerificationDate: null
      }
    });
  } catch (error) {
    logger.error({
      message: `Failed to get monitoring schedule: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get monitoring schedule"
    });
  }
});

// Update portfolio monitoring schedule
adminReportsRouter.post("/monitoring-schedule", async (req: Request, res: Response) => {
  try {
    const {
      nextCreditCheckDate,
      nextAssetVerificationDate
    } = req.body;
    
    const updatedSchedule = await storage.updatePortfolioMonitoring({
      nextCreditCheckDate: nextCreditCheckDate ? new Date(nextCreditCheckDate) : undefined,
      nextAssetVerificationDate: nextAssetVerificationDate ? new Date(nextAssetVerificationDate) : undefined
    });
    
    res.json({
      success: true,
      message: "Monitoring schedule updated successfully",
      data: updatedSchedule[0]
    });
  } catch (error) {
    logger.error({
      message: `Failed to update monitoring schedule: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "admin",
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to update monitoring schedule"
    });
  }
});
