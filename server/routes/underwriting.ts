import express, { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { underwritingService } from "../services/underwriting";
import { UnderwritingData } from "@shared/schema";

const underwritingRouter = express.Router();

// Get underwriting data for a specific contract
underwritingRouter.get("/contract/:contractId", async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.contractId);
    const role = req.query.role as string || 'customer'; // Default to customer view
    
    if (isNaN(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID format"
      });
    }
    
    // Get the contract to ensure it exists
    const contract = await storage.getContract(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }
    
    // Get associated underwriting data
    const underwritingData = await storage.getUnderwritingDataByContractId(contractId);
    
    // If no data found, return empty result
    if (!underwritingData || underwritingData.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: "No underwriting data available for this contract"
      });
    }
    
    // Filter data based on role - merchants and customers should see limited data
    const filteredData = role === 'admin' ? underwritingData : underwritingData.map(data => ({
      id: data.id,
      userId: data.userId,
      contractId: data.contractId,
      creditTier: data.creditTier,
      creditScore: data.creditScore,
      totalPoints: data.totalPoints,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      // Including all required fields with null values for type safety
      annualIncome: null,
      annualIncomePoints: null,
      employmentHistoryMonths: null,
      employmentHistoryPoints: null,
      creditScorePoints: null,
      dtiRatio: null,
      dtiRatioPoints: null,
      housingStatus: null,
      housingPaymentHistory: null,
      housingStatusPoints: null,
      delinquencyHistory: null,
      delinquencyPoints: null,
      rawPreFiData: null,
      rawPlaidData: null
    }));
    
    // Return the data
    res.json({
      success: true,
      data: filteredData,
      count: filteredData.length
    });
  } catch (error) {
    logger.error({
      message: `Error fetching underwriting data: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      metadata: {
        contractId: req.params.contractId,
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Get underwriting data for a specific user
underwritingRouter.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const role = req.query.role as string || 'customer';
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    // Get the user to ensure they exist
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Get associated underwriting data
    const underwritingData = await storage.getUnderwritingDataByUserId(userId);
    
    // If no data found, return empty result
    if (!underwritingData || underwritingData.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: "No underwriting data available for this user"
      });
    }
    
    // Filter data based on role
    const filteredData = role === 'admin' ? underwritingData : underwritingData.map(data => ({
      id: data.id,
      userId: data.userId,
      contractId: data.contractId,
      creditTier: data.creditTier,
      creditScore: data.creditScore,
      totalPoints: data.totalPoints,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      // Including all required fields with null values for type safety
      annualIncome: null,
      annualIncomePoints: null,
      employmentHistoryMonths: null,
      employmentHistoryPoints: null,
      creditScorePoints: null,
      dtiRatio: null,
      dtiRatioPoints: null,
      housingStatus: null,
      housingPaymentHistory: null,
      housingStatusPoints: null,
      delinquencyHistory: null,
      delinquencyPoints: null,
      rawPreFiData: null,
      rawPlaidData: null
    }));
    
    // Return the data
    res.json({
      success: true,
      data: filteredData,
      count: filteredData.length
    });
  } catch (error) {
    logger.error({
      message: `Error fetching underwriting data: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      metadata: {
        userId: req.params.userId,
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Manually trigger underwriting process for a contract
underwritingRouter.post("/process/:contractId", async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.contractId);
    
    if (isNaN(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID format"
      });
    }
    
    // Get the contract to ensure it exists
    const contract = await storage.getContract(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }
    
    // Check if the contract has a customer assigned
    if (!contract.customerId) {
      return res.status(400).json({
        success: false,
        message: "Contract does not have a customer assigned"
      });
    }
    
    // Trigger the underwriting process
    const underwritingData = await underwritingService.processUnderwriting(contract.customerId, contractId);
    
    if (!underwritingData) {
      return res.status(500).json({
        success: false,
        message: "Failed to process underwriting"
      });
    }
    
    // Return success
    res.json({
      success: true,
      data: underwritingData,
      message: "Underwriting process completed successfully"
    });
  } catch (error) {
    logger.error({
      message: `Error processing underwriting: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      metadata: {
        contractId: req.params.contractId,
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

export default underwritingRouter;