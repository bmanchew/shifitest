import { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { notificationService } from "../services/notification";

/**
 * Controller for handling admin operations
 */
export const adminController = {
  /**
   * Trigger satisfaction surveys for eligible contracts
   * @param req Express Request
   * @param res Express Response
   */
  triggerSatisfactionSurveys: async (req: Request, res: Response) => {
    try {
      // Authenticate as admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: Admin access required"
        });
      }
      
      // Find eligible contracts for satisfaction surveys
      const eligibleContracts = await storage.getContractsEligibleForSurvey();
      
      if (eligibleContracts.length === 0) {
        return res.json({
          success: true,
          message: "No contracts eligible for satisfaction surveys at this time",
          surveysTriggered: 0
        });
      }
      
      // Trigger a survey for each eligible contract
      let successCount = 0;
      let failureCount = 0;
      const errors = [];
      
      for (const contract of eligibleContracts) {
        try {
          // Get customer details
          const customer = await storage.getCustomer(contract.customerId);
          
          if (!customer) {
            errors.push({
              contractId: contract.id,
              error: "Customer not found"
            });
            failureCount++;
            continue;
          }
          
          // Send survey notification
          await notificationService.sendSatisfactionSurvey(
            customer.email,
            customer.phone,
            contract.id,
            customer.id
          );
          
          // Mark contract as surveyed
          await storage.updateContract(contract.id, {
            lastSurveySentDate: new Date()
          });
          
          // Log the survey trigger
          await storage.createLog({
            level: "info",
            message: `Satisfaction survey triggered for contract #${contract.id}`,
            metadata: JSON.stringify({
              contractId: contract.id,
              customerId: customer.id,
              customerEmail: customer.email,
              customerPhone: customer.phone
            }),
          });
          
          successCount++;
        } catch (error) {
          errors.push({
            contractId: contract.id,
            error: error instanceof Error ? error.message : String(error)
          });
          failureCount++;
        }
      }
      
      res.json({
        success: true,
        message: "Satisfaction surveys triggered",
        surveysTriggered: successCount,
        surveysFailed: failureCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      logger.error({
        message: `Trigger satisfaction surveys error: ${error instanceof Error ? error.message : String(error)}`,
        category: "admin",
        source: "internal",
        metadata: {
          errorStack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Failed to trigger satisfaction surveys"
      });
    }
  },
  
  // Additional admin methods can be added here
};