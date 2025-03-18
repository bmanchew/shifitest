import express, { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";

const contractsRouter = express.Router();

// Get all contracts
contractsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const contracts = await storage.getAllContracts();
    
    res.json(contracts);
  } catch (error) {
    logger.error({
      message: `Error fetching all contracts: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: { error: error instanceof Error ? error.stack : null }
    });
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Get contracts by customer ID
contractsRouter.get("/by-customer/:customerId", async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    
    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID format"
      });
    }
    
    const contracts = await storage.getContractsByCustomerId(customerId);
    
    res.json({
      success: true,
      contracts,
      count: contracts.length
    });
  } catch (error) {
    console.error("Error fetching contracts by customer ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

export default contractsRouter;