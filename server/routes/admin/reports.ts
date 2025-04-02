import express, { Request, Response } from "express";
import { storage } from "../../storage";
import { cfpbService } from "../../services/cfpbService";
import { aiAnalyticsService } from "../../services";
import { logger } from "../../services/logger";
import { authenticateToken, isAdmin } from "../../middleware/auth";

export const reportsRouter = express.Router();

// Apply authentication middleware to all routes in this router
reportsRouter.use(authenticateToken);
reportsRouter.use(isAdmin);

// Get CFPB complaint trends
reportsRouter.get("/complaint-trends", async (req: Request, res: Response) => {
  try {
    logger.info({
      message: "Fetching complaint trends data",
      category: "api",
      source: "internal",
    });

    // Get real data from CFPB
    const trends = await cfpbService.getComplaintTrends();

    // Check if there was an error
    if ('error' in trends) {
      logger.warn({
        message: `CFPB data fetch had an error, but returning partial data: ${trends.error}`,
        category: "api",
        source: "internal",
      });
    }

    // Return the results with success status
    return res.json({
      success: true,
      data: trends,
      isMockData: false
    });
  } catch (error) {
    logger.error({
      message: `Error fetching complaint trends: ${error instanceof Error ? error.message : String(error)}`,
      category: "external",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : null,
      },
    });

    // Return error status with details
    res.status(500).json({
      success: false,
      message: "Failed to load CFPB complaint data. Please try again later.",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get CFPB complaint trends with analysis
reportsRouter.get("/cfpb-trends", async (req: Request, res: Response) => {
  try {
    logger.info({
      message: "Starting CFPB complaint trends analysis",
      category: "external",
      source: "internal",
    });

    // Get real data from CFPB API
    const analysisResults = await aiAnalyticsService.analyzeComplaintTrends();

    return res.json({
      success: true,
      data: analysisResults,
    });
  } catch (error) {
    logger.error({
      message: `Failed to get CFPB complaint trends: ${error instanceof Error ? error.message : String(error)}`,
      category: "external",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : null,
      },
    });

    res.status(500).json({
      success: false,
      message: "Failed to get CFPB complaint trends",
    });
  }
});

reportsRouter.get("/portfolio-health", async (req, res) => {
  // In a real application, this would fetch data from a database or other service
  res.json({
    totalContracts: 142,
    totalValue: 3427500,
    avgAPR: 12.8,
    delinquencyRate: 2.4,
    monthlyTrend: [
      { month: "Jan", rate: 2.1 },
      { month: "Feb", rate: 2.3 },
      { month: "Mar", rate: 2.0 },
      { month: "Apr", rate: 2.2 },
      { month: "May", rate: 2.3 },
      { month: "Jun", rate: 2.4 },
    ],
    byProduct: [
      {
        product: "Term Loans",
        contracts: 78,
        value: 1950000,
        delinquencyRate: 1.9,
      },
      {
        product: "Lines of Credit",
        contracts: 42,
        value: 1050000,
        delinquencyRate: 2.8,
      },
      {
        product: "Equipment Financing",
        contracts: 22,
        value: 427500,
        delinquencyRate: 3.1,
      },
    ],
    byRiskCategory: [
      {
        category: "Low Risk",
        contracts: 62,
        value: 1550000,
        delinquencyRate: 0.8,
      },
      {
        category: "Medium Risk",
        contracts: 58,
        value: 1450000,
        delinquencyRate: 2.5,
      },
      {
        category: "High Risk",
        contracts: 22,
        value: 427500,
        delinquencyRate: 6.2,
      },
    ],
  });
});