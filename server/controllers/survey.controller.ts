import { Request, Response } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { insertSurveyResponseSchema } from "@shared/schema";

/**
 * Controller for handling survey operations
 */
export const surveyController = {
  /**
   * Submit a new survey response
   * @param req Express Request
   * @param res Express Response
   */
  submitSurvey: async (req: Request, res: Response) => {
    try {
      const surveyData = insertSurveyResponseSchema.parse(req.body);
      
      const newSurveyResponse = await storage.createSurveyResponse(surveyData);
      
      // Log the survey submission
      await storage.createLog({
        level: "info",
        message: `Survey submitted for contract ID ${surveyData.contractId}`,
        metadata: JSON.stringify({
          surveyResponseId: newSurveyResponse.id,
          customerId: surveyData.customerId
        }),
      });
      
      res.status(201).json({
        success: true,
        surveyResponse: newSurveyResponse,
        message: "Survey submitted successfully"
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = fromZodError(error);
        return res.status(400).json({ 
          success: false,
          message: "Validation error", 
          errors: formattedError 
        });
      }
      
      logger.error({
        message: `Survey submission error: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          errorStack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({ 
        success: false,
        message: "Failed to submit survey" 
      });
    }
  },
  
  /**
   * Get surveys for a specific contract
   * @param req Express Request
   * @param res Express Response
   */
  getSurveysByContract: async (req: Request, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      
      if (isNaN(contractId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid contract ID format"
        });
      }
      
      const surveys = await storage.getSurveyResponsesByContract(contractId);
      
      res.json({
        success: true,
        surveys,
        count: surveys.length
      });
    } catch (error) {
      logger.error({
        message: `Get surveys by contract error: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          contractId: req.params.contractId,
          errorStack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Failed to retrieve surveys"
      });
    }
  },
  
  /**
   * Get surveys for a specific customer
   * @param req Express Request
   * @param res Express Response
   */
  getSurveysByCustomer: async (req: Request, res: Response) => {
    try {
      const customerId = parseInt(req.params.customerId);
      
      if (isNaN(customerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID format"
        });
      }
      
      const surveys = await storage.getSurveyResponsesByCustomer(customerId);
      
      res.json({
        success: true,
        surveys,
        count: surveys.length
      });
    } catch (error) {
      logger.error({
        message: `Get surveys by customer error: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          customerId: req.params.customerId,
          errorStack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Failed to retrieve surveys"
      });
    }
  },
};