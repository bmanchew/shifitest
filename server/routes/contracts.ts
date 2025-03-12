import express, { Request, Response } from "express";
import { storage } from "../storage";

const contractsRouter = express.Router();

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