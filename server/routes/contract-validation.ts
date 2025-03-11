
import { Router, Request, Response } from "express";
import { StorageService } from "../storage";
import { logger } from "../utils/logger";

export function setupContractValidationRoutes(
  router: Router,
  storage: StorageService
) {
  // Endpoint to validate a contract ID before application
  router.get("/validate-contract/:id", async (req: Request, res: Response) => {
    try {
      const contractId = parseInt(req.params.id);
      
      if (isNaN(contractId) || contractId <= 0) {
        return res.status(400).json({ 
          valid: false, 
          message: "Invalid contract ID format" 
        });
      }
      
      const contract = await storage.getContractById(contractId);
      
      if (!contract) {
        return res.status(404).json({ 
          valid: false, 
          message: "Contract not found" 
        });
      }
      
      // Return basic contract details to confirm it's valid
      return res.json({
        valid: true,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        currentStep: contract.currentStep
      });
      
    } catch (error) {
      logger.error({
        message: "Error validating contract",
        category: "api",
        metadata: { 
          error: error instanceof Error ? error.message : String(error),
          contractId: req.params.id
        }
      });
      
      return res.status(500).json({ 
        valid: false, 
        message: "Error validating contract" 
      });
    }
  });
}
