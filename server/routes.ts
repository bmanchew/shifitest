import express, { type Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  insertUserSchema,
  insertMerchantSchema,
  insertContractSchema,
  insertApplicationProgressSchema,
  insertLogSchema,
  insertCustomerSatisfactionSurveySchema,
  type InsertCustomerSatisfactionSurvey,
  logSourceEnum
} from "@shared/schema";
import { sortByDateDesc } from "./utils/dateHelpers";
import { twilioService } from "./services/twilio";
import { diditService } from "./services/didit";
import { blockchainService } from "./services/blockchain";
import { plaidService } from "./services/plaid";
import { thanksRogerService } from "./services/thanksroger";
import { preFiService } from './services/prefi';
import { logger } from "./services/logger";
import { nlpearlService, notificationService, merchantAnalyticsService, sesameAIService } from './services';
import crypto from "crypto";
import { adminReportsRouter } from "./routes/adminReports";
import { reportsRouter } from "./routes/admin/reports";
import adminRouter from "./routes/admin";
import contractsRouter from "./routes/contracts";
import customersRouter from "./routes/customers";
import underwritingRouter from "./routes/underwriting";
import merchantRouter from "./routes/merchant";
import merchantDashboardRouter from "./routes/merchant-dashboard";
import merchantFundingRouter from "./routes/merchant-funding";
import notificationRouter from "./routes/notification";
import paymentRouter from "./routes/payments";
import healthRouter from "./routes/health"; // Import health routes
import blockchainRouter from "./routes/blockchain"; // Import blockchain routes
import salesRepRouter from "./routes/salesRep"; // Import sales rep routes
import communicationsRouter from "./routes/communications"; // Import communications routes
import indexRoutes from "./routes/index"; // Import routes from index.ts
import registerSesameAIRoutes from "./routes/sesameAI"; // Import SesameAI routes
import registerFinancialSherpaRoutes from "./routes/financialSherpa"; // Import Financial Sherpa routes
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch'; // or use global fetch if available

function objectMetadata<T>(data: T): string {
  if (!data) return JSON.stringify({});
  if (typeof data === "string") {
    try {
      // Check if it's already a valid JSON string
      JSON.parse(data);
      return data;
    } catch (e) {
      // It's a string but not valid JSON, so wrap it
      return JSON.stringify({ stringValue: data });
    }
  }
  // Convert object to JSON string
  return JSON.stringify(data);
}

// Helper function to get the domain for callbacks and webhooks
function getAppDomain(): string {
  return process.env.REPLIT_DOMAINS?.split(",")[0] || "shifi.com";
}

function generateContractNumber(): string {
  return `SHI-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const apiRouter = express.Router();

  // Health check endpoint
  apiRouter.get("/", (req: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      message: "ShiFi API is running"
    });
  });

  // Auth routes
  apiRouter.post("/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ 
          success: false, 
          message: "Email and password are required" 
        });
      }
      
      const user = await storage.getUserByEmail(email);

      if (!user || user.password !== password) {
        return res.status(401).json({ 
          success: false,
          message: "Invalid credentials" 
        });
      }

      // In a real app, we would generate a JWT token here
      // Instead, we'll just return the user object without password
      const { password: _, ...userWithoutPassword } = user;

      // Set cookies for authentication
      res.cookie('userId', user.id.toString(), { 
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
      });
      
      res.cookie('userRole', user.role, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
      });

      // Create log for user login
      await storage.createLog({
        level: "info",
        message: `User logged in: ${user.email}`,
        userId: user.id,
        metadata: JSON.stringify({
          ip: req.ip,
          userAgent: req.get("user-agent"),
        }),
      });

      res.json({ 
        success: true, 
        user: userWithoutPassword 
      });
    } catch (error) {
      logger.error({
        message: `Login error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          errorStack: error instanceof Error ? error.stack : String(error)
        }
      });
      
      res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // User routes
  apiRouter.post("/users", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Check if user with email already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "User with this email already exists" });
      }

      const newUser = await storage.createUser(userData);

      // Create log for user creation
      await storage.createLog({
        level: "info",
        message: `User created: ${newUser.email}`,
        metadata: JSON.stringify({ id: newUser.id, role: newUser.role }),
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = fromZodError(error);
        return res
          .status(400)
          .json({ message: "Validation error", errors: formattedError });
      }
      console.error("Create user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  apiRouter.get("/users/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user by phone number
  apiRouter.get("/user-by-phone", async (req: Request, res: Response) => {
    try {
      const { phone } = req.query;

      if (!phone) {
        return res.status(400).json({ 
          success: false,
          message: "Phone number is required" 
        });
      }

      // First try to find the user
      let user = await storage.getUserByPhone(phone as string);

      // If user doesn't exist, create a new one
      if (!user) {
        user = await storage.findOrCreateUserByPhone(phone as string);
      }

      // Remove password from response
      const { password, ...userData } = user;

      res.json({
        success: true,
        user: userData,
        message: "User found or created successfully"
      });
    } catch (error) {
      console.error("Get user by phone error:", error);
      res.status(500).json({ 
        success: false,
        message: "Internal server error" 
      });
    }
  });

  // Admin routes are registered at the end of the file

// Merchant routes
  apiRouter.post("/merchants", async (req: Request, res: Response) => {
    try {
      const merchantData = insertMerchantSchema.parse(req.body);

      // If there's a userId, make sure the user exists and has role 'merchant'
      if (merchantData.userId) {
        const user = await storage.getUser(merchantData.userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        if (user.role !== "merchant") {
          return res.status(400).json({ message: "User is not a merchant" });
        }
      }

      const newMerchant = await storage.createMerchant(merchantData);

      // Create log for merchant creation
      await storage.createLog({
        level: "info",
        message: `Merchant created: ${newMerchant.name}`,
        metadata: JSON.stringify({
          id: newMerchant.id,
          email: newMerchant.email,
        }),
      });

      res.status(201).json(newMerchant);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = fromZodError(error);
        return res
          .status(400)
          .json({ message: "Validation error", errors: formattedError });
      }
      console.error("Create merchant error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  apiRouter.get("/merchants", async (req: Request, res: Response) => {
    try {
      const merchants = await storage.getAllMerchants();
      res.json(merchants);
    } catch (error) {
      console.error("Get merchants error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  apiRouter.get("/merchants/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const merchant = await storage.getMerchant(id);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }

      res.json(merchant);
    } catch (error) {
      console.error("Get merchant error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get Plaid settings for a merchant
  apiRouter.get("/merchants/:id/plaid-settings", async (req: Request, res: Response) => {
    try {
      const merchantId = parseInt(req.params.id);
      if (isNaN(merchantId)) {
        return res.status(400).json({ message: "Invalid merchant ID format" });
      }

      // Check if merchant exists
      const merchant = await storage.getMerchant(merchantId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }

      // Get Plaid merchant settings
      const plaidMerchant = await storage.getPlaidMerchantByMerchantId(merchantId);
      
      if (!plaidMerchant) {
        // If no settings exist yet, return an empty object
        return res.status(404).json({ 
          success: false, 
          message: "No Plaid settings found for this merchant" 
        });
      }

      res.json(plaidMerchant);
    } catch (error) {
      logger.error({
        message: `Error getting merchant Plaid settings: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: { 
          merchantId: req.params.id,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined 
        }
      });
      res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // Update Plaid settings for a merchant
  apiRouter.patch("/merchants/:id/plaid-settings", async (req: Request, res: Response) => {
    try {
      const merchantId = parseInt(req.params.id);
      if (isNaN(merchantId)) {
        return res.status(400).json({ message: "Invalid merchant ID format" });
      }

      // Check if merchant exists
      const merchant = await storage.getMerchant(merchantId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }

      // Get existing Plaid merchant settings
      let plaidMerchant = await storage.getPlaidMerchantByMerchantId(merchantId);
      
      // Extract the fields to update
      const { clientId, defaultFundingAccount } = req.body;
      
      let updatedPlaidMerchant;
      
      if (plaidMerchant) {
        // Update existing record
        updatedPlaidMerchant = await storage.updatePlaidMerchant(plaidMerchant.id, {
          clientId,
          defaultFundingAccount
        });

        logger.info({
          message: "Updated Plaid settings for merchant",
          category: "api",
          source: "plaid",
          metadata: { 
            merchantId,
            plaidMerchantId: plaidMerchant.id 
          }
        });
      } else {
        // Create new record if one doesn't exist
        updatedPlaidMerchant = await storage.createPlaidMerchant({
          merchantId,
          clientId,
          defaultFundingAccount,
          onboardingStatus: 'pending'
        });

        logger.info({
          message: "Created new Plaid settings for merchant",
          category: "api",
          source: "plaid",
          metadata: { 
            merchantId,
            plaidMerchantId: updatedPlaidMerchant.id 
          }
        });
      }

      res.json({
        success: true,
        data: updatedPlaidMerchant
      });
    } catch (error) {
      logger.error({
        message: `Error updating merchant Plaid settings: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: { 
          merchantId: req.params.id,
          requestBody: req.body,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        }
      });
      res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // Sync merchant with Plaid
  apiRouter.post("/merchants/:id/plaid-sync", async (req: Request, res: Response) => {
    try {
      const merchantId = parseInt(req.params.id);
      if (isNaN(merchantId)) {
        return res.status(400).json({ message: "Invalid merchant ID format" });
      }

      // Check if the Plaid service is initialized
      if (!plaidService.isInitialized()) {
        return res.status(500).json({
          success: false,
          message: "Plaid service not initialized"
        });
      }

      // Check if merchant exists
      const merchant = await storage.getMerchant(merchantId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }

      // Get Plaid merchant
      const plaidMerchant = await storage.getPlaidMerchantByMerchantId(merchantId);
      if (!plaidMerchant) {
        return res.status(404).json({ 
          success: false, 
          message: "No Plaid settings found for this merchant" 
        });
      }

      // Check if this merchant has an originator ID
      if (!plaidMerchant.originatorId) {
        return res.status(400).json({
          success: false,
          message: "This merchant does not have a Plaid originator ID yet"
        });
      }

      // Get the merchant's status from Plaid
      const originatorStatus = await plaidService.getMerchantOnboardingStatus(plaidMerchant.originatorId);
      
      // Update the merchant's status in our database
      const updatedPlaidMerchant = await storage.updatePlaidMerchant(plaidMerchant.id, {
        onboardingStatus: originatorStatus.status as any
      });

      logger.info({
        message: "Synced merchant with Plaid",
        category: "api",
        source: "plaid",
        metadata: { 
          merchantId,
          originatorId: plaidMerchant.originatorId,
          status: originatorStatus.status
        }
      });

      // Return the updated merchant status
      return res.status(200).json({
        success: true,
        message: "Merchant Plaid status synced successfully",
        status: originatorStatus.status,
        plaidMerchant: updatedPlaidMerchant
      });
    } catch (error) {
      console.error("Error syncing merchant with Plaid:", error);
      return res.status(500).json({ 
        success: false,
        message: "Failed to sync merchant with Plaid",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Archive a merchant
  apiRouter.post("/merchants/:id/archive", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      // Update the merchant
      const updatedMerchant = await storage.updateMerchant(id, {
        archived: true
      });

      // Create log for merchant archive
      if (updatedMerchant) {
        await storage.createLog({
          level: "info",
          message: `Merchant archived: ${updatedMerchant.name}`,
          metadata: JSON.stringify({
            id: updatedMerchant.id
          }),
        });
      }

      res.json({
        success: true,
        message: "Merchant archived successfully",
        merchant: updatedMerchant
      });
    } catch (error) {
      console.error("Archive merchant error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get contracts (with admin support)
  apiRouter.get("/contracts", async (req: Request, res: Response) => {
    try {
      const isAdminRequest = req.query.admin === "true";
      const merchantId = req.query.merchantId ? parseInt(req.query.merchantId as string) : undefined;
      
      // Check authentication for admin requests
      if (isAdminRequest) {
        const user = (req as any).user;
        if (!user || user.role !== "admin") {
          return res.status(401).json({ 
            success: false, 
            message: "Unauthorized: Admin access required" 
          });
        }
        
        // Return all contracts for admin users
        const allContracts = await storage.getAllContracts();
        
        // Filter to only include active contracts
        const activeContracts = allContracts.filter(contract => contract.status === "active");
        
        // Add underwriting data to each contract
        const contractsWithTiers = await Promise.all(activeContracts.map(async (contract) => {
          const underwritingData = await storage.getUnderwritingDataByContractId(contract.id);
          // Use the most recent underwriting data if available
          const mostRecentUnderwriting = underwritingData.length > 0 ? 
            underwritingData.sort((a, b) => 
              sortByDateDesc(a, b)
            )[0] : null;
          
          return {
            ...contract,
            creditTier: mostRecentUnderwriting?.creditTier || null
          };
        }));
        
        return res.json(contractsWithTiers);
      }
      
      // For merchant-specific requests, return only their active contracts with credit tiers
      if (merchantId) {
        const allContracts = await storage.getContractsByMerchantId(merchantId);
        
        // Filter to only include active contracts
        const activeContracts = allContracts.filter(contract => contract.status === "active");
        
        // Add underwriting data to each contract
        const contractsWithTiers = await Promise.all(activeContracts.map(async (contract) => {
          const underwritingData = await storage.getUnderwritingDataByContractId(contract.id);
          // Use the most recent underwriting data if available
          const mostRecentUnderwriting = underwritingData.length > 0 ? 
            underwritingData.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0] : null;
          
          return {
            ...contract,
            creditTier: mostRecentUnderwriting?.creditTier || null
          };
        }));
        
        return res.json(contractsWithTiers);
      }
      
      // Default: return empty array if no merchantId provided
      return res.json([]);
    } catch (error) {
      console.error("Get contracts error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch contracts" 
      });
    }
  });

  // Contract routes
  apiRouter.post("/contracts", async (req: Request, res: Response) => {
    try {
      const contractData = insertContractSchema.parse(req.body);

      // Make sure the merchant exists
      const merchant = await storage.getMerchant(contractData.merchantId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }

      // If there's a customerId, make sure the user exists and has role 'customer'
      if (contractData.customerId) {
        const customer = await storage.getUser(contractData.customerId);
        if (!customer) {
          return res.status(404).json({ message: "Customer not found" });
        }
        if (customer.role !== "customer") {
          return res.status(400).json({ message: "User is not a customer" });
        }
      }

      // Generate contract number if not provided
      if (!contractData.contractNumber) {
        contractData.contractNumber = generateContractNumber();
      }

      const newContract = await storage.createContract(contractData);

      // Create initial application progress steps
      const steps = ["terms", "kyc", "bank", "payment", "signing"];
      for (const step of steps) {
        await storage.createApplicationProgress({
          contractId: newContract.id,
          step: step as any,
          completed: false,
        });
      }

      // Create log for contract creation
      await storage.createLog({
        level: "info",
        message: `Contract created: ${newContract.contractNumber}`,
        metadata: JSON.stringify({
          id: newContract.id,
          merchantId: newContract.merchantId,
          amount: newContract.amount,
        }),
      });

      res.status(201).json(newContract);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = fromZodError(error);
        return res
          .status(400)
          .json({ message: "Validation error", errors: formattedError });
      }
      console.error("Create contract error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  apiRouter.get("/contracts/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
  
      const contract = await storage.getContract(id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
  
      // Get application progress for this contract
      const progress = await storage.getApplicationProgressByContractId(
        contract.id,
      );
  
      res.json({ contract, progress });
    } catch (error) {
      console.error("Get contract error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  apiRouter.patch(
    "/contracts/:id/status",
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid ID format" });
        }

        const { status } = req.body;
        if (
          !status ||
          !["pending", "active", "completed", "declined", "cancelled"].includes(
            status,
          )
        ) {
          return res.status(400).json({ message: "Invalid status" });
        }

        const contract = await storage.getContract(id);
        if (!contract) {
          return res.status(404).json({ message: "Contract not found" });
        }

        const updatedContract = await storage.updateContractStatus(id, status);

        // Create log for contract status update
        await storage.createLog({
          level: "info",
          message: `Contract status updated: ${contract.contractNumber} to ${status}`,
          metadata: JSON.stringify({
            id: contract.id,
            previousStatus: contract.status,
          }),
        });

        res.json(updatedContract);
      } catch (error) {
        console.error("Update contract status error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );
  
  // Endpoint to mark contract as purchased by ShiFi and trigger tokenization
  apiRouter.patch(
    "/contracts/:id/purchase-by-shifi",
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid ID format" });
        }

        const contract = await storage.getContract(id);
        if (!contract) {
          return res.status(404).json({ message: "Contract not found" });
        }

        // Update contract to mark it as purchased by ShiFi
        const updatedContract = await storage.updateContract(id, {
          purchasedByShifi: true,
          tokenizationStatus: "pending" // Set initial tokenization status
        });

        // Create log for purchase by ShiFi
        await storage.createLog({
          level: "info",
          message: `Contract marked as purchased by ShiFi: ${contract.contractNumber}`,
          category: "contract",
          source: "blockchain",
          metadata: JSON.stringify({
            id: contract.id,
            purchasedByShifi: true
          }),
        });

        // Trigger tokenization asynchronously
        // We don't await this to avoid blocking the API response
        (async () => {
          try {
            // First update status to processing
            await storage.updateContract(id, {
              tokenizationStatus: "processing"
            });

            // Attempt to tokenize the contract
            const tokenizationResult = await blockchainService.tokenizeContract(updatedContract);
            
            if (tokenizationResult.success) {
              // Update contract with tokenization details
              await storage.updateContract(id, {
                tokenizationStatus: "tokenized",
                tokenId: tokenizationResult.tokenId,
                smartContractAddress: tokenizationResult.smartContractAddress,
                blockchainTransactionHash: tokenizationResult.transactionHash,
                blockNumber: tokenizationResult.blockNumber,
                tokenizationDate: new Date()
              });

              logger.info({
                message: `Contract ${id} successfully tokenized after ShiFi purchase`,
                category: "contract",
                source: "blockchain",
                metadata: {
                  contractId: id,
                  tokenId: tokenizationResult.tokenId,
                  transactionHash: tokenizationResult.transactionHash
                }
              });
            } else {
              // Update contract with failure information
              await storage.updateContract(id, {
                tokenizationStatus: "failed",
                tokenizationError: tokenizationResult.error
              });

              logger.error({
                message: `Failed to tokenize contract ${id} after ShiFi purchase: ${tokenizationResult.error}`,
                category: "contract",
                source: "blockchain",
                metadata: {
                  contractId: id,
                  error: tokenizationResult.error
                }
              });
            }
          } catch (error) {
            // Handle any unexpected errors during tokenization
            await storage.updateContract(id, {
              tokenizationStatus: "failed",
              tokenizationError: error instanceof Error ? error.message : String(error)
            });

            logger.error({
              message: `Unexpected error tokenizing contract ${id}: ${error instanceof Error ? error.message : String(error)}`,
              category: "contract",
              source: "blockchain",
              metadata: {
                contractId: id,
                error: error instanceof Error ? error.stack : null
              }
            });
          }
        })();

        // Return the updated contract immediately without waiting for tokenization
        res.json({
          success: true,
          message: "Contract marked as purchased by ShiFi, tokenization initiated",
          contract: updatedContract
        });
      } catch (error) {
        console.error("Purchase by ShiFi error:", error);
        res.status(500).json({ 
          success: false,
          message: "Internal server error", 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    },
  );

  apiRouter.patch(
    "/contracts/:id/step",
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid ID format" });
        }

        const { step } = req.body;
        if (
          !step ||
          !["terms", "kyc", "bank", "payment", "signing", "completed"].includes(
            step,
          )
        ) {
          return res.status(400).json({ message: "Invalid step" });
        }

        const contract = await storage.getContract(id);
        if (!contract) {
          return res.status(404).json({ message: "Contract not found" });
        }

        const updatedContract = await storage.updateContractStep(id, step);

        // Create log for contract step update
        await storage.createLog({
          level: "info",
          message: `Contract step updated: ${contract.contractNumber} to ${step}`,
          metadata: JSON.stringify({
            id: contract.id,
            previousStep: contract.currentStep,
          }),
        });

        res.json(updatedContract);
      } catch (error) {
        console.error("Update contract step error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Application Progress routes
  apiRouter.get(
    "/application-progress",
    async (req: Request, res: Response) => {
      try {
        const { contractId } = req.query;

        if (!contractId) {
          return res.status(400).json({ message: "Contract ID is required" });
        }

        const id = parseInt(contractId as string);
        if (isNaN(id)) {
          return res
            .status(400)
            .json({ message: "Invalid contract ID format" });
        }

        const progress = await storage.getApplicationProgressByContractId(id);
        res.json(progress);
      } catch (error) {
        console.error("Get application progress error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );
  
  // Get contract document URL from signing progress
  apiRouter.get(
    "/contracts/:id/document",
    async (req: Request, res: Response) => {
      try {
        const contractId = parseInt(req.params.id);
        if (isNaN(contractId)) {
          return res.status(400).json({ message: "Invalid contract ID format" });
        }

        // Get all application progress steps for this contract
        const progress = await storage.getApplicationProgressByContractId(contractId);
        
        // Find the signing step with completed status
        const signingStep = progress.find(
          (step) => step.step === "signing" && step.completed
        );

        if (!signingStep || !signingStep.data) {
          return res.status(404).json({ 
            success: false,
            message: "Signed document not found for this contract" 
          });
        }

        try {
          // Parse the JSON data from the signing step
          const signingData = JSON.parse(signingStep.data);
          
          if (!signingData.documentUrl) {
            return res.status(404).json({ 
              success: false,
              message: "Document URL not available" 
            });
          }

          // Return the document URL and other relevant signing data
          res.json({
            success: true,
            documentUrl: signingData.documentUrl,
            signedAt: signingData.signedAt || signingData.completedAt,
            signatureId: signingData.signatureId,
            status: signingData.status
          });
        } catch (parseError) {
          console.error("Error parsing signing data:", parseError);
          return res.status(500).json({ 
            success: false,
            message: "Error retrieving document data" 
          });
        }
      } catch (error) {
        console.error("Get contract document error:", error);
        res.status(500).json({ 
          success: false,
          message: "Internal server error" 
        });
      }
    },
  );

  // Get KYC progress step specifically - creates KYC progress if it doesn't exist
  apiRouter.get(
    "/application-progress/kyc/:contractId",
    async (req: Request, res: Response) => {
      try {
        const contractId = parseInt(req.params.contractId);
        if (isNaN(contractId)) {
          return res
            .status(400)
            .json({ message: "Invalid contract ID format" });
        }

        // Verify that the contract exists first
        const contract = await storage.getContract(contractId);
        if (!contract) {
          return res.status(404).json({ message: "Contract not found" });
        }

        // Look for existing KYC progress
        const progress =
          await storage.getApplicationProgressByContractId(contractId);
        let kycProgress = progress.find((step) => step.step === "kyc");

        // If KYC progress doesn't exist, create it
        if (!kycProgress) {
          // Log this creation
          console.log(`Creating new KYC progress for contract ${contractId}`);
          await storage.createLog({
            level: "info",
            message: `Creating missing KYC progress for contract ${contract.contractNumber}`,
            metadata: JSON.stringify({ contractId }),
            category: "user",
            source: "internal",
          });

          // Create the KYC progress entry
          kycProgress = await storage.createApplicationProgress({
            contractId,
            step: "kyc",
            completed: false,
            data: null,
          });
        }

        res.json(kycProgress);
      } catch (error) {
        console.error("Get KYC progress error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  apiRouter.patch(
    "/application-progress/:id",
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid ID format" });
        }

        const { completed, data } = req.body;
        if (typeof completed !== "boolean") {
          return res
            .status(400)
            .json({ message: "Completed must be a boolean" });
        }

        const progress = await storage.getApplicationProgress(id);
        if (!progress) {
          return res
            .status(404)
            .json({ message: "Application progress not found" });
        }

        const updatedProgress =
          await storage.updateApplicationProgressCompletion(
            id,
            completed,
            data,
          );

        // If this step is completed, check if we should update the contract's current step
        if (completed) {
          const contract = await storage.getContract(progress.contractId);
          if (contract) {
            // Get all progress items for this contract
            const allProgress =
              await storage.getApplicationProgressByContractId(contract.id);

            // Find the next incomplete step
            const steps = ["terms", "kyc", "bank", "payment", "signing"];
            const nextIncompleteStepIndex = steps.findIndex((step) => {
              const stepProgress = allProgress.find((p) => p.step === step);
              return stepProgress && !stepProgress.completed;
            });

            // If all steps are complete, mark as completed, otherwise update to the next step
            if (nextIncompleteStepIndex === -1) {
              await storage.updateContractStep(contract.id, "completed");
              await storage.updateContractStatus(contract.id, "active");
            } else {
              await storage.updateContractStep(
                contract.id,
                steps[nextIncompleteStepIndex],
              );
            }
          }
        }

        // Create log for application progress update
        await storage.createLog({
          level: "info",
          message: `Application progress updated: ${progress.step} to ${completed ? "completed" : "incomplete"}`,
          metadata: JSON.stringify({
            id: progress.id,
            contractId: progress.contractId,
          }),
        });

        res.json(updatedProgress);
      } catch (error) {
        console.error("Update application progress error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );


  // Add this route to handle creation of application progress items
apiRouter.post("/application-progress", async (req: Request, res: Response) => {
  try {
    const { contractId, step, completed, data } = req.body;

    if (!contractId || !step) {
      return res.status(400).json({ 
        message: "Contract ID and step are required" 
      });
    }

    // Verify the contract exists
    const contract = await storage.getContract(parseInt(contractId));
    if (!contract) {
      return res.status(404).json({ 
        message: "Contract not found" 
      });
    }

    // Create the application progress item
    const progressItem = await storage.createApplicationProgress({
      contractId: parseInt(contractId),
      step: step,
      completed: !!completed,
      data: data || null
    });

    // Log the creation
    await storage.createLog({
      level: "info",
      category: "contract",
      message: `Application progress created for contract ${contractId}, step ${step}`,
      metadata: JSON.stringify({ 
        contractId, 
        step, 
        completed: !!completed 
      })
    });

    res.status(201).json(progressItem);
  } catch (error) {
    console.error("Create application progress error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

  // Log routes
  apiRouter.get("/logs", async (req: Request, res: Response) => {
    try {
      const { userId } = req.query;

      let logs;
      if (userId) {
        const id = parseInt(userId as string);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid user ID format" });
        }
        logs = await storage.getLogsByUserId(id);
      } else {
        logs = await storage.getLogs();
      }

      res.json(logs);
    } catch (error) {
      console.error("Get logs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Endpoint has been moved to /twilio/send-application with enhanced functionality
  apiRouter.post("/send-application", async (req: Request, res: Response) => {
    // Redirect to the newer implementation
    return res.redirect(307, `/api/twilio/send-application`);
  });
  
  // Add initiate-call endpoint for NLPearl integration
  apiRouter.post("/initiate-call", async (req: Request, res: Response) => {
    try {
      const { phoneNumber, applicationUrl, merchantId, merchantName } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required"
        });
      }
      
      // Get display name from merchant if merchantId is provided
      let displayName = merchantName || "ShiFi Financing";
      if (merchantId) {
        try {
          const merchant = await storage.getMerchant(parseInt(merchantId));
          if (merchant) {
            displayName = merchant.name;
          }
        } catch (err) {
          logger.warn({
            message: `Could not get merchant name for ID ${merchantId}`,
            category: "api",
            source: "nlpearl"
          });
        }
      }
      
      // Ensure the applicationUrl has a contract ID and merchant ID
      let fullApplicationUrl = applicationUrl;
      
      // If applicationUrl doesn't contain a specific contract, use a more explicit error message
      if (!applicationUrl || !applicationUrl.includes('/apply/')) {
        // Use the URL format from the request with a warning
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        fullApplicationUrl = baseUrl + '/apply';
        logger.warn({
          message: "Application URL missing contract ID in follow-up call",
          category: "api",
          source: "nlpearl",
          metadata: { 
            phoneNumber,
            providedUrl: applicationUrl,
            fallbackUrl: fullApplicationUrl,
            merchantName: displayName,
            merchantId
          }
        });
      }
      
      logger.info({
        message: "Initiating application follow-up call",
        category: "api",
        source: "nlpearl",
        metadata: { 
          phoneNumber,
          applicationUrl: fullApplicationUrl,
          merchantName: displayName,
          merchantId
        }
      });
      
      // Use NLPearl service to initiate a call
      const callResult = await nlpearlService.initiateApplicationCall(
        phoneNumber,
        fullApplicationUrl,
        displayName
      );
      
      // Log successful call initiation
      logger.info({
        message: "Successfully initiated follow-up call",
        category: "api",
        source: "nlpearl",
        metadata: { 
          phoneNumber,
          callId: callResult.call_id
        }
      });
      
      return res.status(200).json({
        success: true,
        message: "Follow-up call initiated successfully",
        callId: callResult.call_id
      });
    } catch (error) {
      logger.error({
        message: `Error initiating follow-up call: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "nlpearl",
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return res.status(500).json({
        success: false,
        message: "Failed to initiate follow-up call",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Endpoint to check Twilio service status
  apiRouter.get("/twilio/status", async (req: Request, res: Response) => {
    try {
      const isInitialized = twilioService.isInitialized();
      const accountSid = process.env.TWILIO_ACCOUNT_SID ? "Configured" : "Not configured";
      const authToken = process.env.TWILIO_AUTH_TOKEN ? "Configured" : "Not configured";
      const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

      logger.info({
        message: "Twilio service status check",
        category: "api",
        source: "twilio",
        metadata: {
          isInitialized,
          accountSid: !!process.env.TWILIO_ACCOUNT_SID,
          authToken: !!process.env.TWILIO_AUTH_TOKEN,
          phoneNumber: phoneNumber || "Not configured"
        }
      });

      return res.json({
        success: true,
        status: {
          isInitialized,
          accountSid,
          authToken,
          phoneNumber: phoneNumber || "Not configured",
          mode: isInitialized ? "Live" : "Simulation"
        }
      });
    } catch (error) {
      logger.error({
        message: `Error checking Twilio service status: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "twilio",
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });

      return res.status(500).json({
        success: false,
        message: "Error checking Twilio status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Simplified SMS application sending endpoint
  apiRouter.post("/twilio/send-application", async (req: Request, res: Response) => {
    try {
      const { phoneNumber, merchantId, amount, email } = req.body;

      if (!phoneNumber || !merchantId || !amount) {
        return res.status(400).json({
          success: false,
          message: "Phone number, merchant ID, and amount are required"
        });
      }

      logger.info({
        message: "Application SMS requested",
        category: "sms",
        source: "twilio",
        metadata: {
          phoneNumber,
          merchantId,
          amount,
          email: email || null
        }
      });

      // Get merchant
      const merchant = await storage.getMerchant(parseInt(merchantId));
      if (!merchant) {
        return res.status(404).json({ 
          success: false,
          message: "Merchant not found" 
        });
      }

      // Create a contract for this application
      const contractNumber = generateContractNumber();
      const termMonths = 24; // Fixed term
      const interestRate = 0; // 0% APR
      const downPaymentPercent = 15; // 15% down payment
      const downPayment = amount * (downPaymentPercent / 100);
      const financedAmount = amount - downPayment;
      const monthlyPayment = financedAmount / termMonths;

      // Find or create a user for this phone number
      const customer = await storage.findOrCreateUserByPhone(phoneNumber, email);

      // Create the contract
      const newContract = await storage.createContract({
        contractNumber,
        merchantId,
        customerId: customer.id,
        amount,
        downPayment,
        financedAmount,
        termMonths,
        interestRate,
        monthlyPayment,
        status: "pending",
        currentStep: "terms",
        phoneNumber: phoneNumber
      });

      // Create application progress for all steps
      const applicationSteps = ["terms", "kyc", "bank", "payment", "signing"];
      for (const step of applicationSteps) {
        await storage.createApplicationProgress({
          contractId: newContract.id,
          step: step as any,
          completed: false,
          data: null,
        });
      }

      // Get the application URL - include both contract ID and merchant ID parameters
      const replitDomain = getAppDomain();
      const applicationUrl = `https://${replitDomain}/apply/${newContract.id}?mid=${merchantId}`;

      // Prepare the SMS message
      const messageText = `You've been invited by ${merchant.name} to apply for financing of $${amount}. Click here to apply: ${applicationUrl}`;

      // Send SMS using Twilio service
      const result = await twilioService.sendSMS({
        to: phoneNumber,
        body: messageText
      });

      // Log the SMS delivery attempt
      await storage.createLog({
        level: "info",
        category: "sms",
        source: "twilio",
        message: `Application SMS to ${phoneNumber}`,
        metadata: JSON.stringify({
          phoneNumber,
          merchantId,
          amount,
          contractId: newContract.id,
          messageId: result.messageId,
          isSimulated: result.isSimulated
        })
      });

      return res.json({
        success: true,
        message: result.isSimulated ? 
          `Application SMS would be sent to ${phoneNumber} (simulation mode)` : 
          `Application SMS sent to ${phoneNumber}`,
        contractId: newContract.id,
        applicationUrl,
        messageId: result.messageId,
        isSimulated: result.isSimulated
      });
    } catch (error) {
      logger.error({
        message: `Application SMS error: ${error instanceof Error ? error.message : String(error)}`,
        category: "sms",
        source: "twilio",
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });

      return res.status(500).json({
        success: false,
        message: "Failed to send application SMS",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Simple SMS testing endpoint
  apiRouter.post("/twilio/test-sms", async (req: Request, res: Response) => {
    try {
      const { phoneNumber, message } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required"
        });
      }

      // Default message if none provided
      const smsMessage = message || "This is a test message from ShiFi. The SMS testing endpoint is working correctly.";

      logger.info({
        message: "Test SMS requested",
        category: "api",
        source: "twilio",
        metadata: {
          phoneNumber,
          messageLength: smsMessage.length
        }
      });

      // Send SMS using Twilio service
      const result = await twilioService.sendSMS({
        to: phoneNumber,
        body: smsMessage
      });

      // Create log for test SMS
      await storage.createLog({
        level: "info",
        category: "api",
        source: "twilio",
        message: `Test SMS to ${phoneNumber}`,
        metadata: JSON.stringify({
          phoneNumber,
          messageId: result.messageId,
          isSimulated: result.isSimulated,
          success: result.success
        })
      });

      return res.json({
        success: true,
        message: result.isSimulated ? 
          `Test SMS would be sent to ${phoneNumber} (simulation mode)` : 
          `Test SMS sent to ${phoneNumber}`,
        messageId: result.messageId,
        status: result.isSimulated ? "simulated" : "delivered",
        isSimulated: result.isSimulated
      });
    } catch (error) {
      logger.error({
        message: `Test SMS error: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "twilio",
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });

      return res.status(500).json({
        success: false,
        message: "Failed to send test SMS",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Endpoint to consolidate SMS sending functionality
  apiRouter.post("/send-sms", async (req: Request, res: Response) => {
    try {
      // First, create a log of the original request
      logger.info({
        message: "SMS request received at /send-sms",
        category: "api",
        source: "twilio",
        metadata: {
          body: { ...req.body, password: undefined } // Ensure no sensitive data is logged
        }
      });

      // Check if this is a test SMS from admin panel
      if (req.body.phone && req.body.isTest) {
        // For test SMS, use the dedicated test endpoint
        logger.info({
          message: "Redirecting test SMS request to /twilio/test-sms",
          category: "api",
          source: "twilio"
        });
        
        // Copy the request body
        req.body.phoneNumber = req.body.phone; // Adjust parameter name if needed
        req.body.message = "This is a test message from ShiFi. Your API verification was successful.";
        
        // Redirect to the test SMS endpoint
        return res.redirect(307, `/api/twilio/test-sms`);
      }

      // For non-test SMS (application invitations), use the dedicated application endpoint
      logger.info({
        message: "Redirecting application SMS request to /twilio/send-application",
        category: "api",
        source: "twilio"
      });
      
      // Redirect to the application SMS endpoint
      return res.redirect(307, `/api/twilio/send-application`);
    } catch (error) {
      console.error("Send SMS redirect error:", error);

      // Create error log
      await storage.createLog({
        level: "error",
        category: "api",
        source: "twilio",
        message: `Failed to redirect SMS request: ${error instanceof Error ? error.message : String(error)}`,
        metadata: JSON.stringify({
          error: error instanceof Error ? error.stack : null,
          requestBody: { ...req.body, password: undefined } // Ensure no sensitive data is logged
        }),
      });

      return res.status(500).json({ 
        success: false,
        message: "Failed to process SMS request",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  // KYC verification status checking endpoint
  apiRouter.post("/kyc/check-status", async (req: Request, res: Response) => {
    try {
      const { customerId, contractId, phoneNumber } = req.body;
      let userIdToCheck = customerId ? Number(customerId) : null;
      let phoneToCheck = phoneNumber;

      // If contractId is provided but no customerId/phoneNumber, first get the contract data
      if (contractId && (!customerId && !phoneNumber)) {
        try {
          // Get contract information to extract customerId and phoneNumber
          const contract = await storage.getContract(parseInt(String(contractId)));

          if (contract) {
            logger.info({
              message: `Checking KYC status using contract data`,
              category: "api",
              source: "internal",
              metadata: {
                contractId,
                extractedCustomerId: contract.customerId,
                extractedPhoneNumber: contract.phoneNumber
              }
            });

            userIdToCheck = contract.customerId;
            phoneToCheck = contract.phoneNumber;
          }
        } catch (contractError) {
          logger.error({
            message: `Error fetching contract for KYC status check: ${contractError instanceof Error ? contractError.message : String(contractError)}`,
            category: "api",
            source: "internal",
            metadata: {
              contractId,
              error: contractError instanceof Error ? contractError.stack : String(contractError)
            }
          });
        }
      }

      // Check if we have any identification info
      if (!userIdToCheck && !phoneToCheck && !contractId) {
        return res.status(400).json({
          success: false,
          message: "Either customer ID, phone number, or contract ID is required",
        });
      }

      // First, check if the customer has completed KYC verification
      let existingVerifications = [];

      if (userIdToCheck) {
        existingVerifications = await storage.getCompletedKycVerificationsByUserId(userIdToCheck);
        logger.info({
          message: `Checking KYC status for customer ${userIdToCheck}`,
          category: "api",
          source: "internal",
          metadata: {
            userIdToCheck,
            contractId,
            phoneToCheck,
            existingVerifications: existingVerifications.length
          }
        });
      }

      // If no verifications found by user ID but we have a phone number, try that
      if (existingVerifications.length === 0 && phoneToCheck) {
        try {
          // Find user by phone number
          const normalizedPhone = phoneToCheck.replace(/\D/g, '');

          // Try to find a user with this phone number
          const userWithPhone = await storage.getUserByPhone(normalizedPhone);

          if (userWithPhone) {
            // If found, check for verifications with that user ID
            existingVerifications = await storage.getCompletedKycVerificationsByUserId(userWithPhone.id);

            logger.info({
              message: `Found user by phone, checking KYC status`,
              category: "api",
              source: "internal",
              metadata: {
                phoneToCheck,
                normalizedPhone,
                foundUserId: userWithPhone.id,
                existingVerifications: existingVerifications.length
              }            });
          }
        } catch (phoneError) {
          logger.error({
            message: `Error checking user by phone: ${phoneError instanceof Error ? phoneError.message : String(phoneError)}`,
            category: "api",
            source: "internal",
            metadata: {
              phoneToCheck,
              error: phoneError instanceof Error ? phoneError.stack : String(phoneError)
            }
          });
        }
      }

      // If we found completed KYC verifications, return that information
      if (existingVerifications.length > 0) {
        logger.info({
          message: `Found existing KYC verification for request`,
          category: "api", 
          source: "internal",
          metadata: {
            userIdToCheck,
            phoneToCheck,
            contractId,
            existingVerifications: existingVerifications.length,
            verificationDetails: existingVerifications.map(v => ({
              contractId: v.contractId,
              completed: v.completed,
              step: v.step
            }))
          }
        });

        return res.json({
          success: true,
          alreadyVerified: true,
          message: "Identity already verified in our system",
          verificationCount: existingVerifications.length
        });
      }

      // No existing verifications found
      return res.json({
        success: true,
        alreadyVerified: false,
        message: "Identity verification required"
      });

    } catch (error) {
      logger.error({
        message: `Error checking KYC status: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });

      return res.status(500).json({
        success: false,
        message: "Failed to check verification status",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // KYC verification API endpoint with validation
  apiRouter.post("/kyc/create-session", async (req: Request, res: Response) => {
    try {
      const { contractId } = req.body;

      if (!contractId) {
        return res.status(400).json({
          success: false,
          message: "Contract ID is required",
        });
      }

      // Get the domain for callback URLs
      const domain = getAppDomain();

      // Separate URLs for webhook notifications and user redirection
      const webhookUrl = `https://${domain}/api/kyc/webhook`;
      const redirectUrl = `https://${domain}/apply/${contractId}`;

      // Set the server base URL for the DiDit service to handle mock mode correctly
      diditService.setServerBaseUrl(`https://${domain}`);

      // Log the attempt to create a KYC verification session
      logger.info({
        message: `Creating KYC verification session for contract ${contractId}`,
        category: "api",
        source: "didit",
        metadata: {
          contractId,
          webhookUrl,
          redirectUrl,
        },
      });

      // Use the DiDit service to create a verification session
      // This will use the real API if credentials are valid, or fall back to mock mode
      const sessionData = await diditService.createVerificationSession({
        contractId,
        callbackUrl: redirectUrl, // URL where the user will be redirected after verification
        allowedDocumentTypes: ["passport", "driving_license", "id_card"],
        allowedChecks: ["ocr", "face", "document_liveness", "aml"],
        requiredFields: [
          "first_name",
          "last_name",
          "date_of_birth",
          "document_number",
        ],
      });

      if (!sessionData) {
        throw new Error("Failed to create verification session");
      }

      // Log successful session creation
      logger.info({
        message: `DiDit verification session created for contract ${contractId}`,
        category: "api",
        source: "didit",
        metadata: {
          contractId,
          sessionId: sessionData.session_id,
          sessionUrl: sessionData.session_url,
          status: sessionData.status,
          callback: sessionData.callback,
        },
      });

      res.json({
        success: true,
        session: sessionData,
      });
    } catch (error) {
      logger.error({
        message: `Failed to create KYC verification session: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      res.status(500).json({
        success: false,
        message: "Failed to create verification session",
      });
    }
  });



  // Thanks Roger contract signing endpoint
  // Thanks Roger contract signing endpoint with authentication
  apiRouter.post("/contract-signing", async (req: Request, res: Response) => {
    try {
      const { contractId, contractNumber, customerName, signatureData, phoneNumber } =
        req.body;

      if (!contractId || !contractNumber || !customerName || !signatureData) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: contractId, contractNumber, customerName, and signatureData are required",
        });
      }

      // Get the contract details
      const contract = await storage.getContract(Number(contractId));
      if (!contract) {
        return res.status(404).json({
          success: false,
          message: "Contract not found",
        });
      }

      // Verify user is authorized to sign this contract
      // Either has matching phone number or is already the customer of record
      let isAuthorized = false;
      let userId = null;

      // Check if we have a user ID from an earlier login
      if (contract.customerId) {
        userId = contract.customerId;
        isAuthorized = true;
      }

      // If phone provided, verify it matches the contract
      if (phoneNumber && contract.phoneNumber) {
        const normalizedRequestPhone = phoneNumber.replace(/\D/g, '');
        const normalizedContractPhone = contract.phoneNumber.replace(/\D/g, '');

        if (normalizedRequestPhone === normalizedContractPhone) {
          isAuthorized = true;

          // If we don't have a user ID yet, try to find one by phone
          if (!userId) {
            const user = await storage.getUserByPhone(normalizedRequestPhone);
            if (user) {
              userId = user.id;

              // Update the contract with this user ID if not set
              if (!contract.customerId) {
                await storage.updateContractCustomerId(Number(contractId), userId);
                logger.info({
                  message: `Linked contract ${contractId} to user ${userId} during signing`,
                  category: "contract",
                  source: "signing",
                  metadata: { contractId, userId }
                });
              }
            }
          }
        }
      }

      if (!isAuthorized) {
        logger.warn({
          message: `Unauthorized contract signing attempt for contract ${contractId}`,
          category: "security", 
          source: "signing",
          metadata: {
            contractId,
            requestPhone: phoneNumber,
            contractPhone: contract.phoneNumber
          }
        });

        return res.status(403).json({
          success: false,
          message: "Unauthorized to sign this contract",
        });
      }

      // Log the authorized signing attempt
      logger.info({
        message: `Authorized contract signing for contract ${contractId}`,
        category: "contract",
        source: "signing",
        userId,
        metadata: { contractId, customerName }
      });

      // Get merchant details
      const merchant = await storage.getMerchant(contract.merchantId);
      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: "Merchant not found",
        });
      }

      logger.info({
        message: `Processing contract signing for contract #${contractNumber}`,
        category: "contract",
        source: "thanksroger",
        metadata: { contractId, customerName },
      });

      // Check if the API is properly configured
      const apiKey = process.env.THANKSROGER_API_KEY;
      const workspaceId = process.env.THANKSROGER_WORKSPACE_ID;
      const templateId = process.env.THANKSROGER_TEMPLATE_ID;

      const apiConfigured = apiKey && workspaceId && templateId;
      if (!apiConfigured) {
        logger.warn({
          message:
            "ThanksRoger API not fully configured. Missing env variables.",
          category: "contract",
          source: "thanksroger",
          metadata: {
            apiKeySet: !!apiKey,
            workspaceIdSet: !!workspaceId,
            templateIdSet: !!templateId,
          },
        });
      }

      // First, check if we already have a ThanksRoger contract ID for this contract
      // If not, create a new contract in ThanksRoger
      let thankRogerContractId = "";
      let signingLink = "";

      // Look up the ThanksRoger contract ID in the application progress
      const progress = await storage.getApplicationProgressByContractId(
        Number(contractId),
      );
      const signingProgress = progress.find((step) => step.step === "signing");

      if (signingProgress && signingProgress.data) {
        try {
          const data = JSON.parse(signingProgress.data);
          if (data.thankRogerContractId) {
            thankRogerContractId = data.thankRogerContractId;
            signingLink = data.signingLink || "";
            logger.info({
              message: `Found existing ThanksRoger contract: ${thankRogerContractId}`,
              category: "contract",
              source: "thanksroger",
            });
          }
        } catch (error) {
          logger.warn({
            message: `Error parsing signing progress data: ${error instanceof Error ? error.message : String(error)}`,
            category: "contract",
            source: "thanksroger",
          });
        }
      }

      // FALLBACK MODE: If API is not configured or we encounter auth issues, use local signing
      let usingFallbackMode = !apiConfigured;
      let signingProgressId = signingProgress?.id;

      // If we don't have a ThanksRoger contract ID, create a new contract
      if (!thankRogerContractId && apiConfigured) {
        logger.info({
          message: `No existing ThanksRoger contract found, creating a new one`,
          category: "contract",
          source: "thanksroger",
        });

        // Get customer email if available
        let customerEmail = "customer@example.com";
        if (contract.customerId) {
          const customer = await storage.getUser(contract.customerId);
          if (customer && customer.email) {
            customerEmail = customer.email;
          }
        }

        try {
          // Create a contract in Thanks Roger
          const thanksRogerContract =
            await thanksRogerService.createFinancingContract({
              templateId: templateId as string,
              customerName,
              customerEmail,
              merchantName: merchant.name,
              contractNumber,
              amount: contract.amount,
              downPayment: contract.downPayment,
              financedAmount: contract.financedAmount,
              termMonths: contract.termMonths,
              interestRate: contract.interestRate,
              monthlyPayment: contract.monthlyPayment,
              sendEmail: false, // Don't send email since we're handling the flow in the app
            });

          if (!thanksRogerContract) {
            logger.warn({
              message:
                "Failed to create contract in Thanks Roger, using fallback mode",
              category: "contract",
              source: "thanksroger",
              metadata: { contractId, contractNumber },
            });
            usingFallbackMode = true;
          } else {
            // Store the ThanksRoger contract ID for future reference
            thankRogerContractId = thanksRogerContract.contractId;
            signingLink = thanksRogerContract.signingLink;

            // Update the signing progress with the ThanksRoger contract ID
            if (signingProgress) {
              await storage.updateApplicationProgressCompletion(
                signingProgress.id,
                false, // Not completed yet
                JSON.stringify({
                  thankRogerContractId,
                  signingLink,
                  status: "created",
                  createdAt: new Date().toISOString(),
                }),
              );
              signingProgressId = signingProgress.id;
            } else {
              // Create a new signing progress if it doesn't exist
              const newProgress = await storage.createApplicationProgress({
                contractId: Number(contractId),
                step: "signing",
                completed: false,
                data: JSON.stringify({
                  thankRogerContractId,
                  signingLink,
                  status: "created",
                  createdAt: new Date().toISOString(),
                }),
              });
              signingProgressId = newProgress.id;
            }
          }
        } catch (error) {
          logger.error({
            message: `Error creating contract in ThanksRoger: ${error instanceof Error ? error.message : String(error)}`,
            category: "contract",
            source: "thanksroger",
            metadata: { contractId, contractNumber },
          });
          usingFallbackMode = true;
        }
      }

      // FALLBACK MODE: If we're in fallback mode, we'll store the signature locally without using ThanksRoger API
      if (usingFallbackMode) {
        logger.info({
          message:
            "Using fallback mode for contract signing - storing signature locally",
          category: "contract",
          source: "thanksroger",
          metadata: { contractId, contractNumber },
        });

        const signatureId = `local-sig-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        const signedAt = new Date().toISOString();

        // Update or create the signature progress
        const signatureData = {
          signatureId,
          signedAt,
          usingFallbackMode: true,
          status: "signed",
          contractNumber,
        };

        if (signingProgressId) {
          await storage.updateApplicationProgressCompletion(
            signingProgressId,
            true, // Mark as completed
            JSON.stringify(signatureData),
          );
        } else {
          // Create new progress item
          const newProgress = await storage.createApplicationProgress({
            contractId: Number(contractId),
            step: "signing",
            completed: true,
            data: JSON.stringify(signatureData),
          });
          signingProgressId = newProgress.id;
        }

        // Update contract status
        await storage.updateContractStep(Number(contractId), "completed");
        await storage.updateContractStatus(Number(contractId), "active");

        // Return success response with local signature ID
        return res.json({
          success: true,
          contractId: `local-${contractId}`,
          signatureId,
          signedAt,
          status: "signed",
          fallbackMode: true,
          message: "Contract signed successfully using fallback mode",
        });
      }

      // If we have a ThanksRoger contract ID, try to sign the contract through the API
      if (!thankRogerContractId) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to obtain contract ID from ThanksRoger. Please try again or contact support.",
        });
      }

      try {
        // Now sign the contract with the provided signature data
        const signResult = await thanksRogerService.signContract({
          contractId: thankRogerContractId,
          signatureData,
          signerName: customerName,
          signatureDate: new Date().toISOString(),
        });

        if (!signResult || !signResult.success) {
          throw new Error("Failed to process signature with ThanksRoger API");
        }

        // Update the signing progress with the signature data
        if (signingProgressId) {
          await storage.updateApplicationProgressCompletion(
            signingProgressId,
            true, // Mark as completed
            JSON.stringify({
              thankRogerContractId,
              signingLink,
              signatureId: signResult.signatureId,
              status: signResult.status,
              signedAt: signResult.signedAt,
              documentUrl: signResult.documentUrl,
            }),
          );
        } else {
          // Create a new signing progress if it doesn't exist
          const newProgress = await storage.createApplicationProgress({
            contractId: Number(contractId),
            step: "signing",
            completed: true,
            data: JSON.stringify({
              thankRogerContractId,
              signingLink,
              signatureId: signResult.signatureId,
              status: signResult.status,
              signedAt: signResult.signedAt,
              documentUrl: signResult.documentUrl,
            }),
          });
          signingProgressId = newProgress.id;
        }

        // Update contract status
        await storage.updateContractStep(Number(contractId), "completed");
        await storage.updateContractStatus(Number(contractId), "active");

        // Update the contract status in Thanks Roger to mark it as completed
        try {
          const success = await thanksRogerService.updateContractStatus({
            contractId: thankRogerContractId,
            status: "completed",
            completedAt: new Date().toISOString()
          });
          
          if (success) {
            logger.info({
              message: `Contract ${contractId} marked as completed in Thanks Roger`,
              category: "contract",
              source: "thanksroger",
              metadata: { contractId, thankRogerContractId }
            });
          } else {
            logger.warn({
              message: `Failed to update contract status in Thanks Roger (API returned false)`,
              category: "contract",
              source: "thanksroger",
              metadata: { contractId, thankRogerContractId }
            });
          }
        } catch (statusUpdateError) {
          logger.warn({
            message: `Failed to update contract status in Thanks Roger: ${statusUpdateError instanceof Error ? statusUpdateError.message : String(statusUpdateError)}`,
            category: "contract",
            source: "thanksroger",
            metadata: { contractId, thankRogerContractId }
          });
          // Continue despite the status update error - we've already got the signature
        }

        // Return success response
        return res.json({
          success: true,
          contractId: thankRogerContractId,
          signatureId: signResult.signatureId,
          signingLink,
          signedAt: signResult.signedAt,
          status: "completed", // Update status to reflect completion
          message: "Contract signed successfully",
        });
      } catch (error) {
        logger.error({
          message: `Error signing contract with ThanksRoger API: ${error instanceof Error ? error.message : String(error)}`,
          category: "contract",
          source: "thanksroger",
          metadata: { contractId, thankRogerContractId },
        });

        // Switch to fallback mode if API signing fails
        logger.info({
          message: "Switching to fallback mode after API signing failure",
          category: "contract",
          source: "thanksroger",
        });

        const signatureId = `local-sig-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        const signedAt = new Date().toISOString();

        // Update the signing progress with the local signature data
        if (signingProgressId) {
          await storage.updateApplicationProgressCompletion(
            signingProgressId,
            true, // Mark as completed
            JSON.stringify({
              thankRogerContractId, // Keep the ThanksRoger ID for reference
              signingLink,
              signatureId,
              status: "signed",
              signedAt,
              usingFallbackMode: true,
              apiError: error instanceof Error ? error.message : String(error),
            }),
          );
        } else {
          // Create a new signing progress
          const newProgress = await storage.createApplicationProgress({
            contractId: Number(contractId),
            step: "signing",
            completed: true,
            data: JSON.stringify({
              thankRogerContractId, // Keep the ThanksRoger ID for reference
              signingLink,
              signatureId,
              status: "signed",
              signedAt,
              usingFallbackMode: true,
              apiError: error instanceof Error ? error.message : String(error),
            }),
          });
          signingProgressId = newProgress.id;
        }

        // Update contract status
        await storage.updateContractStep(Number(contractId), "completed");
        await storage.updateContractStatus(Number(contractId), "active");

        // Return success with fallback notice
        return res.json({
          success: true,
          contractId: thankRogerContractId,
          signatureId,
          signingLink,
          signedAt,
          status: "signed",
          fallbackMode: true,
          message: "Contract signed successfully using fallback mode",
        });
      }
    } catch (error) {
      logger.error({
        message: `Contract signing error: ${error instanceof Error ? error.message : String(error)}`,
        category: "contract",
        source: "thanksroger",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      return res.status(500).json({
        success: false,
        message:
          "An unexpected error occurred while processing your signature. Please try again or contact support.",
      });
    }
  });
  // Thanks Roger electronic signature endpoint
  apiRouter.post(
    "/mock/thanks-roger-signing",
    async (req: Request, res: Response) => {
      try {
        // Check if this is a test request from the admin panel
        if (
          req.body.documentId &&
          req.body.signerName &&
          req.body.signerEmail
        ) {
          // This is a test request from the admin API verification
          console.log("Processing test Thanks Roger signing request");

          // Create test log entry
          await storage.createLog({
            level: "info",
            category: "api",
            source: "thanksroger",
            message: `Test signature for ${req.body.signerName} (${req.body.signerEmail})`,
            metadata: JSON.stringify(req.body),
          });

          // Return success for test
          return res.json({
            success: true,
            message: "Test document signing successful",
            signatureId:
              "TEST-SIG-" + Math.floor(10000000 + Math.random() * 90000000),
            signedAt: new Date().toISOString(),
            status: "signed",
            documentUrl: "https://example.com/test-documents/signed.pdf",
          });
        }

        // Regular contract flow
        const { contractId, signatureData, customerName } = req.body;

        if (!contractId || !signatureData || !customerName) {
          return res.status(400).json({
            message:
              "Contract ID, signature data, and customer name are required",
          });
        }

        // Check if Thanks Roger API key is available
        const thanksRogerApiKey = process.env.THANKSROGER_API_KEY;

        if (!thanksRogerApiKey) {
          console.warn(
            "Thanks Roger API key not configured, falling back to simulation",
          );
        } else {
          try {
            // Use the Thanks Roger API for electronic signatures
            console.log(
              `Using Thanks Roger API key (${thanksRogerApiKey.substring(0, 3)}...${thanksRogerApiKey.substring(thanksRogerApiKey.length - 3)}) for contract signing`,
            );

            // In a production environment, we would make an actual API call
            // For demo purposes, we'll simulate a successful signature
            // but use the real API key in our logs

            // In a production environment, this is how we would make the call:
            /*
          const signatureResponse = await fetch("https://api.thanksroger.com/v1/signatures", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${thanksRogerApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contractId: contractId.toString(),
              signatureData,
              signerName: customerName,
              contractNumber: `SHI-${contractId.toString().padStart(4, '0')}`,
              timestamp: new Date().toISOString()
            })
          });

          if (!signatureResponse.ok) {
            throw new Error(`Thanks Roger API error: ${signatureResponse.status} ${`signatureResponse.statusText}`);
          }

          const data = await signatureResponse.json();
          if (!data.success) {
            throw new Error(`Signature submission failed: ${data.message || 'Unknown error'}`);
          }
          */

            console.log(
              `Simulating successful Thanks Roger API call for contract ${contractId} signature`,
            );
          } catch (signingError) {
            console.error("Thanks Roger API error:", signingError);
            throw signingError;
          }
        }

        // Create log for contract signing
        await storage.createLog({
          level: "info",
          category: "contract",
          source: "thanksroger",
          message: `Contract ${contractId} signed by ${customerName}`,
          metadata: JSON.stringify({ contractId, customerName }),
        });

        // Simulate successful API response
        setTimeout(() => {
          const response = {
            success: true,
            signatureId:
              "SIG" + Math.floor(10000000 + Math.random() * 90000000),
            contractId,
            signedAt: new Date().toISOString(),
            status: "signed",
            documentUrl: "https://example.com/contracts/signed.pdf",
          };

          res.json(response);
        }, 1000); // Simulate API delay
      } catch (error) {
        console.error("Contract signing error:", error);

        // Create error log
        await storage.createLog({
          level: "error",
          category: "contract",
          source: "thanksroger",
          message: `Failed contract signing: ${error instanceof Error ? error.message : String(error)}`,
          metadata: JSON.stringify({
            error: error instanceof Error ? error.stack : null,
          }),
        });

        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // DiDit KYC Webhook endpoint - for receiving status updates from DiDit
  // Webhook endpoint for DiDit KYC verification process
  // DiDit KYC Webhook endpoint - for receiving status updates from DiDit
  apiRouter.post("/kyc/webhook", async (req: Request, res: Response) => {
    try {
      // Extract webhook signature from headers for verification
      const webhookSignature = req.headers["x-signature"] as string;
      const webhookTimestamp = req.headers["x-timestamp"] as string;

      // Get the webhook secret from environment variables
      const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET_KEY;

      // Log the complete webhook data for debugging
      logger.info({
        message: `DiDit Webhook - Complete Data`,
        category: "api",
        source: "didit",
        metadata: {
          fullBody: req.body,
          headers: {
            signature: webhookSignature,
            timestamp: webhookTimestamp,
            contentType: req.headers['content-type'],
            userAgent: req.headers['user-agent']
          }
        },
      });

      // Log the receipt of webhook (original log)
      logger.info({
        message: `Received DiDit webhook event`,
        category: "api",
        source: "didit",
        metadata: {
          eventType: req.body.event_type || req.body.status,
          sessionId: req.body.session_id,
          body: req.body,
        },
      });

      // Verify the webhook signature if we have the secret
      let isVerified = false;

      if (webhookSecret && webhookSignature && req.body) {
        try {
          // Store the raw body for signature verification
          const rawBody = JSON.stringify(req.body);

          // Create HMAC signature using the webhook secret
          const hmac = crypto.createHmac("sha256", webhookSecret);
          const expectedSignature = hmac.update(rawBody).digest("hex");

          // Verify the signature
          isVerified = expectedSignature === webhookSignature;

          logger.info({
            message: `DiDit webhook signature verification: ${isVerified ? "success" : "failed"}`,
            category: "api",
            source: "didit",
            metadata: {
              expectedSignature,
              receivedSignature: webhookSignature,
            },
          });

          // Verify the timestamp is recent (within 5 minutes)
          if (isVerified && webhookTimestamp) {
            const currentTime = Math.floor(Date.now() / 1000);
            const incomingTime = parseInt(webhookTimestamp, 10);
            if (Math.abs(currentTime - incomingTime) > 300) {
              logger.warn({
                message: "DiDit webhook timestamp is stale",
                category: "api",
                source: "didit",
                metadata: {
                  currentTime,
                  incomingTime,
                  difference: Math.abs(currentTime - incomingTime),
                },
              });
              isVerified = false;
            }
          }
        } catch (verifyError) {
          logger.error({
            message: `Error verifying DiDit webhook signature: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`,
            category: "api",
            source: "didit",
            metadata: {
              error: verifyError instanceof Error ? verifyError.stack : null,
            },
          });
          isVerified = false;
        }
      }

      // Extract key information from the webhook
      const { event_type, session_id, status, decision, vendor_data } =
        req.body;

      // Parse vendor_data to extract contractId
      let contractId = null;
      try {
        if (vendor_data) {
          const parsedData = JSON.parse(vendor_data);
          contractId = parsedData.contractId;
        }
      } catch (error) {
        logger.warn({
          message: `Failed to parse vendor_data in DiDit webhook: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "didit",
          metadata: { vendor_data },
        });
      }

      logger.info({
        message: `Processing DiDit webhook for contract ${contractId}, session ${session_id}`,
        category: "api",
        source: "didit",
        metadata: {
          contractId,
          sessionId: session_id,
          status: status || event_type,
          isVerified,
        },
      });

      if (!contractId) {
        logger.warn({
          message: "Missing contractId in DiDit webhook vendor_data",
          category: "api",
          source: "didit",
          metadata: { vendor_data },
        });
        return res.status(200).json({
          status: "success",
          message: "Webhook received but no contractId found",
        });
      }

      // Handle verification.completed event
      if (
        event_type === "verification.completed" ||
        status === "Approved" ||
        status === "Declined"
      ) {
        logger.info({
          message: `DiDit verification completed for session ${session_id}, contract ${contractId}`,
          category: "api",
          source: "didit",
          metadata: {
            sessionId: session_id,
            contractId,
            status,
            decisionStatus: decision?.status,
            decisionDetails: decision, // Log complete decision object
          },
        });

        // Check if verification was approved
        const isApproved =
          decision?.status === "approved" ||
          status === "Approved" ||
          status === "approved" ||
          status === "completed";

        try {
          // Get the contract to find the associated customer
          const contract = await storage.getContract(parseInt(contractId));
          if (!contract) {
            throw new Error(`Contract ${contractId} not found`);
          }

          // Ensure the contract has a customerId - this is critical for KYC flow
          if (!contract.customerId || contract.phoneNumber) {
            if (contract.phoneNumber) {
              const normalizedPhone = contract.phoneNumber.replace(/\D/g, '');

              logger.info({
                message: `Looking up user by phone number for contract ${contractId}`,
                category: "api",
                source: "didit",
                metadata: { contractId, phoneNumber: normalizedPhone },
              });

              // Find existing user first to prevent duplicate users
              let user = await storage.getUserByPhone(normalizedPhone);

              // If no user exists, create one
              if (!user) {
                user = await storage.findOrCreateUserByPhone(normalizedPhone);
                logger.info({
                  message: `Created new user for phone ${normalizedPhone}`,
                  category: "api",
                  source: "didit",
                  metadata: { contractId, userId: user.id },
                });
              } else {
                logger.info({
                  message: `Found existing user by phone ${normalizedPhone}`,
                  category: "api",
                  source: "didit",
                  metadata: { contractId, userId: user.id },
                });
              }

              if (user) {
                // Update the contract with the user ID
                await storage.updateContractCustomerId(parseInt(contractId), user.id);
                logger.info({
                  message: `Updated contract ${contractId} with user ID ${user.id}`,
                  category: "api",
                  source: "didit",
                  metadata: { contractId, userId: user.id },
                });

                // Create an authentication record for this user and contract
                await storage.createLog({
                  level: "info",
                  message: `KYC authentication established for user ${user.id} via phone ${normalizedPhone}`,
                  category: "security",
                  source: "didit", // Changed from "kyc" to "didit"
                  userId: user.id,
                  metadata: JSON.stringify({
                    contractId,
                    phoneNumber: normalizedPhone,
                    verification: "completed"
                  }),
                });
              }
            } else {
              logger.warn({
                message: `Contract ${contractId} has no customerId or phone number`,
                category: "api",
                source: "didit",
                metadata: { contractId },
              });
            }
          }

          // Find the KYC step in the application progress
          const applicationProgress =
            await storage.getApplicationProgressByContractId(
              parseInt(contractId),
            );
          const kycStep = applicationProgress.find(
            (step) => step.step === "kyc",
          );

          if (kycStep) {
            if (isApproved) {
              // Get any customer details from the verification if available
              const customerDetails = decision?.kyc || {};

              // Log the customer details
              logger.info({
                message: `DiDit customer details for contract ${contractId}`,
                category: "api",
                source: "didit",
                metadata: {
                  contractId,
                  customerDetails,
                },
              });

              // Mark the KYC step as completed
              await storage.updateApplicationProgressCompletion(
                kycStep.id,
                true, // Completed
                JSON.stringify({
                  verified: true,
                  sessionId: session_id,
                  verifiedAt: new Date().toISOString(),
                  firstName: customerDetails.first_name,
                  lastName: customerDetails.last_name,
                  documentType: customerDetails.document_type,
                  documentNumber: customerDetails.document_number,
                  dateOfBirth: customerDetails.date_of_birth,
                  completedVia: "webhook",
                }),
              );

              // Get the updated contract info after potential user assignment
              const updatedContract = await storage.getContract(parseInt(contractId));

              // Move the contract to the next step
              if (updatedContract && updatedContract.currentStep === "kyc") {
                await storage.updateContractStep(parseInt(contractId), "bank");

                // Log step advancement
                logger.info({
                  message: `Advanced contract ${contractId} from KYC to bank step`,
                  category: "contract",
                  source: "didit",
                  metadata: { contractId, previousStep: "kyc", newStep: "bank" },
                });
              }

              // ===== BEGIN PREFI INTEGRATION =====
              // If we have a user associated with the contract, send pre-qualification request
              if (updatedContract && updatedContract.customerId) {
                try {
                  // Get user data
                  const user = await storage.getUser(updatedContract.customerId);

                  if (user) {
                    // Get customer IP from request if available, or use a default
                    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

                    console.log(`Initiating Pre-Fi pre-qualification for user ${user.id} after successful KYC verification`);

                    // Send pre-qualification request
                    const prequalResult = await preFiService.preQualifyUser({
                      firstName: user.firstName || customerDetails.first_name || '',
                      lastName: user.lastName || customerDetails.last_name || '',
                      email: user.email || '',
                      phone: updatedContract.phoneNumber || user.phone || '',
                      userId: user.id,
                      contractId: updatedContract.id
                    }, ipAddress.toString());

                    // Console log the full response
                    console.log('COMPLETE PRE-FI RESPONSE:', JSON.stringify(prequalResult, null, 2));

                    // Log structured success info
                    if (prequalResult && prequalResult.Status === 'Success') {
                      logger.info({
                        message: `Pre-qualification successful for user ${user.id}`,
                        category: "underwriting",
                        source: "prefi",
                        metadata: {
                          userId: user.id,
                          contractId: updatedContract.id,
                          offersCount: prequalResult.Offers?.length || 0,
                          // More detailed logging
                          offers: prequalResult.Offers,
                          dataPerfection: prequalResult.DataPerfection
                        }
                      });

                      // At this point, you would normally store the result in your database
                      // But as requested, we're just logging for now
                    }
                  }
                } catch (prequalError) {
                  // Log error but don't fail the webhook processing
                  console.error('Pre-Fi pre-qualification error:', prequalError);

                  logger.error({
                    message: `Error during Pre-Fi pre-qualification after KYC: ${prequalError instanceof Error ? prequalError.message : String(prequalError)}`,
                    category: "api",
                    source: "prefi",
                    metadata: {
                      contractId: updatedContract.id,
                      userId: updatedContract.customerId,
                      error: prequalError instanceof Error ? prequalError.stack : null
                    }
                  });
                }
              }
              // ===== END PREFI INTEGRATION =====

              // Update user information if we have customer details
              if (updatedContract && (customerDetails.first_name || customerDetails.last_name)) {
                try {
                  // First check if we have a customerId on the contract
                  let userIdToUpdate = updatedContract.customerId;

                  // If no customerId but we have a phone number, find or create a user
                  if (!userIdToUpdate && updatedContract.phoneNumber) {
                    logger.info({
                      message: `No customer ID found, looking up by phone ${updatedContract.phoneNumber}`,
                      category: "api",
                      source: "didit",
                      metadata: { contractId: updatedContract.id }
                    });

                    // Find or create user by phone number
                    const user = await storage.findOrCreateUserByPhone(updatedContract.phoneNumber);

                    if (user) {
                      // Update the contract with the user ID
                      await storage.updateContractCustomerId(updatedContract.id, user.id);
                      userIdToUpdate = user.id;

                      logger.info({
                        message: `Linked contract ${updatedContract.id} to user ${user.id} by phone ${updatedContract.phoneNumber}`,
                        category: "api",
                        source: "didit",
                        metadata: { contractId: updatedContract.id, userId: user.id }
                      });
                    }
                  }

                  // Now update the user name if we have a user ID
                  if (userIdToUpdate) {
                    // Update user's name based on KYC verification
                    await storage.updateUserName(
                      userIdToUpdate,
                      customerDetails.first_name,
                      customerDetails.last_name
                    );

                    logger.info({
                      message: `Updated user ${userIdToUpdate} name information from KYC data`,
                      category: "api",
                      source: "didit",
                      metadata: { 
                        userId: userIdToUpdate,
                        firstName: customerDetails.first_name,
                        lastName: customerDetails.last_name
                      },
                    });
                  } else {
                    logger.warn({
                      message: `Could not find user to update with KYC data for contract ${updatedContract.id}`,
                      category: "api",
                      source: "didit",
                      metadata: { contractId: updatedContract.id }
                    });
                  }
                } catch (userUpdateError) {
                  logger.error({
                    message: `Error updating user information: ${userUpdateError instanceof Error ? userUpdateError.message : String(userUpdateError)}`,
                    category: "api",
                    source: "didit",
                    metadata: {
                      userId: updatedContract.customerId,
                      contractId: updatedContract.id,
                      error: userUpdateError instanceof Error ? userUpdateError.stack : null,
                    },
                  });
                }
              }

              logger.info({
                message: `KYC verification approved for contract ${contractId}`,
                category: "contract",
                source: "didit", // Added source to maintain consistency
                metadata: { 
                  contractId, 
                  kycStepId: kycStep.id,
                  userId: updatedContract?.customerId
                },
              });
            } else {
              // Mark verification as failed but don't complete the step
              await storage.updateApplicationProgressCompletion(
                kycStep.id,
                false, // Not completed
                JSON.stringify({
                  verified: false,
                  sessionId: session_id,
                  status: decision?.status || status,
                  timestamp: new Date().toISOString(),
                  reason: "Verification declined or incomplete",
                }),
              );

              logger.warn({
                message: `KYC verification failed for contract ${contractId}`,
                category: "contract",
                source: "didit", // Added source to maintain consistency
                metadata: {
                  contractId,
                  kycStepId: kycStep.id,
                  status: decision?.status || status,
                },
              });
            }
          } else {
            logger.error({
              message: `Could not find KYC step for contract ${contractId}`,
              category: "contract",
              source: "didit", // Added source to maintain consistency
              metadata: { contractId, applicationProgress },
            });
          }
        } catch (storageError) {
          logger.error({
            message: `Error updating application progress for contract ${contractId}: ${storageError instanceof Error ? storageError.message : String(storageError)}`,
            category: "api",
            source: "didit",
            metadata: {
              contractId,
              sessionId: session_id,
              error: storageError instanceof Error ? storageError.stack : null,
            },
          });
        }
      } else if (event_type === "verification.started") {
        logger.info({
          message: `DiDit verification started for session ${session_id}, contract ${contractId}`,
          category: "api",
          source: "didit",
          metadata: { sessionId: session_id, contractId },
        });
      } else if (event_type === "verification.cancelled") {
        logger.info({
          message: `DiDit verification cancelled for session ${session_id}, contract ${contractId}`,
          category: "api",
          source: "didit",
          metadata: { sessionId: session_id, contractId },
        });
      }

      // Always respond with 200 OK to acknowledge receipt of the webhook
      return res.status(200).json({ status: "success" });
    } catch (error) {
      logger.error({
        message: `Error processing DiDit webhook: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      // Always return 200 to prevent DiDit from retrying (prevents duplicate processing)
      return res.status(200).json({
        status: "error",
        error_message: "Error processing webhook, but acknowledged receipt",
      });
    }
  });

  // API Key verification endpoints
  apiRouter.get("/verify-api-keys", async (req: Request, res: Response) => {
    try {
      const results = {
        twilio: {
          configured: false,
          valid: false,
          message: "",
        },
        didit: {
          configured: false,
          valid: false,
          message: "",
        },
        plaid: {
          configured: false,
          valid: false,
          message: "",
        },
        thanksroger: {
          configured: false,
          valid: false,
          message: "",
        },
      };

      // Check Twilio credentials using our Twilio service
      results.twilio.configured = twilioService.isInitialized();

      if (results.twilio.configured) {
        try {
          // Use our service to validate credentials
          results.twilio.valid = await twilioService.validateCredentials();

          if (results.twilio.valid) {
            results.twilio.message =
              "Twilio credentials validated successfully";
          } else {
            results.twilio.message =
              "Twilio credentials invalid - authentication failed";
          }
        } catch (twilioError) {
          console.error("Twilio API verification error:", twilioError);
          results.twilio.message = `Twilio API error: ${twilioError instanceof Error ? twilioError.message : String(twilioError)}`;
        }
      } else {
        results.twilio.message = "Twilio credentials not configured";
      }

      // Check DiDit credentials using our DiDit service
      results.didit.configured = diditService.isInitialized();

      if (results.didit.configured) {
        try {
          // Use our service to validate credentials
          results.didit.valid = await diditService.validateCredentials();

          if (results.didit.valid) {
            results.didit.message = "DiDit credentials validated successfully";

            // Check if webhook secret is configured
            if (process.env.DIDIT_WEBHOOK_SECRET_KEY) {
              results.didit.message += " (webhook secret configured)";
            } else {
              results.didit.message += " (webhook secret not configured)";
            }
          } else {
            results.didit.message =
              "DiDit credentials invalid - authentication failed";
          }
        } catch (diditError) {
          console.error("DiDit API verification error:", diditError);
          results.didit.message = `DiDit API error: ${diditError instanceof Error ? diditError.message : String(diditError)}`;
        }
      } else {
        results.didit.message = "DiDit client credentials not configured";
      }

      // Check Plaid credentials with actual API call
      const plaidClientId = process.env.PLAID_CLIENT_ID;
      const plaidSecret = process.env.PLAID_SECRET;

      if (plaidClientId && plaidSecret) {
        results.plaid.configured = true;

        try {
          // Make an actual API call to Plaid to validate credentials
          const plaidResponse = await fetch(
            "https://sandbox.plaid.com/institutions/get",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                client_id: plaidClientId,
                secret: plaidSecret,
                count: 1,
                offset: 0,
                country_codes: ["US"],
              }),
            },
          );

          if (plaidResponse.ok) {
            results.plaid.valid = true;
            results.plaid.message = "Plaid credentials validated successfully";
          } else {
            results.plaid.message = `Plaid credentials invalid: ${plaidResponse.status} ${plaidResponse.statusText}`;
          }
        } catch (plaidError) {
          console.error("Plaid API verification error:", plaidError);
          results.plaid.message = `Plaid API error: ${plaidError instanceof Error ? plaidError.message : String(plaidError)}`;
        }
      } else {
        results.plaid.message = "Plaid credentials not configured";
      }

      // Check Thanks Roger API key with actual API call
      const thanksRogerApiKey = process.env.THANKSROGER_API_KEY;

      if (thanksRogerApiKey) {
        results.thanksroger.configured = true;

        try {
          // Make an actual API call to Thanks Roger to validate API key
          // Note: This is a placeholder URL, you'd need to replace with the actual Thanks Roger API endpoint
          const thanksRogerResponse = await fetch(
            "https://api.thanksroger.com/v1/status",
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${thanksRogerApiKey}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (thanksRogerResponse.ok) {
            results.thanksroger.valid = true;
            results.thanksroger.message =
              "Thanks Roger API key validated successfully";
          } else {
            results.thanksroger.message = `Thanks Roger API key invalid: ${thanksRogerResponse.status} ${thanksRogerResponse.statusText}`;
          }
        } catch (thanksRogerError) {
          console.error(
            "Thanks Roger API verification error:",
            thanksRogerError,
          );
          results.thanksroger.message = `Thanks Roger API error: ${thanksRogerError instanceof Error ? thanksRogerError.message : String(thanksRogerError)}`;
        }
      } else {
        results.thanksroger.message = "Thanks Roger API key not configured";
      }

      // Log the verification attempt
      await storage.createLog({
        level: "info",
        category: "system",
        source: "internal",
        message: "API key verification check performed",
        metadata: objectMetadata({
          twilioConfigured: results.twilio.configured,
          twilioValid: results.twilio.valid,
          diditConfigured: results.didit.configured,
          diditValid: results.didit.valid,
          plaidConfigured: results.plaid.configured,
          plaidValid: results.plaid.valid,
          thanksrogerConfigured: results.thanksroger.configured,
          thanksrogerValid: results.thanksroger.valid,
        }),
      });

      res.json(results);
    } catch (error) {
      console.error("API key verification error:", error);

      // Create error log
      await storage.createLog({
        level: "error",
        category: "system",
        source: "internal",
        message: `Failed API key verification: ${error instanceof Error ? error.message : String(error)}`,
        metadata: objectMetadata({
          error: error instanceof Error ? error.stack : null,
        }),
      });

      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Plaid API Routes

  // Handle merchant signup flow
  
  // Step 1: Create a link token specifically for merchant signup flow
  apiRouter.get(
    "/plaid/merchant-signup-link-token",
    async (req: Request, res: Response) => {
      try {
        // Generate a temporary ID for merchant signup flow
        const clientUserId = `merchant-signup-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        logger.info({
          message: `Creating Plaid link token for merchant signup`,
          category: "api", 
          source: "plaid",
          metadata: {
            clientUserId,
            flowType: "merchant_signup"
          },
        });
        
        // Check if Plaid is properly initialized
        if (!plaidService.isInitialized()) {
          logger.error({
            message: "Plaid service not initialized when trying to create merchant signup link token",
            category: "api",
            source: "plaid",
            metadata: {
              clientUserId
            },
          });
          
          return res.status(503).json({
            success: false,
            message: "Plaid service is not available. Please try again later.",
            error_code: "PLAID_NOT_INITIALIZED"
          });
        }
        
        // For merchant verification, we specifically need these products
        // to validate revenue requirements
        const merchantProducts = ["auth", "transactions", "assets"];
        
        const linkTokenResponse = await plaidService.createLinkToken({
          userId: clientUserId,
          clientUserId,
          products: merchantProducts,
        });
        
        res.json({
          success: true,
          linkToken: linkTokenResponse.linkToken,
          link_token: linkTokenResponse.linkToken, // For backward compatibility
          expiration: linkTokenResponse.expiration,
          merchant_id: clientUserId // Used to track this signup process
        });
      } catch (error) {
        // Extract more detailed error information for logging
        let errorDetails = "Unknown error";
        let errorCode = "UNKNOWN";
        
        if (error.response?.data) {
          errorDetails = JSON.stringify(error.response.data);
          errorCode = error.response.data.error_code || "UNKNOWN";
        }
        
        logger.error({
          message: `Failed to create merchant signup Plaid link token: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "plaid",
          metadata: {
            errorDetails,
            errorCode,
            errorStack: error instanceof Error ? error.stack : null
          }
        });
        
        res.status(500).json({
          success: false,
          message: "Failed to create Plaid link token for merchant signup",
          error_code: errorCode,
        });
      }
    }
  );
  
  // Step 2: Process merchant bank connection and begin verification
  apiRouter.post(
    "/plaid/merchant-signup-exchange",
    async (req: Request, res: Response) => {
      try {
        const { publicToken, merchantId, businessInfo } = req.body;
        
        if (!publicToken) {
          return res.status(400).json({
            success: false,
            message: "Public token is required",
            error_code: "MISSING_PUBLIC_TOKEN"
          });
        }
        
        if (!merchantId || !merchantId.startsWith('merchant-signup-')) {
          return res.status(400).json({
            success: false,
            message: "Valid merchant ID is required",
            error_code: "INVALID_MERCHANT_ID"
          });
        }
        
        logger.info({
          message: "Processing merchant signup bank connection",
          category: "api",
          source: "plaid",
          metadata: { 
            merchantId,
            hasBusinessInfo: !!businessInfo
          },
        });
        
        // Exchange public token for access token
        const exchangeResponse = await plaidService.exchangePublicToken(publicToken);
        
        // Get accounts and bank account details (routing, account numbers)
        const authData = await plaidService.getAuth(exchangeResponse.accessToken);
        
        // Get transactions history to analyze revenue
        // In a production app, you'd initiate a transactions sync session here
        // For now, we'll skip that part and focus on validating bank connection
        
        // Create an asset report to analyze the merchant's financial data
        // This helps validate their revenue claims ($100k/month for 2 years minimum)
        const assetReportResponse = await plaidService.createAssetReport(
          exchangeResponse.accessToken,
          730, // 2 years of data (days)
          { client_report_id: merchantId }
        );
        
        // Store the merchant data
        // In a real app, you'd store this in your database
        // Here we'll just log it
        logger.info({
          message: "Merchant bank connection successful",
          category: "api",
          source: "plaid",
          metadata: {
            merchantId,
            itemId: exchangeResponse.itemId,
            accessToken: "[REDACTED]", // Never log actual access tokens
            assetReportId: assetReportResponse.assetReportId,
            assetReportToken: assetReportResponse.assetReportToken,
            accountCount: authData.accounts.length
          }
        });
        
        // Now create a DiDit verification session for KYC
        try {
          // Create a callback URL that includes the merchant ID
          const callbackUrl = `${req.protocol}://${req.get('host')}/merchant/verification-complete?merchantId=${merchantId}`;
          
          logger.info({
            message: "Creating DiDit verification session for merchant signup",
            category: "api",
            source: "didit",
            metadata: { 
              merchantId,
              callbackUrl 
            }
          });
          
          // Create the verification session
          const kycSession = await diditService.createVerificationSession({
            contractId: merchantId,
            callbackUrl,
            requiredFields: ['first_name', 'last_name', 'date_of_birth', 'document_number']
          });
          
          if (!kycSession) {
            throw new Error('Failed to create KYC verification session');
          }
          
          logger.info({
            message: "DiDit verification session created successfully",
            category: "api",
            source: "didit",
            metadata: { 
              merchantId,
              sessionId: kycSession.session_id,
              sessionUrl: kycSession.session_url
            }
          });
          
          // Return success with merchant bank information and KYC session details
          res.json({
            success: true,
            message: "Bank account connected successfully",
            merchant_id: merchantId,
            accounts: authData.accounts.map(account => ({
              id: account.account_id,
              name: account.name,
              mask: account.mask,
              type: account.type,
              subtype: account.subtype,
              balance: account.balances.current,
              currency: account.balances.iso_currency_code
            })),
            verification_status: "pending",
            verification_message: "Your bank account is being verified. We're analyzing your transaction history to confirm your business meets our revenue requirements.",
            kycSessionId: kycSession.session_id,
            kycSessionUrl: kycSession.session_url
          });
        } catch (kycError) {
          logger.error({
            message: `Failed to create DiDit verification session: ${kycError instanceof Error ? kycError.message : String(kycError)}`,
            category: "api",
            source: "didit",
            metadata: {
              merchantId,
              error: kycError instanceof Error ? kycError.stack : String(kycError)
            }
          });
          
          // Still return success for bank connection but note the KYC session creation failure
          res.json({
            success: true,
            message: "Bank account connected successfully, but identity verification setup failed",
            merchant_id: merchantId,
            accounts: authData.accounts.map(account => ({
              id: account.account_id,
              name: account.name,
              mask: account.mask,
              type: account.type,
              subtype: account.subtype,
              balance: account.balances.current,
              currency: account.balances.iso_currency_code
            })),
            verification_status: "pending",
            verification_message: "Your bank account is being verified, but identity verification setup failed. Please try again later."
          });
        }
      } catch (error) {
        // Extract more detailed error information for logging
        let errorDetails = "Unknown error";
        let errorCode = "UNKNOWN";
        
        if (error.response?.data) {
          errorDetails = JSON.stringify(error.response.data);
          errorCode = error.response.data.error_code || "UNKNOWN";
        }
        
        logger.error({
          message: `Failed to process merchant bank connection: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "plaid",
          metadata: {
            errorDetails,
            errorCode,
            errorStack: error instanceof Error ? error.stack : null
          }
        });
        
        res.status(500).json({
          success: false,
          message: "Failed to connect bank account for merchant verification",
          error_code: errorCode,
        });
      }
    }
  );

  // Create a link token - used to initialize Plaid Link
  apiRouter.all(
    "/plaid/create-link-token",
    async (req: Request, res: Response) => {
      try {
        const { userId, userName, userEmail, products, redirectUri, isSignup } = req.body;
        
        let clientUserId;
        
        // For merchant signup flow or situations where userId isn't available yet
        if (!userId && (isSignup || req.method === 'GET')) {
          // Generate a temporary ID for signup flow
          clientUserId = `signup-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
          
          logger.info({
            message: `Creating Plaid link token for merchant signup`,
            category: "api", 
            source: "plaid",
            metadata: {
              clientUserId,
              isSignup: true
            },
          });
        } else if (!userId) {
          return res.status(400).json({
            success: false,
            message: "User ID is required",
          });
        } else {
          clientUserId = userId.toString();
          
          logger.info({
            message: `Creating Plaid link token for user ${clientUserId}`,
            category: "api",
            source: "plaid",
            metadata: {
              userId: clientUserId,
              products,
            },
          });
        }

        // Check if Plaid is properly initialized
        if (!plaidService.isInitialized()) {
          logger.error({
            message: "Plaid service not initialized when trying to create link token",
            category: "api",
            source: "plaid",
            metadata: {
              userId: clientUserId,
              isSignup: isSignup || req.method === 'GET'
            },
          });
          
          return res.status(503).json({
            success: false,
            message: "Plaid service is not available. Please try again later.",
            error: "PLAID_NOT_INITIALIZED"
          });
        }

        // Format products correctly for Plaid
        let formattedProducts = [];
        if (Array.isArray(products)) {
          formattedProducts = products;
        } else if (products) {
          formattedProducts = [products];
        } else {
          formattedProducts = ["auth", "transactions", "assets"]; // Default products
        }

        const linkTokenResponse = await plaidService.createLinkToken({
          userId: clientUserId,
          clientUserId,
          userName: userName || undefined, // Only pass if provided
          userEmail: userEmail || undefined, // Only pass if provided
          products: formattedProducts, 
          redirectUri, // Optional redirect URI for OAuth flow
        });

        res.json({
          success: true,
          linkToken: linkTokenResponse.linkToken,
          link_token: linkTokenResponse.linkToken, // For backward compatibility
          expiration: linkTokenResponse.expiration,
        });
      } catch (error) {
        // Extract more detailed error information for logging
        let errorDetails = "Unknown error";
        let errorCode = "UNKNOWN";
        
        if (error.response?.data) {
          errorDetails = JSON.stringify(error.response.data);
          errorCode = error.response.data.error_code || "UNKNOWN";
        }
        
        logger.error({
          message: `Failed to create Plaid link token: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "plaid",
          metadata: {
            errorDetails,
            errorCode,
            errorStack: error instanceof Error ? error.stack : null
          }
        });

        res.status(500).json({
          success: false,
          message: "Failed to create Plaid link token",
          error_code: errorCode,
        });
      }
    },
  );

  // Exchange public token for access token and store it
  // Exchange public token for access token and store it
apiRouter.post(
  "/plaid/set-access-token",
  async (req: Request, res: Response) => {
    try {
      const { publicToken, userId, contractId } = req.body;

      if (!publicToken) {
        return res.status(400).json({
          success: false,
          message: "Public token is required",
        });
      }

      if (!userId && !contractId) {
        return res.status(400).json({
          success: false,
          message: "Either userId or contractId is required",
        });
      }

      logger.info({
        message: "Exchanging Plaid public token",
        category: "api",
        source: "plaid",
        metadata: { userId, contractId },
      });

      // Exchange public token for access token
      const exchangeResponse =
        await plaidService.exchangePublicToken(publicToken);

      // Get accounts and bank account details (routing, account numbers)
      const authData = await plaidService.getAuth(
        exchangeResponse.accessToken,
      );

      // Store the access token and item ID in your database
      // In a real app, never return the access token to the client

      // Create a record of the user's bank information
      const bankInfo = {
        userId: userId ? parseInt(userId) : null,
        contractId: contractId ? parseInt(contractId) : null,
        accessToken: exchangeResponse.accessToken, // This should be encrypted in a real app
        itemId: exchangeResponse.itemId,
        accounts: authData.accounts,
        accountNumbers: authData.numbers,
        createdAt: new Date(),
      };

      // If contract ID is provided, update the contract's bank step
      if (contractId) {
        // Find the bank step in the application progress
        const applicationProgress =
          await storage.getApplicationProgressByContractId(
            parseInt(contractId),
          );
        const bankStep = applicationProgress.find(
          (step) => step.step === "bank",
        );

        if (bankStep) {
          // Store the selected account ID and relevant bank information
          // For demo, we'll use the first account
          const selectedAccount = authData.accounts[0];
          const accountNumbers = authData.numbers.ach.find(
            (account) => account.account_id === selectedAccount.account_id,
          );

          // Mark the bank step as completed
          await storage.updateApplicationProgressCompletion(
            bankStep.id,
            true, // Completed
            JSON.stringify({
              verified: true,
              completedAt: new Date().toISOString(),
              itemId: exchangeResponse.itemId,
              accountId: selectedAccount.account_id,
              accountName: selectedAccount.name,
              accountMask: selectedAccount.mask,
              accountType: selectedAccount.type,
              accountSubtype: selectedAccount.subtype,
              routingNumber: accountNumbers?.routing,
              accountNumber: accountNumbers?.account,
            }),
          );

          // Move the contract to the next step if currently on bank step
          const contract = await storage.getContract(parseInt(contractId));
          if (contract && contract.currentStep === "bank") {
            await storage.updateContractStep(parseInt(contractId), "payment");
          }
        }

        // NEW CODE: Create an asset report immediately after bank connection
        try {
          logger.info({
            message: `Creating asset report for contract ${contractId}`,
            category: "api",
            source: "plaid",
            metadata: { contractId, accessToken: "REDACTED" },
          });
          
          // Create the asset report (90 days is a common duration)
          const assetReportResult = await plaidService.createAssetReport(
            exchangeResponse.accessToken,
            90, // Request 90 days of data
            {
              client_report_id: `contract-${contractId}`,
              webhook: `${process.env.PUBLIC_URL || "https://8dc3f57a-133b-45a5-ba2b-9e2b16042657-00-572nlsfm974b.janeway.replit.dev"}`,
              // Include user data if available
              user: {
                client_user_id: userId || `contract-${contractId}`,
              }
            }
          );
          
          // Store the asset report token in your database
          await storage.storeAssetReportToken(
            parseInt(contractId),
            assetReportResult.assetReportToken,
            assetReportResult.assetReportId,
            {
              userId: userId ? parseInt(userId) : null,
              daysRequested: 90,
              createdAt: new Date()
            }
          );
          
          logger.info({
            message: `Asset report creation initiated for contract ${contractId}`,
            category: "api",
            source: "plaid",
            metadata: {
              contractId,
              assetReportId: assetReportResult.assetReportId,
              assetReportToken: "REDACTED" // Never log actual tokens
            },
          });
          
        } catch (assetReportError) {
          // Log the error but don't fail the entire request
          logger.error({
            message: `Failed to create asset report: ${assetReportError instanceof Error ? assetReportError.message : String(assetReportError)}`,
            category: "api",
            source: "plaid",
            metadata: {
              contractId,
              error: assetReportError instanceof Error ? assetReportError.stack : null,
            },
          });
          
          // Continue with the response - we don't want to fail bank connection
          // just because asset report creation failed
        }
      }

      // Create a log entry
      await storage.createLog({
        level: "info",
        category: "api",
        source: "plaid",
        message: `Bank account linked successfully`,
        userId: userId ? parseInt(userId) : null,
        metadata: JSON.stringify({
          contractId,
          itemId: exchangeResponse.itemId,
          accountsCount: authData.accounts.length,
        }),
      });

      // Return success response with account information
      // Do NOT include the access token in the response
      res.json({
        success: true,
        accounts: authData.accounts,
        itemId: exchangeResponse.itemId,
        message: "Bank account linked successfully",
      });
    } catch (error) {
      logger.error({
        message: `Failed to exchange Plaid public token: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      // Create error log
      await storage.createLog({
        level: "error",
        category: "api",
        source: "plaid",
        message: `Failed to link bank account: ${error instanceof Error ? error.message : String(error)}`,
        metadata: JSON.stringify({
          error: error instanceof Error ? error.stack : null,
        }),
      });

      res.status(500).json({
        success: false,
        message: "Failed to link bank account",
      });
    }
  },
);

  // Get account info for a specific user
  apiRouter.get("/plaid/accounts", async (req: Request, res: Response) => {
    try {
      const { userId, contractId } = req.query;

      if (!userId && !contractId) {
        return res.status(400).json({
          success: false,
          message: "Either userId or contractId is required",
        });
      }

      // In a real app, fetch the access token from your database
      // For this example, we'll assume you stored it when exchanging the public token
      let accessToken = "";

      if (userId) {
        // Fetch access token for this user from your database
        // For example:
        // const bankAccount = await db.query.bankAccounts.findFirst({
        //   where: eq(bankAccounts.userId, parseInt(userId as string))
        // });
        // accessToken = bankAccount?.accessToken;
      } else if (contractId) {
        // Fetch access token for this contract from your database
        // For example:
        // const bankAccount = await db.query.bankAccounts.findFirst({
        //   where: eq(bankAccounts.contractId, parseInt(contractId as string))
        // });
        // accessToken = bankAccount?.accessToken;

        // For demo purposes, let's get the bank information from the application progress
        const applicationProgress =
          await storage.getApplicationProgressByContractId(
            parseInt(contractId as string),
          );
        const bankStep = applicationProgress.find(
          (step) => step.step === "bank",
        );

        if (bankStep && bankStep.data) {
          try {
            const bankData = JSON.parse(bankStep.data);

            // Return the stored bank information without needing to call Plaid again
            return res.json({
              success: true,
              bankInfo: {
                accountId: bankData.accountId,
                accountName: bankData.accountName,
                accountMask: bankData.accountMask,
                accountType: bankData.accountType,
                accountSubtype: bankData.accountSubtype,
                routingNumber: bankData.routingNumber,
                accountNumber: bankData.accountNumber,
              },
            });
          } catch (parseError) {
            logger.error({
              message: `Failed to parse bank data: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
              category: "api",
              source: "plaid",
              metadata: {
                contractId,
                bankData: bankStep.data,
              },
            });
          }
        }
      }

      if (!accessToken) {
        return res.status(404).json({
          success: false,
          message: "No linked bank account found",
        });
      }

      // Call Plaid to get the latest account info
      const authData = await plaidService.getAuth(accessToken);

      res.json({
        success: true,
        accounts: authData.accounts,
        numbers: authData.numbers,
      });
    } catch (error) {
      logger.error({
        message: `Failed to get Plaid accounts: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      res.status(500).json({
        success: false,
        message: "Failed to get bank account information",
      });
    }
  });

  // Create a transfer (payment)
  apiRouter.post(
    "/plaid/create-transfer",
    async (req: Request, res: Response) => {
      try {
        const { contractId, amount, description, accessToken, accountId } = req.body;

        if (!contractId || !amount || !accessToken || !accountId) {
          return res.status(400).json({
            success: false,
            message: "Contract ID, amount, access token and account ID are required",
          });
        }

        // Create the transfer using Plaid service
        const transferResult = await plaidService.createTransfer({
          accessToken,
          accountId,
          amount,
          description: description || `Payment for contract ${contractId}`,
        });

        // Store transfer info in database
        await storage.createLog({
          level: "info",
          category: "payment",
          source: "plaid",
          message: `Transfer created for contract ${contractId}`,
          metadata: JSON.stringify({
            contractId,
            amount,
            transferId: transferResult.transferId,
            status: transferResult.status
          })
        });

        res.json({
          success: true,
          transferId: transferResult.transferId,
          status: transferResult.status
        });

        // Get contract details
        const contract = await storage.getContract(parseInt(contractId));
        if (!contract) {
          return res.status(404).json({
            success: false,
            message: "Contract not found",
          });
        }

        // Get customer details if available
        let customerName = "Customer";
        if (contract.customerId) {
          const customer = await storage.getUser(contract.customerId);
          if (customer) {
            customerName = customer.name;
          }
        }

        // Get the bank information from the application progress
        const applicationProgress =
          await storage.getApplicationProgressByContractId(
            parseInt(contractId),
          );
        const bankStep = applicationProgress.find(
          (step) => step.step === "bank",
        );

        if (!bankStep || !bankStep.completed || !bankStep.data) {
          return res.status(400).json({
            success: false,
            message: "Bank account not linked for this contract",
          });
        }

        // Parse bank data
        let bankData;
        try {
          bankData = JSON.parse(bankStep.data);
        } catch (parseError) {
          logger.error({
            message: `Failed to parse bank data: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            category: "api",
            source: "plaid",
            metadata: {
              contractId,
              bankData: bankStep.data,
            },
          });

          return res.status(50).json({
            success: false,
            message: "Failed to process bank information",
          });
        }

        // In a real app, fetch the access token from your database
        // For this example, we'll simulate the transfer creation

        // Log the transfer request
        logger.info({
          message: `Processing payment transfer for contract ${contractId}`,
          category: "payment",
          source: "plaid",
          metadata: {
            contractId,
            amount,
            description:
              description ||
              `Monthly payment for contract ${contract.contractNumber}`,
          },
        });

        // In a real implementation, you would:
        // 1. Retrieve the access token from your database
        // 2. Make the actual transfer API call
        // For now, we'll simulate a successful transfer

        const transferId = "tr_" + Math.random().toString(36).substring(2, 15);
        const status = "pending";

        // Create a record of the payment
        const paymentInfo = {
          contractId: parseInt(contractId),
          amount,
          description:
            description ||
            `Monthly payment for contract ${contract.contractNumber}`,
          transferId,
          status,
          accountId: bankData.accountId,
          createdAt: new Date(),
        };

        // In a real app, store this in your database
        // For example:
        // await db.insert(payments).values(paymentInfo);

        // Create a log entry
        await storage.createLog({
          level: "info",
          category: "payment",
          source: "plaid",
          message: `Payment initiated for contract ${contractId}`,
          metadata: JSON.stringify({
            contractId,
            amount,
            transferId,
            status,
          }),
        });

        // Return success response
        res.json({
          success: true,
          transferId,
          status,
          message: "Payment initiated successfully",
        });
      } catch (error) {
        logger.error({
          message: `Failed to create Plaid transfer: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "plaid",
          metadata: {
            error: error instanceof Error ? error.stack : null,
          },
        });

        // Create error log
        await storage.createLog({
          level: "error",
          category: "payment",
          source: "plaid",
          message: `Failed to initiate payment: ${error instanceof Error ? error.message : String(error)}`,
          metadata: JSON.stringify({
            error: error instanceof Error ? error.stack : null,
          }),
        });

        res.status(500).json({
          success: false,
          message: "Failed to initiate payment",
        });
      }
    },
  );

  // Create an asset report (for income verification / underwriting)
  apiRouter.post(
    "/plaid/create-asset-report",
    async (req: Request, res: Response) => {
      try {
        const { userId, contractId, accessToken, daysRequested = 60, options } = req.body;

        if (!userId && !contractId) {
          return res.status(400).json({
            success: false,
            message: "Either userId or contractId is required",
          });
        }

        if (!accessToken) {
          return res.status(400).json({
            success: false,
            message: "Access token is required",
          });
        }

        logger.info({
          message: `Creating asset report`,
          category: "api",
          source: "plaid",
          metadata: {
            userId,
            contractId,
            daysRequested,
          },
        });

        // Create the asset report using the Plaid service
        const assetReportResult = await plaidService.createAssetReport(
          accessToken,
          daysRequested,
          options
        );

        // Store the asset report information in the database
        const assetReportInfo = await storage.storeAssetReportToken(
          contractId ? parseInt(contractId) : 0,
          assetReportResult.assetReportToken,
          assetReportResult.assetReportId,
          {
            userId: userId ? parseInt(userId) : undefined,
            daysRequested,
          }
        );

        // Create a log entry
        await storage.createLog({
          level: "info",
          category: "api",
          source: "plaid",
          message: `Asset report created`,
          userId: userId ? parseInt(userId) : null,
          metadata: JSON.stringify({
            contractId,
            assetReportId: assetReportResult.assetReportId,
            daysRequested,
          }),
        });

        // Return success response
        // Do NOT include the asset report token in the response
        res.json({
          success: true,
          assetReportId: assetReportResult.assetReportId,
          message: "Asset report created successfully",
        });
      } catch (error) {
        logger.error({
          message: `Failed to create Plaid asset report: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "plaid",
          metadata: {
            error: error instanceof Error ? error.stack : null,
          },
        });

        // Create error log
        await storage.createLog({
          level: "error",
          category: "api",
          source: "plaid",message: `Failed to create asset report: ${error instanceof Error ? error.message : String(error)}`,
          metadata: JSON.stringify({
            error: error instanceof Error ? error.stack : null,
          }),
        });

        res.status(500).json({
          success: false,
          message: "Failed to create asset report",
        });
      }
    },
  );

  // Create asset report by phone number
  apiRouter.post(
    "/plaid/create-asset-report-by-phone",
    async (req: Request, res: Response) => {
      try {
        const { phoneNumber, accessToken, daysRequested = 60, options } = req.body;

        if (!phoneNumber) {
          return res.status(400).json({
            success: false,
            message: "Phone number is required",
          });
        }

        if (!accessToken) {
          return res.status(400).json({
            success: false,
            message: "Access token is required",
          });
        }

        logger.info({
          message: `Creating asset report by phone number`,
          category: "api",
          source: "plaid",
          metadata: {
            phoneNumber,
            daysRequested,
          },
        });

        // Create the asset report using the Plaid service
        const result = await plaidService.createAssetReportByPhone(
          accessToken,
          phoneNumber,
          daysRequested,
          options
        );

        // Create a log entry
        await storage.createLog({
          level: "info",
          category: "api",
          source: "plaid",
          message: `Asset report created by phone number`,
          userId: result.userId || null,
          metadata: JSON.stringify({
            phoneNumber,
            contractId: result.contractId,
            assetReportId: result.assetReportId,
            daysRequested,
          }),
        });

        // Return success response
        res.json({
          success: true,
          assetReportId: result.assetReportId,
          contractId: result.contractId,
          userId: result.userId,
          message: "Asset report created successfully",
        });
      } catch (error) {
        logger.error({
          message: `Failed to create Plaid asset report by phone: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "plaid",
          metadata: {
            error: error instanceof Error ? error.stack : null,
          },
        });

        // Create error log
        await storage.createLog({
          level: "error",
          category: "api",
          source: "plaid",
          message: `Failed to create asset report by phone: ${error instanceof Error ? error.message : String(error)}`,
          metadata: JSON.stringify({
            error: error instanceof Error ? error.stack : null,
          }),
        });

        res.status(500).json({
          success: false,
          message: "Failed to create asset report by phone",
        });
      }
    },
  );

  // Get an asset report
  apiRouter.get(
    "/plaid/asset-report/:assetReportId",
    async (req: Request, res: Response) => {
      try {
        const { assetReportId } = req.params;

        if (!assetReportId) {
          return res.status(400).json({
            success: false,
            message: "Asset report ID is required",
          });
        }

        logger.info({
          message: `Retrieving asset report`,
          category: "api",
          source: "plaid",
          metadata: { assetReportId },
        });

        // Fetch the asset report data from database using the assetReportId
        const assetReports = await storage.getAssetReportsByAssetReportId(assetReportId);

        if (!assetReports || assetReports.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Asset report not found",
          });
        }

        const assetReportData = assetReports[0];

        // Retrieve the actual asset report from Plaid
        const assetReport = await plaidService.getAssetReport(assetReportData.assetReportToken);

        // Create a log entry
        await storage.createLog({
          level: "info",
          category: "api",
          source: "plaid",
          message: `Asset report retrieved`,
          metadata: JSON.stringify({
            assetReportId,
          }),
        });

        // Return success response with the real asset report data
        res.json({
          success: true,
          assetReport: assetReport.report,
        });
      } catch (error) {
        logger.error({
          message: `Failed to get Plaid asset report: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "plaid",
          metadata: {
            error: error instanceof Error ? error.stack : null,
          },
        });

        // Create error log
        await storage.createLog({
          level: "error",
          category: "api",
          source: "plaid",
          message: `Failed to retrieve asset report: ${error instanceof Error ? error.message : String(error)}`,
          metadata: JSON.stringify({
            error: error instanceof Error ? error.stack : null,
          }),
        });

        res.status(500).json({
          success: false,
          message: "Failed to retrieve asset report",
        });
      }
    },
  );

  // Plaid webhook handler
 // Plaid webhook handler
apiRouter.post("/plaid/webhook", async (req: Request, res: Response) => {
  try {
    const { webhook_type, webhook_code, item_id, asset_report_id, report_type } = req.body;

    logger.info({
      message: `Received Plaid webhook`,
      category: "api",
      source: "plaid",
      metadata: {
        webhookType: webhook_type,
        webhookCode: webhook_code,
        itemId: item_id,
        assetReportId: asset_report_id,
        reportType: report_type
      },
    });

    // Handle different webhook types
    switch (webhook_type) {
      case "AUTH":
        switch (webhook_code) {
          case "SMS_MICRODEPOSITS_VERIFICATION":
            const { status, item_id, account_id } = req.body;
            logger.info({
              message: `Received micro-deposits verification webhook: ${status}`,
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id, accountId: account_id, status }
            });

            if (status === "MANUALLY_VERIFIED") {
              // Update application progress for the associated contract
              const contract = await storage.getContractByPlaidItemId(item_id);
              if (contract) {
                const progress = await storage.getApplicationProgressByContractId(contract.id);
                const bankStep = progress.find(p => p.step === "bank");
                if (bankStep) {
                  await storage.updateApplicationProgressCompletion(
                    bankStep.id,
                    true,
                    JSON.stringify({
                      verifiedByMicrodeposits: true,
                      verifiedAt: new Date().toISOString(),
                      verificationMethod: "sms"
                    })
                  );
                }
              }
            }
            break;
        }
        break;
        
      case "TRANSACTIONS":
        // Handle transaction webhooks
        switch (webhook_code) {
          case "INITIAL_UPDATE":
            logger.info({
              message: "Initial transaction update received",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
          case "HISTORICAL_UPDATE":
            logger.info({
              message: "Historical transaction update received",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
          case "DEFAULT_UPDATE":
            logger.info({
              message: "Default transaction update received",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
          case "TRANSACTIONS_REMOVED":
            logger.info({
              message: "Transactions removed notification received",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
        }
        break;

      case "ITEM":
        // Handle item webhooks
        switch (webhook_code) {
          case "ERROR":
            logger.warn({
              message: "Item error received",
              category: "api",
              source: "plaid",
              metadata: {
                itemId: item_id,
                error: req.body.error,
              },
            });
            break;
          case "PENDING_EXPIRATION":
            logger.warn({
              message: "Item pending expiration",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
          case "USER_PERMISSION_REVOKED":
            logger.warn({
              message: "User permission revoked",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
        }
        break;

      case "ASSETS":
        // Handle assets webhooks
        logger.info({
          message: `Assets webhook received: ${webhook_code}`,
          category: "api",
          source: "plaid",
          metadata: {
            itemId: item_id,
            assetReportId: asset_report_id,
            reportType: report_type
          },
        });

        if (webhook_code === "PRODUCT_READY") {
          try {
            // Find the asset report entry in our database using the asset report ID
            const assetReports = await storage.getAssetReportsByAssetReportId(asset_report_id);
            
            if (!assetReports || assetReports.length === 0) {
              logger.error({
                message: "Asset report not found in database",
                category: "api",
                source: "plaid",
                metadata: { assetReportId: asset_report_id }
              });
              break;
            }

            const assetReport = assetReports[0];
            
            // Use the asset_report_token to fetch the full report from Plaid
            logger.info({
              message: "Fetching full asset report from Plaid",
              category: "api",
              source: "plaid",
              metadata: { 
                assetReportId: asset_report_id,
                assetReportToken: "REDACTED" 
              }
            });

            // Request the report with insights for more detailed data
            const reportData = await plaidService.getAssetReport(
              assetReport.assetReportToken, 
              true // include_insights=true
            );
            console.log(reportData);

            // Store the full report in the database
            await storage.updateAssetReport(assetReport.id, {
              status: "completed",
              analysisData: JSON.stringify(reportData.report)
            });

            // Create a summary of the key financial information
            const report = reportData.report;
            const summaryData = {
              dateGenerated: report.date_generated,
              daysRequested: report.days_requested,
              itemsCount: report.items.length,
              accounts: []
            };

            // Collect account information
            let totalBalance = 0;
            let totalAvailableBalance = 0;
            let accountsCount = 0;
            
            report.items.forEach(item => {
              item.accounts.forEach(account => {
                accountsCount++;
                totalBalance += account.balances.current || 0;
                totalAvailableBalance += account.balances.available || 0;
                
                // Add account summary
                summaryData.accounts.push({
                  accountId: account.account_id,
                  name: account.name,
                  type: account.type,
                  subtype: account.subtype,
                  mask: account.mask,
                  balance: account.balances.current,
                  availableBalance: account.balances.available,
                  transactionsCount: account.transactions?.length || 0
                });
              });
            });

            // Add totals to summary
            summaryData.totalAccounts = accountsCount;
            summaryData.totalBalance = totalBalance;
            summaryData.totalAvailableBalance = totalAvailableBalance;

            // Log success with summary data
            logger.info({
              message: "Successfully processed asset report",
              category: "api",
              source: "plaid",
              metadata: {
                assetReportId: asset_report_id,
                contractId: assetReport.contractId,
                summary: summaryData
              }
            });

            // // If this report is associated with a contract, perform additional processing
            // if (assetReport.contractId) {
            //   try {
            //     // Get the contract details
            //     const contract = await storage.getContract(assetReport.contractId);
                
            //     if (contract) {
            //       // Run the underwriting analysis
            //       logger.info({
            //         message: `Running underwriting analysis for contract ${contract.id}`,
            //         category: "underwriting",
            //         source: "plaid",
            //         metadata: { contractId: contract.id }
            //       });
                  
            //       // Use Plaid's asset report analysis
            //       const analysisResult = await plaidService.analyzeAssetReportForUnderwriting(
            //         assetReport.assetReportToken
            //       );
                  
            //       // Store the analysis results
            //       await storage.updateAssetReport(assetReport.id, {
            //         analysisData: JSON.stringify({
            //           ...JSON.parse(assetReport.analysisData || '{}'),
            //           underwritingAnalysis: analysisResult
            //         })
            //       });
                  
            //       // Log the analysis results
            //       logger.info({
            //         message: `Completed underwriting analysis for contract ${contract.id}`,
            //         category: "underwriting",
            //         source: "plaid",
            //         metadata: {
            //           contractId: contract.id,
            //           income: analysisResult.income,
            //           debt: analysisResult.debt,
            //           employment: analysisResult.employment,
            //           housing: analysisResult.housing
            //         }
            //       });
            //     }
            //   } catch (analysisError) {
            //     logger.error({
            //       message: `Error performing underwriting analysis: ${analysisError instanceof Error ? analysisError.message : String(analysisError)}`,
            //       category: "underwriting",
            //       source: "plaid",
            //       metadata: {
            //         contractId: assetReport.contractId,
            //         error: analysisError instanceof Error ? analysisError.stack : null
            //       }
            //     });
            //   }
            // }
            
            // Fetch and store PDF version of the report
            try {
              logger.info({
                message: "Fetching asset report PDF",
                category: "api",
                source: "plaid",
                metadata: {
                  assetReportId: asset_report_id,
                  assetReportToken: "REDACTED"
                }
              });
              
              // Create directory if it doesn't exist
              const pdfDir = path.join(process.cwd(), 'asset_reports');
              if (!fs.existsSync(pdfDir)) {
                fs.mkdirSync(pdfDir, { recursive: true });
              }
              
              // Generate filename based on contractId (if available) and asset report ID
              const contractPrefix = assetReport.contractId ? `contract_${assetReport.contractId}_` : '';
              const filename = `${contractPrefix}asset_report_${asset_report_id}.pdf`;
              const filepath = path.join(pdfDir, filename);
              
              // Fetch the PDF data from Plaid
              const pdfResponse = await fetch("https://production.plaid.com/asset_report/pdf/get", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
                  "PLAID-SECRET": process.env.PLAID_SECRET
                },
                body: JSON.stringify({
                  asset_report_token: assetReport.assetReportToken
                })
              });
              
              if (!pdfResponse.ok) {
                throw new Error(`HTTP error! status: ${pdfResponse.status}`);
              }
              
              // Get the PDF data as buffer
              const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
              
              // Write to file
              fs.writeFileSync(filepath, pdfBuffer);
              
              // Update database with PDF path
              // await storage.updateAssetReport(assetReport.id, {
              //   pdfPath: filepath
              // });
              
              logger.info({
                message: "Successfully saved asset report PDF",
                category: "api",
                source: "plaid",
                metadata: {
                  assetReportId: asset_report_id,
                  filepath,
                  size: pdfBuffer.length
                }
              });
            } catch (pdfError) {
              logger.error({
                message: `Error getting asset report PDF: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`,
                category: "api",
                source: "plaid",
                metadata: {
                  assetReportId: asset_report_id,
                  error: pdfError instanceof Error ? pdfError.stack : null
                }
              });
            }
          } catch (error) {
            logger.error({
              message: `Failed to process asset report: ${error instanceof Error ? error.message : String(error)}`,
              category: "api",
              source: "plaid",
              metadata: {
                assetReportId: asset_report_id,
                error: error instanceof Error ? error.stack : null
              }
            });
          }
        }
        break;

      case "INCOME":
        // Handle income webhooks
        logger.info({
          message: `Income webhook received: ${webhook_code}`,
          category: "api",
          source: "plaid",
          metadata: { itemId: item_id },
        });
        break;

      case "TRANSFER":
        // Handle transfer webhooks
        switch (webhook_code) {
          case "TRANSFER_CREATED":
            logger.info({
              message: "Transfer created",
              category: "payment",
              source: "plaid",
              metadata: {
                itemId: item_id,
                transferId: req.body.transfer_id,
              },
            });
            break;
          case "TRANSFER_FAILED":
            logger.warn({
              message: "Transfer failed",
              category: "payment",
              source: "plaid",
              metadata: {
                itemId: item_id,
                transferId: req.body.transfer_id,
                failureReason: req.body.failure_reason,
              },
            });
            break;
          case "TRANSFER_COMPLETED":
            logger.info({
              message: "Transfer completed",
              category: "payment",
              source: "plaid",
              metadata: {
                itemId: item_id,
                transferId: req.body.transfer_id,
              },
            });
            break;
        }
        break;

      default:
        logger.info({
          message: `Unhandled Plaid webhook type: ${webhook_type}`,
          category: "api",
          source: "plaid",
          metadata: {
            webhookType: webhook_type,
            webhookCode: webhook_code,
            itemId: item_id,
          },
        });
    }

    // Always return a 200 status to acknowledge receipt of the webhook
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error({
      message: `Error processing Plaid webhook: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "plaid",
      metadata: {
        error: error instanceof Error ? error.stack : null,
        body: req.body,
      },
    });

    // Still return 200 to acknowledge receipt
    res.status(200).json({
      received: true,
      error: "Error processing webhook",
    });
  }
});
  // Mount the admin reports routers
  apiRouter.use("/admin/reports", reportsRouter);
  apiRouter.use("/admin", adminReportsRouter);
  
  // The admin router is already mounted above

  // Mount the underwriting router
  apiRouter.use("/underwriting", underwritingRouter);

  // Mount the contracts router
  apiRouter.use("/contracts", contractsRouter);

  // Mount the customers router
  apiRouter.use("/customers", customersRouter);

  // Mount the merchant router for multi-merchant operations (admin view)
  apiRouter.use("/merchants", merchantRouter);
  
  // Mount the merchant API router for authenticated merchant operations
  // This path is for the currently logged-in merchant to access their own dashboard
  apiRouter.use("/merchant-funding", merchantFundingRouter);
  
  // Mount the notification router
  apiRouter.use("/notifications", notificationRouter);

  // Mount the payment router
  apiRouter.use("/payments", paymentRouter);
  
  // Mount the health router
  apiRouter.use("/health", healthRouter);
  apiRouter.use("/blockchain", blockchainRouter);
  apiRouter.use("/sales-reps", salesRepRouter);
  apiRouter.use("/communications", communicationsRouter);
  // Also mount the conversations endpoint at /conversations for backward compatibility
  apiRouter.use("/conversations", communicationsRouter);
  // Also mount the support-tickets endpoint for backward compatibility
  apiRouter.use("/support-tickets", communicationsRouter);
  
  // Mount the SesameAI router for voice generation
  registerSesameAIRoutes(apiRouter);
  registerFinancialSherpaRoutes(apiRouter);

  // Get contract by phone number
  apiRouter.get("/contracts/by-phone/:phoneNumber", async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          message: "Phone number is required" 
        });
      }

      // Use the dedicated storage method to get contracts by phone number
      // This is more efficient as it uses a direct database query
      const matchingContracts = await storage.getContractsByPhoneNumber(phoneNumber);
      
      logger.info({
        message: `Fetched contracts by phone number: ${phoneNumber}`,
        category: "api",
        source: "internal",
        metadata: {
          phoneNumber,
          contractCount: matchingContracts.length
        }
      });

      if (matchingContracts.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No contracts found with this phone number"
        });
      }

      // Return all matching contracts as well as the most recent one
      // The storage method already sorts by createdAt in descending order
      const mostRecentContract = matchingContracts[0];

      return res.json({
        success: true,
        contract: mostRecentContract, // For backward compatibility
        contracts: matchingContracts, // Provide all matching contracts
        message: "Contract(s) found successfully"
      });
    } catch (error) {
      logger.error({
        message: `Error finding contracts by phone: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          phoneNumber: req.params.phoneNumber,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve contracts by phone number",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Plaid Platform Payments Routes
  // Get active merchants that can use Plaid for transfers
  apiRouter.get("/plaid/active-merchants", async (req: Request, res: Response) => {
    try {
      // Get merchants who are active and have completed onboarding with Plaid
      const activeMerchants = await plaidService.getActivePlaidMerchants();

      logger.info({
        message: `Retrieved ${activeMerchants.length} active Plaid merchants`,
        category: "api",
        source: "plaid",
      });

      return res.json({
        success: true,
        merchants: activeMerchants
      });
    } catch (error) {
      logger.error({
        message: `Error getting active Plaid merchants: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to get active merchants"
      });
    }
  });

  // Check for bank connection status by contract ID
  apiRouter.get("/plaid/bank-connection/:contractId", async (req: Request, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      
      if (isNaN(contractId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid contract ID format"
        });
      }
      
      // Check if the contract exists
      const contract = await storage.getContract(contractId);
      if (!contract) {
        return res.status(404).json({
          success: false,
          message: "Contract not found"
        });
      }
      
      // Get application progress for this contract, focusing on the bank step
      const applicationProgress = await storage.getApplicationProgressByContractId(contractId);
      const bankStep = applicationProgress.find(step => step.step === "bank");
      
      if (!bankStep || !bankStep.completed || !bankStep.data) {
        return res.json({
          success: true,
          hasConnection: false,
          message: "No bank connection found for this contract"
        });
      }
      
      // Parse the bank data
      const bankData = JSON.parse(bankStep.data);
      
      // Get additional Plaid data if available
      let plaidData = null;
      
      if (bankData.accessToken) {
        try {
          // Import the Plaid service
          const { plaidService } = await import('./services');
          
          // Check if Plaid service is initialized
          if (plaidService && plaidService.isInitialized()) {
            // Get auth data for account and routing numbers
            const authResponse = await plaidService.getAuth(bankData.accessToken);
            
            // Get the specific account's data
            const accountDetails = authResponse.accounts.find(acc => acc.account_id === bankData.accountId);
            
            if (accountDetails) {
              // Build the Plaid data object with non-sensitive information
              plaidData = {
                accounts: [{
                  account_id: accountDetails.account_id,
                  name: accountDetails.name,
                  mask: accountDetails.mask,
                  type: accountDetails.type,
                  subtype: accountDetails.subtype,
                  balances: {
                    available: accountDetails.balances.available,
                    current: accountDetails.balances.current,
                    limit: accountDetails.balances.limit
                  }
                }],
                institution: {
                  name: bankData.institutionName || "Your Bank",
                  institution_id: bankData.institutionId || ""
                },
                totalBalance: accountDetails.balances.available || accountDetails.balances.current || 0,
                totalAvailableBalance: accountDetails.balances.available || 0,
                totalAccounts: 1
              };
            }
          }
        } catch (plaidError) {
          logger.warn({
            message: `Unable to fetch additional Plaid data: ${plaidError instanceof Error ? plaidError.message : String(plaidError)}`,
            category: "api",
            source: "plaid",
            metadata: {
              error: plaidError instanceof Error ? plaidError.stack : String(plaidError),
              contractId: contractId
            }
          });
          // Continue without the additional Plaid data
        }
      }
      
      // Return the connection info, but hide sensitive details
      return res.json({
        success: true,
        hasConnection: true,
        connectionDetails: {
          accountId: bankData.accountId,
          accountName: bankData.accountName,
          accountType: bankData.accountType,
          accountSubtype: bankData.accountSubtype,
          accountMask: bankData.accountMask,
          bankName: bankData.institutionName || "Your Bank",
          connected: true,
          connectedAt: bankData.completedAt || bankStep.completedAt
          // Don't send sensitive data like routing/account numbers to the frontend
        },
        plaidData: plaidData // Include the additional Plaid data if available
      });
    } catch (error) {
      logger.error({
        message: `Error checking bank connection: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
          contractId: req.params.contractId
        }
      });
      
      return res.status(500).json({
        success: false,
        message: "Failed to check bank connection status",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // TEST ENDPOINT: Get raw originators directly from Plaid API
  apiRouter.get("/plaid/test/originators", async (req: Request, res: Response) => {
    try {
      if (!plaidService.isInitialized()) {
        return res.status(500).json({
          success: false,
          message: "Plaid service not initialized"
        });
      }

      // Direct call to Plaid API to test connection and response
      const originatorListResponse = await plaidService.getClient().transferOriginatorList({});
      const plaidOriginators = originatorListResponse.data.originators || [];

      logger.info({
        message: `TEST: Retrieved ${plaidOriginators.length} originators directly from Plaid API`,
        category: "api",
        source: "plaid",
      });

      return res.json({
        success: true,
        count: plaidOriginators.length,
        originators: plaidOriginators,
        plaidResponse: originatorListResponse.data
      });
    } catch (error) {
      logger.error({
        message: `TEST: Error getting originators directly from Plaid: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to get originators from Plaid API"
      });
    }
  });
  
  // Find a specific originator by name
  apiRouter.get("/plaid/find-originator/:name", async (req: Request, res: Response) => {
    try {
      if (!plaidService.isInitialized()) {
        return res.status(500).json({
          success: false,
          message: "Plaid service not initialized"
        });
      }
      
      const searchName = req.params.name;
      if (!searchName) {
        return res.status(400).json({
          success: false,
          message: "Originator name is required"
        });
      }
      
      // Direct call to Plaid API to get all originators
      const originatorListResponse = await plaidService.getClient().transferOriginatorList({});
      const plaidOriginators = originatorListResponse.data.originators || [];
      
      // Find the originator that matches the name (case insensitive)
      const foundOriginator = plaidOriginators.find(
        (originator: any) => originator.company_name && 
        originator.company_name.toLowerCase().includes(searchName.toLowerCase())
      );
      
      if (foundOriginator) {
        logger.info({
          message: `Found originator matching '${searchName}': ${foundOriginator.company_name}`,
          category: "api",
          source: "plaid",
          metadata: {
            originatorId: foundOriginator.originator_id,
            clientId: foundOriginator.client_id,
            status: foundOriginator.status
          }
        });
        
        return res.json({
          success: true,
          found: true,
          originator: foundOriginator
        });
      } else {
        logger.info({
          message: `No originator found matching '${searchName}'`,
          category: "api",
          source: "plaid",
          metadata: {
            totalOriginators: plaidOriginators.length
          }
        });
        
        return res.json({
          success: true,
          found: false,
          message: `No originator found matching '${searchName}'`,
          totalOriginators: plaidOriginators.length
        });
      }
    } catch (error) {
      logger.error({
        message: `Error finding originator by name: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          searchName: req.params.name,
          error: error instanceof Error ? error.stack : null,
        },
      });

      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to find originator by name"
      });
    }
  });

  // Sync all Plaid merchants with our database
  apiRouter.post("/plaid/merchants/sync", async (req: Request, res: Response) => {
    try {
      if (!plaidService.isInitialized()) {
        return res.status(500).json({
          success: false,
          message: "Plaid service not initialized"
        });
      }

      // Import storage to handle merchant data
      const { storage } = await import('./storage');

      logger.info({
        message: "Starting Plaid merchant synchronization",
        category: "api",
        source: "plaid",
      });

      // Get all originators from Plaid
      const originatorListResponse = await plaidService.getClient().transferOriginatorList({});
      const plaidOriginators = originatorListResponse.data.originators || [];

      logger.info({
        message: `Retrieved ${plaidOriginators.length} originators from Plaid for synchronization`,
        category: "api",
        source: "plaid",
      });

      // Get all merchants from our database
      const merchants = await storage.getAllMerchants();

      // Get all Plaid merchants from our database
      const pendingMerchants = await storage.getPlaidMerchantsByStatus('pending');
      const inProgressMerchants = await storage.getPlaidMerchantsByStatus('in_progress');
      const completedMerchants = await storage.getPlaidMerchantsByStatus('completed');

      // Combine all merchants into one array
      const existingPlaidMerchants = [...pendingMerchants, ...inProgressMerchants, ...completedMerchants];

      const syncResults = {
        success: true,
        total: plaidOriginators.length,
        matched: 0,
        new: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        details: [] as any[],
      };

      // Process each originator from Plaid with proper type definition
      type PlaidOriginator = {
        originator_id: string;
        company_name: string;
        status: string;
        created_at: string;
      };

      // Cast each originator to our custom type to handle Plaid's API response format
      for (const originator of plaidOriginators as unknown as PlaidOriginator[]) {
        try {
          // Check if we already have this originator in our database
          const existingRecord = existingPlaidMerchants.find(
            pm => pm.originatorId === originator.originator_id
          );

          if (existingRecord) {
            // Update the existing record
            syncResults.matched++;

            // Update status if different
            if (existingRecord.onboardingStatus !== originator.status.toLowerCase()) {
              await storage.updatePlaidMerchant(existingRecord.id, {
                onboardingStatus: originator.status.toLowerCase() as any,
                plaidData: JSON.stringify(originator)
                // updatedAt is handled automatically by the database
              });

              syncResults.updated++;
              syncResults.details.push({
                originatorId: originator.originator_id,
                merchantId: existingRecord.merchantId,
                action: "updated",
                status: originator.status
              });
            } else {
              syncResults.skipped++;
              syncResults.details.push({
                originatorId: originator.originator_id,
                merchantId: existingRecord.merchantId,
                action: "skipped",
                status: originator.status
              });
            }
          } else {
            // This is a new originator not in our database
            // Try to match with merchant by name
            const matchedMerchant = merchants.find(m => 
              originator.company_name && 
              m.name.toLowerCase().includes(originator.company_name.toLowerCase())
            );

            if (matchedMerchant) {
              // Create new Plaid merchant record linked to this merchant
              const newPlaidMerchant = await storage.createPlaidMerchant({
                merchantId: matchedMerchant.id,
                originatorId: originator.originator_id,
                onboardingStatus: originator.status.toLowerCase() as any,
                plaidData: JSON.stringify(originator)
                // updatedAt is handled automatically by the database
              });

              syncResults.new++;
              syncResults.details.push({
                originatorId: originator.originator_id,
                merchantId: matchedMerchant.id,
                action: "created",
                status: originator.status,
                matchedBy: "name"
              });
            } else {
              // No match found by name, create a placeholder merchant for tracking
              try {
                // Log the unmatched originator
                logger.warn({
                  message: `Unmatched Plaid originator: ${originator.company_name} (${originator.originator_id})`,
                  category: "api",
                  source: "plaid",
                  metadata: {
                    originatorId: originator.originator_id,
                    companyName: originator.company_name,
                    status: originator.status
                  }
                });

                // Create merchant record for originator if needed
                const sanitizedCompanyName = originator.company_name ? 
                  originator.company_name.substring(0, 100) : // Ensure name fits in DB field
                  `Plaid Merchant ${originator.originator_id.substring(0, 8)}`;

                // Create a merchant record to track this Plaid originator
                const newMerchant = await storage.createMerchant({
                  name: sanitizedCompanyName,
                  contactName: "Imported from Plaid",
                  email: "imported@plaidmerchant.example", // Placeholder email
                  phone: "",
                  // We'll set the integration status in the PlaidMerchant record
                  // Merchant type will be determined by the schema
                });

                if (newMerchant) {
                  // Create the plaid merchant record linked to our new merchant
                  const newPlaidMerchant = await storage.createPlaidMerchant({
                    merchantId: newMerchant.id,
                    originatorId: originator.originator_id,
                    onboardingStatus: originator.status.toLowerCase() as any,
                    plaidData: JSON.stringify(originator)
                  });

                  syncResults.new++;
                  syncResults.details.push({
                    originatorId: originator.originator_id,
                    merchantId: newMerchant.id,
                    companyName: sanitizedCompanyName,
                    action: "auto_created",
                    status: originator.status
                  });
                } else {
                  // Failed to create merchant record
                  throw new Error("Failed to create merchant record");
                }
              } catch (error) {
                // Failed to handle the unmatched originator
                syncResults.skipped++;
                syncResults.details.push({
                  originatorId: originator.originator_id,
                  companyName: originator.company_name,
                  action: "skipped",
                  status: originator.status,
                  reason: "no matching merchant found and auto-creation failed",
                  error: error instanceof Error ? error.message : String(error)
                });
              }
            }
          }
        } catch (error) {
          logger.error({
            message: `Error syncing Plaid originator ${originator.originator_id}: ${error instanceof Error ? error.message : String(error)}`,
            category: "api",
            source: "plaid",
            metadata: {
              originatorId: originator.originator_id,
              error: error instanceof Error ? error.stack : null,
            },
          });

          syncResults.errors++;
          syncResults.details.push({
            originatorId: originator.originator_id,
            action: "error",
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      logger.info({
        message: `Completed Plaid merchant synchronization: ${syncResults.matched} matched, ${syncResults.new} new, ${syncResults.updated} updated, ${syncResults.errors} errors`,
        category: "api",
        source: "plaid",
      });

      return res.json(syncResults);
    } catch (error) {
      logger.error({
        message: `Error syncing Plaid merchants: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to sync merchants with Plaid"
      });
    }
  });

  // Get merchant onboarding status
  apiRouter.get("/plaid/merchant/:merchantId/onboarding-status", async (req: Request, res: Response) => {
    try {
      const { merchantId } = req.params;

      if (!merchantId) {
        return res.status(400).json({
          success: false,
          message: "merchantId is required"
        });
      }

      // Import storage to get merchant details
      const { storage } = await import('./storage');

      // Get the plaid merchant record
      const plaidMerchant = await storage.getPlaidMerchantByMerchantId(parseInt(merchantId));

      if (!plaidMerchant) {
        return res.status(404).json({
          success: false,
          message: "Plaid merchant not found"
        });
      }

      // If we have an originatorId, get the real-time status from Plaid
      if (plaidMerchant.originatorId) {
        try {
          const status = await plaidService.getMerchantOnboardingStatus(plaidMerchant.originatorId);

          logger.info({
            message: `Retrieved Plaid merchant onboarding status for merchant ${merchantId}`,
            category: "api",
            source: "plaid",
            metadata: {
              merchantId,
              originatorId: plaidMerchant.originatorId,
              status: status.status
            }
          });

          return res.json({
            success: true,
            merchantId: parseInt(merchantId),
            onboardingStatus: status.status,
            originatorId: status.originatorId,
            originatorName: status.originatorName,
            createdAt: status.createdAt,
            updatedAt: plaidMerchant.updatedAt,
            hasBankAccountLinked: !!plaidMerchant.accountId
          });
        } catch (error) {
          // If we get an error from Plaid, return the stored status
          logger.warn({
            message: `Failed to get real-time status from Plaid, returning stored status: ${error instanceof Error ? error.message : String(error)}`,
            category: "api",
            source: "plaid",
            metadata: {
              merchantId,
              originatorId: plaidMerchant.originatorId,
              storedStatus: plaidMerchant.onboardingStatus
            }
          });

          return res.json({
            success: true,
            merchantId: parseInt(merchantId),
            onboardingStatus: plaidMerchant.onboardingStatus,
            originatorId: plaidMerchant.originatorId,
            updatedAt: plaidMerchant.updatedAt,
            hasBankAccountLinked: !!plaidMerchant.accountId,
            fromStoredData: true
          });
        }
      } else {
        // If no originatorId, return the stored status
        return res.json({
          success: true,
          merchantId: parseInt(merchantId),
          onboardingStatus: plaidMerchant.onboardingStatus,
          updatedAt: plaidMerchant.updatedAt,
          hasBankAccountLinked: !!plaidMerchant.accountId,
          fromStoredData: true
        });
      }
    } catch (error) {
      logger.error({
        message: `Error getting merchant onboarding status: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          merchantId: req.params.merchantId,
          error: error instanceof Error ? error.stack : null,
        },
      });

      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to get merchant onboarding status"
      });
    }
  });

  // Create merchant onboarding link
  apiRouter.post("/plaid/merchant/onboarding", async (req: Request, res: Response) => {
    try {
      const { merchantId, legalName, email, redirectUri } = req.body;

      if (!merchantId || !legalName || !email) {
        return res.status(400).json({
          success: false,
          message: "merchantId, legalName, and email are required",
        });
      }

      const result = await plaidService.createMerchantOnboardingLink({
        merchantId: parseInt(merchantId),
        legalName,
        email,
        redirectUri,
      });

      // If the merchant is already onboarded, return that info
      if (result.alreadyOnboarded) {
        return res.status(200).json({
          success: true,
          message: "Merchant already onboarded",
          data: result
        });
      }

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error creating merchant onboarding link:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Complete merchant onboarding
  apiRouter.post("/plaid/merchant/complete-onboarding", async (req: Request, res: Response) => {
    try {
      const { merchantId, publicToken, accountId } = req.body;

      if (!merchantId || !publicToken || !accountId) {
        return res.status(400).json({
          success: false,
          message: "merchantId, publicToken, and accountId are required",
        });
      }

      const result = await plaidService.completeMerchantOnboarding(
        parseInt(merchantId),
        publicToken,
        accountId
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error completing merchant onboarding:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Create platform payment
  apiRouter.post("/plaid/payment/platform", async (req: Request, res: Response) => {
    try {
      const { merchantId, contractId, amount, description, routeToShifi, metadata } = req.body;

      if (!merchantId || !contractId || !amount || !description) {
        return res.status(400).json({
          success: false,
          message: "merchantId, contractId, amount, and description are required",
        });
      }

      const result = await plaidService.createPlatformPayment({
        merchantId: parseInt(merchantId),
        contractId: parseInt(contractId),
        amount: parseFloat(amount),
        description,
        routeToShifi: Boolean(routeToShifi),
        metadata,
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error creating platform payment:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Check platform payment status
  apiRouter.get("/plaid/payment/:transferId/status", async (req: Request, res: Response) => {
    try {
      const { transferId } = req.params;

      if (!transferId) {
        return res.status(400).json({
          success: false,
          message: "transferId is required",
        });
      }

      const result = await plaidService.checkPlatformPaymentStatus(transferId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error checking platform payment status:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Plaid merchant webhook endpoint for notifications
  apiRouter.post("/plaid/merchant-webhook", async (req: Request, res: Response) => {
    try {
      const { webhook_type, webhook_code, merchant_id } = req.body;

      logger.info({
        message: `Received Plaid merchant webhook: ${webhook_type}/${webhook_code}`,
        category: "api",
        source: "plaid",
        metadata: {
          webhook_type,
          webhook_code,
          merchant_id,
        },
      });

      // Will need to handle different webhook types and codes
      // For now, just acknowledge receipt
      res.status(200).json({
        success: true,
        message: "Webhook received"
      });
    } catch (error) {
      console.error("Error processing Plaid merchant webhook:", error);
      // Still return 200 to acknowledge receipt to Plaid, even if we had an error processing
      res.status(200).json({
        success: true,
        message: "Webhook received but encountered an error during processing"
      });
    }
  });
  
  // DiDit KYC verification endpoints
  
  // Create a webhook endpoint for DiDit
  apiRouter.post("/didit/webhook", async (req: Request, res: Response) => {
    try {
      const { session_id, status, contract_id } = req.body;
      
      if (!session_id || !status) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields in webhook payload",
        });
      }
      
      logger.info({
        message: "Received DiDit verification webhook",
        category: "api",
        source: "didit",
        metadata: {
          sessionId: session_id,
          status,
          contractId: contract_id,
        },
      });
      
      // Update contract verification status if contract_id is provided
      if (contract_id) {
        try {
          const contractId = parseInt(contract_id);
          
          // Add entry to verifications table
          await storage.createVerification({
            contractId,
            type: "identity",
            status: status,
            provider: "didit",
            sessionId: session_id,
            completedAt: status === "approved" || status === "rejected" ? new Date() : null,
            data: JSON.stringify(req.body),
          });
          
          if (status === "approved") {
            // Mark the KYC step as completed if it exists
            const applicationProgress = await storage.getApplicationProgressByContractId(contractId);
            const kycStep = applicationProgress.find(step => step.step === "kyc");
            
            if (kycStep) {
              await storage.updateApplicationProgressCompletion(
                kycStep.id,
                true,
                JSON.stringify({
                  verificationId: session_id,
                  status: "approved",
                  completedAt: new Date().toISOString(),
                })
              );
            }
            
            // Move the contract to the next step if currently on identity verification
            const contract = await storage.getContract(contractId);
            if (contract && contract.currentStep === "identity_verification") {
              await storage.updateContractStep(contractId, "payment");
            }
          }
        } catch (error) {
          logger.error({
            message: `Failed to update contract verification status: ${error instanceof Error ? error.message : String(error)}`,
            category: "api",
            source: "didit",
            metadata: {
              sessionId: session_id,
              contractId: contract_id,
              error: error instanceof Error ? error.stack : String(error),
            },
          });
        }
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error({
        message: `Error processing DiDit webhook: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          body: req.body,
          error: error instanceof Error ? error.stack : String(error),
        },
      });
      
      res.status(500).json({
        success: false,
        message: "Internal server error processing webhook",
      });
    }
  });
  
  // Check the status of a DiDit verification session
  apiRouter.get("/didit/session-status", async (req: Request, res: Response) => {
    try {
      const { sessionId, merchantId } = req.query;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID is required",
        });
      }
      
      logger.info({
        message: "Checking DiDit session status",
        category: "api",
        source: "didit",
        metadata: {
          sessionId,
          merchantId,
        },
      });
      
      try {
        // Check if we already have a verification record for this session
        let status = "pending";
        
        if (merchantId) {
          const verifications = await storage.getVerificationsByContractId(parseInt(merchantId as string));
          const verification = verifications.find(v => v.sessionId === sessionId);
          
          if (verification) {
            status = verification.status;
            
            logger.info({
              message: "Found existing verification record",
              category: "api",
              source: "didit",
              metadata: {
                sessionId,
                merchantId,
                status,
                completedAt: verification.completedAt,
              },
            });
            
            return res.json({
              success: true,
              status,
              message: `Verification status: ${status}`,
            });
          }
        }
        
        // If no record exists, check with DiDit API
        const sessionStatus = await diditService.getVerificationSessionStatus(sessionId as string);
        
        if (sessionStatus) {
          status = sessionStatus.status;
          
          // If we have a merchant ID, create/update the verification record
          if (merchantId && status !== "pending") {
            await storage.createVerification({
              contractId: parseInt(merchantId as string),
              type: "identity",
              status: status,
              provider: "didit",
              sessionId: sessionId as string,
              completedAt: status === "approved" || status === "rejected" ? new Date() : null,
              data: JSON.stringify(sessionStatus),
            });
            
            // If approved, update the contract progress
            if (status === "approved") {
              const applicationProgress = await storage.getApplicationProgressByContractId(parseInt(merchantId as string));
              const kycStep = applicationProgress.find(step => step.step === "kyc");
              
              if (kycStep) {
                await storage.updateApplicationProgressCompletion(
                  kycStep.id,
                  true,
                  JSON.stringify({
                    verificationId: sessionId,
                    status: "approved",
                    completedAt: new Date().toISOString(),
                  })
                );
              }
            }
          }
          
          logger.info({
            message: "Retrieved DiDit session status",
            category: "api",
            source: "didit",
            metadata: {
              sessionId,
              merchantId,
              status,
            },
          });
          
          return res.json({
            success: true,
            status,
            message: `Verification status: ${status}`,
          });
        } else {
          return res.json({
            success: true,
            status: "pending",
            message: "Verification is still in progress",
          });
        }
      } catch (error) {
        logger.error({
          message: `Failed to check verification status: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "didit",
          metadata: {
            sessionId,
            merchantId,
            error: error instanceof Error ? error.stack : String(error),
          },
        });
        
        return res.status(500).json({
          success: false,
          message: "Failed to check verification status",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      logger.error({
        message: `Error in DiDit session status endpoint: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });
      
      res.status(500).json({
        success: false,
        message: "Internal server error checking session status",
      });
    }
  });

  // Add this to routes.ts file

// Update a merchant
apiRouter.patch("/merchants/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    // Validate that the merchant exists
    const merchant = await storage.getMerchant(id);
    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    // Extract fields to update
    const { 
      name, 
      contactName, 
      email, 
      phone, 
      address, 
      active 
    } = req.body;

    // Build update object (only include defined fields)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (contactName !== undefined) updateData.contactName = contactName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (active !== undefined) updateData.active = active;

    // Check if email is being changed and it's already in use by another merchant
    if (email !== undefined && email !== merchant.email) {
      const existingMerchant = await storage.getMerchantByEmail(email);
      if (existingMerchant && existingMerchant.id !== id) {
        return res.status(409).json({ message: "A merchant with this email already exists" });
      }
    }

    // Update the merchant in storage
    const updatedMerchant = await storage.updateMerchant(id, updateData);

    // Create log for merchant update
    await storage.createLog({
      level: "info",
      message: `Merchant updated: ${merchant.name}`,
      metadata: JSON.stringify({
        id: merchant.id,
        updatedFields: Object.keys(updateData),
      }),
    });

    res.json(updatedMerchant);
  } catch (error) {
    console.error("Update merchant error:", error);

    // Create error log
    await storage.createLog({
      level: "error",
      category: "api",
      source: "internal",
      message: `Failed to update merchant: ${error instanceof Error ? error.message : String(error)}`,
      metadata: JSON.stringify({
        error: error instanceof Error ? error.stack : null,
      }),
    });

    res.status(500).json({ message: "Internal server error" });
  }
});
  
  // Endpoint for handling the verification completion redirect
  apiRouter.get("/merchant/verification-complete", async (req: Request, res: Response) => {
    try {
      const { merchantId, sessionId } = req.query;
      
      logger.info({
        message: "DiDit verification process completed, user redirected back",
        category: "api",
        source: "didit",
        metadata: {
          merchantId,
          sessionId,
        },
      });
      
      // Redirect to the merchant signup page with appropriate status
      res.redirect(`/merchant/signup?step=identity_verification&merchant_id=${merchantId || ''}`);
    } catch (error) {
      logger.error({
        message: `Error handling verification completion: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });
      
      res.redirect('/merchant/signup?error=verification_redirect');
    }
  });

  // Customer Satisfaction Survey Endpoints
  
  // Submit survey response
  apiRouter.post("/surveys/submit", async (req: Request, res: Response) => {
    try {
      const { contractId, customerId, rating, feedback, responseSource } = req.body;
      
      if (!contractId || !customerId || rating === undefined) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: contractId, customerId, and rating are required"
        });
      }
      
      // Validate rating is between 1-10
      const ratingNum = parseInt(rating);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
        return res.status(400).json({
          success: false,
          message: "Rating must be a number between 1 and 10"
        });
      }
      
      // Check if the contract exists
      const contract = await storage.getContract(parseInt(contractId));
      if (!contract) {
        return res.status(404).json({
          success: false,
          message: "Contract not found"
        });
      }
      
      // Create the survey response
      const surveyData: InsertCustomerSatisfactionSurvey = {
        contractId: parseInt(contractId),
        customerId: parseInt(customerId),
        rating: ratingNum,
        feedback: feedback || null,
        responseSource: responseSource || "web",
        respondedAt: new Date(),
      };
      
      const survey = await storage.createSatisfactionSurvey(surveyData);
      
      logger.info({
        message: "Customer satisfaction survey submitted",
        category: "user",
        source: "contract",
        metadata: {
          contractId,
          customerId,
          rating: ratingNum,
          responseSource
        }
      });
      
      // Update merchant performance metrics to reflect the new survey data
      try {
        const merchantId = contract.merchantId;
        // This will recalculate the merchant performance with the new survey data
        await merchantAnalyticsService.updateMerchantPerformance(merchantId);
        
        logger.info({
          message: "Merchant performance metrics updated with new survey data",
          category: "system",
          source: logSourceEnum.enumValues.find(src => src === "analytics") || "internal",
          metadata: {
            merchantId,
            contractId,
            surveyRating: ratingNum
          }
        });
      } catch (merchantUpdateError) {
        // Log error but don't fail the request
        logger.error({
          message: `Error updating merchant performance after survey submission: ${merchantUpdateError instanceof Error ? merchantUpdateError.message : String(merchantUpdateError)}`,
          category: "system",
          source: logSourceEnum.enumValues.find(src => src === "analytics") || "internal",
          metadata: {
            contractId,
            merchantId: contract.merchantId,
            error: merchantUpdateError instanceof Error ? merchantUpdateError.stack : String(merchantUpdateError)
          }
        });
      }
      
      return res.status(201).json({
        success: true,
        message: "Survey response recorded successfully",
        data: survey
      });
    } catch (error) {
      logger.error({
        message: `Error submitting customer survey: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
        }
      });
      
      return res.status(500).json({
        success: false,
        message: "An error occurred while recording your survey response"
      });
    }
  });

  // Get survey for a specific contract
  apiRouter.get("/surveys/contract/:contractId", async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      
      if (!contractId) {
        return res.status(400).json({
          success: false,
          message: "Contract ID is required"
        });
      }
      
      const surveys = await storage.getSatisfactionSurveysByContractId(parseInt(contractId));
      
      return res.status(200).json({
        success: true,
        data: surveys
      });
    } catch (error) {
      logger.error({
        message: `Error fetching contract surveys: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          contractId: req.params.contractId,
          error: error instanceof Error ? error.stack : String(error),
        }
      });
      
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching the surveys"
      });
    }
  });

  // Get surveys for a specific customer
  apiRouter.get("/surveys/customer/:customerId", async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      
      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: "Customer ID is required"
        });
      }
      
      const surveys = await storage.getSatisfactionSurveysByCustomerId(parseInt(customerId));
      
      return res.status(200).json({
        success: true,
        data: surveys
      });
    } catch (error) {
      logger.error({
        message: `Error fetching customer surveys: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          customerId: req.params.customerId,
          error: error instanceof Error ? error.stack : String(error),
        }
      });
      
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching the surveys"
      });
    }
  });
  
  // Get customer financial data (accounts, balances, transactions summary) for dashboard
  apiRouter.get("/customer/:customerId/financial-data", async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      
      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: "Customer ID is required",
        });
      }
      
      // Get the customer's active contracts
      const contracts = await storage.getContractsByCustomerId(parseInt(customerId));
      
      if (!contracts || contracts.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No contracts found for this customer",
        });
      }
      
      // Get asset reports for the customer's contracts
      const assetReports = [];
      const accountsData = [];
      const transactionsSummary = {
        incomeLastMonth: 0,
        spendingLastMonth: 0,
        categories: {},
        upcomingBills: [],
        recentTransactions: []
      };
      
      // Track if we have any real Plaid asset report data
      let hasPlaidData = false;
      
      // First, try to get asset reports directly by user ID
      const userAssetReports = await storage.getAssetReportsByUserId(parseInt(customerId));
      
      if (userAssetReports && userAssetReports.length > 0) {
        // Add asset reports from user ID lookup
        for (const report of userAssetReports) {
          if (report.analysisData) {
            assetReports.push(report);
            hasPlaidData = true;
          }
        }
      }
      
      // Then also check each contract for additional asset reports
      for (const contract of contracts) {
        // Get asset reports for this contract
        const contractAssetReports = await storage.getAssetReportsByContractId(contract.id);
        
        if (contractAssetReports && contractAssetReports.length > 0) {
          // Get most recent asset report with analysis data
          const latestReport = contractAssetReports
            .filter(report => report.analysisData)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          
          if (latestReport && latestReport.analysisData) {
            assetReports.push(latestReport);
            hasPlaidData = true;
            
            // Parse analysis data
            const analysisData = typeof latestReport.analysisData === 'string' 
              ? JSON.parse(latestReport.analysisData) 
              : latestReport.analysisData;
            
            // Add accounts and transactions data
            // In Plaid asset reports, accounts and transactions are nested under items[].accounts
            if (analysisData.items && analysisData.items.length > 0) {
              // Process each item (institution)
              for (const item of analysisData.items) {
                // Process accounts in this item
                if (item.accounts && item.accounts.length > 0) {
                  accountsData.push(...item.accounts);
                  
                  // Extract transactions from each account
                  for (const account of item.accounts) {
                    if (account.transactions && account.transactions.length > 0) {
                      // We found transactions, add them to our analysis
                      analysisData.transactions = analysisData.transactions || [];
                      analysisData.transactions.push(...account.transactions);
                    }
                  }
                }
              }
            } else if (analysisData.accounts) {
              // Fallback to old structure if it exists
              accountsData.push(...analysisData.accounts);
            }
            
            // Analyze transactions data
            if (analysisData.transactions && analysisData.transactions.length > 0) {
              // Extract income and spending amounts
              const currentDate = new Date();
              const lastMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
              const lastMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
              
              // Filter transactions from last month
              const lastMonthTransactions = analysisData.transactions.filter((transaction: any) => {
                const txDate = new Date(transaction.date);
                return txDate >= lastMonthStart && txDate <= lastMonthEnd;
              });
              
              // Calculate income and spending
              for (const transaction of lastMonthTransactions) {
                if (transaction.amount < 0) {
                  // Income (negative amount means money coming in)
                  transactionsSummary.incomeLastMonth += Math.abs(transaction.amount);
                } else {
                  // Spending (positive amount means money going out)
                  transactionsSummary.spendingLastMonth += transaction.amount;
                  
                  // Categorize spending
                  if (transaction.category) {
                    const category = transaction.category[0] || 'Other';
                    if (!transactionsSummary.categories[category]) {
                      transactionsSummary.categories[category] = 0;
                    }
                    transactionsSummary.categories[category] += transaction.amount;
                  }
                }
              }
              
              // Find upcoming recurring payments (potential bills)
              // This is based purely on real historical transaction patterns
              const recurringTransactions = analysisData.transactions
                .filter((t: any) => {
                  // Find transactions that appear to be recurring (monthly bills)
                  const amount = t.amount;
                  if (amount <= 0) return false; // Only look at payments, not deposits
                  
                  // Count how many times this merchant appears with similar amounts
                  const similarTransactions = analysisData.transactions.filter((st: any) => {
                    const sameMerchant = st.name.toLowerCase() === t.name.toLowerCase();
                    const similarAmount = Math.abs(st.amount - amount) < amount * 0.1; // Within 10%
                    return sameMerchant && similarAmount;
                  });
                  
                  // If we have multiple similar transactions, it's likely recurring
                  return similarTransactions.length >= 2;
                })
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
              
              // Get unique merchants (to avoid duplicates)
              const uniqueMerchants = new Map();
              recurringTransactions.forEach((tx: any) => {
                if (!uniqueMerchants.has(tx.name.toLowerCase())) {
                  uniqueMerchants.set(tx.name.toLowerCase(), tx);
                }
              });
              
              // Convert to array of upcoming bills
              if (uniqueMerchants.size > 0) {
                uniqueMerchants.forEach((tx: any) => {
                  const lastDate = new Date(tx.date);
                  // Predict next occurrence (typically monthly)
                  const nextDate = new Date(lastDate);
                  nextDate.setMonth(nextDate.getMonth() + 1);
                  
                  transactionsSummary.upcomingBills.push({
                    name: tx.name,
                    amount: tx.amount,
                    dueDate: nextDate.toISOString().split('T')[0],
                    category: tx.category ? tx.category[0] : 'Other'
                  });
                });
              }
              
              // Get recent transactions for display
              const recentTransactions = analysisData.transactions
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10);
              
              transactionsSummary.recentTransactions = recentTransactions;
            }
          }
        }
      }
      
      // If we don't have any real Plaid data, return appropriate status
      if (!hasPlaidData) {
        logger.info({
          message: "No Plaid asset report data available for customer",
          category: "api",
          source: "plaid",
          metadata: { customerId },
        });
        
        return res.status(200).json({
          success: true,
          data: {
            contracts: contracts,
            hasPlaidData: false,
            needsPlaidConnection: true,
            accounts: null,
            transactionsSummary: null,
            rewardsPoints: calculateCustomerPoints(contracts),
            insights: []
          }
        });
      }
      
      // Format accounts data for the frontend
      const formattedAccounts = {
        totalAccounts: accountsData.length,
        totalBalance: accountsData.reduce((sum, acc) => sum + (acc.balances?.current || 0), 0),
        totalAvailableBalance: accountsData.reduce((sum, acc) => sum + (acc.balances?.available || 0), 0),
        accounts: accountsData
      };
      
      // Format cash flow data
      const cashFlow = {
        monthlyIncome: transactionsSummary.incomeLastMonth,
        monthlyExpenses: transactionsSummary.spendingLastMonth,
        netCashFlow: transactionsSummary.incomeLastMonth - transactionsSummary.spendingLastMonth,
        categories: Object.entries(transactionsSummary.categories)
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => (b.amount as number) - (a.amount as number))
      };
      
      // Calculate rewards points based on contract status and payments
      const totalPoints = calculateCustomerPoints(contracts);
      
      // Prepare customer data for AI analysis
      const customerFinancialData = {
        contracts,
        accounts: accountsData,
        cashFlow,
        upcomingBills: transactionsSummary.upcomingBills,
        recentTransactions: transactionsSummary.recentTransactions
      };

      // Import the OpenAI service
      const { openaiService } = await import('./services');
      
      // Try to generate AI-powered insights and suggestions
      let insights = [];
      let suggestions = [];
      let usingAI = false;
      
      if (openaiService && openaiService.isInitialized()) {
        try {
          logger.info({
            message: 'Generating GPT-4.5 powered financial insights and suggestions',
            category: 'api',
            source: 'openai',
            metadata: { 
              customerId: customerId,
              model: 'gpt-4.5'
            }
          });
          
          // Try to get AI-powered insights in parallel
          const [aiInsights, aiSuggestions] = await Promise.all([
            openaiService.generateFinancialInsights(customerFinancialData),
            openaiService.generateFinancialSuggestions(customerFinancialData)
          ]);
          
          if (aiInsights && aiInsights.length > 0) {
            insights = aiInsights;
            usingAI = true;
            logger.info({
              message: 'Successfully generated GPT-4.5 powered financial insights',
              category: 'api',
              source: 'openai',
              metadata: { 
                customerId: customerId,
                insightsCount: insights.length,
                model: 'gpt-4.5'
              }
            });
          } else {
            // Fallback to rule-based insights
            insights = generateFinancialInsights(contracts, accountsData, transactionsSummary);
            logger.info({
              message: 'Using fallback rule-based financial insights',
              category: 'api',
              source: 'internal',
              metadata: { 
                customerId: customerId,
                reason: 'No AI insights generated'
              }
            });
          }
          
          if (aiSuggestions && aiSuggestions.length > 0) {
            suggestions = aiSuggestions;
            usingAI = true;
            logger.info({
              message: 'Successfully generated GPT-4.5 powered financial suggestions',
              category: 'api',
              source: 'openai',
              metadata: { 
                customerId: customerId,
                suggestionsCount: suggestions.length,
                model: 'gpt-4.5'
              }
            });
          } else {
            // Fallback to rule-based suggestions
            suggestions = generateSmartSuggestions(contracts, transactionsSummary, cashFlow);
            logger.info({
              message: 'Using fallback rule-based financial suggestions',
              category: 'api',
              source: 'internal',
              metadata: { 
                customerId: customerId,
                reason: 'No AI suggestions generated'
              }
            });
          }
        } catch (aiError) {
          // If OpenAI processing fails, use our rule-based approach as fallback
          logger.error({
            message: `OpenAI processing failed: ${aiError instanceof Error ? aiError.message : String(aiError)}`,
            category: 'api',
            source: 'openai',
            metadata: { 
              customerId,
              error: aiError instanceof Error ? aiError.stack : String(aiError)
            }
          });
          
          // Fallback to rule-based insights and suggestions
          insights = generateFinancialInsights(contracts, accountsData, transactionsSummary);
          suggestions = generateSmartSuggestions(contracts, transactionsSummary, cashFlow);
        }
      } else {
        // OpenAI service not available, use rule-based approach
        logger.warn({
          message: 'OpenAI service not initialized, using rule-based financial analysis',
          category: 'api',
          source: 'openai',
          metadata: { customerId }
        });
        
        insights = generateFinancialInsights(contracts, accountsData, transactionsSummary);
        suggestions = generateSmartSuggestions(contracts, transactionsSummary, cashFlow);
      }
      
      return res.status(200).json({
        success: true,
        data: {
          contracts: contracts,
          hasPlaidData: true,
          accounts: formattedAccounts,
          cashFlow,
          upcomingBills: transactionsSummary.upcomingBills,
          recentTransactions: transactionsSummary.recentTransactions,
          rewardsPoints: totalPoints,
          insights,
          suggestions,
          usingAI
        }
      });
    } catch (error) {
      logger.error({
        message: `Failed to fetch customer financial data: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: { 
          customerId: req.params.customerId,
          error: error instanceof Error ? error.stack : String(error)
        },
      });

      return res.status(500).json({
        success: false,
        message: "Failed to fetch financial data"
      });
    }
  });

  // Helper function to calculate customer reward points
  function calculateCustomerPoints(contracts: Contract[]): number {
    let totalPoints = 0;
    
    for (const contract of contracts) {
      // Points for active contracts
      if (contract.status === 'active') {
        totalPoints += 100;
        
        // Points for on-time payments
        // This would ideally come from payment history, but for simplicity we'll estimate
        const estimatedMonthsActive = Math.floor(
          (Date.now() - new Date(contract.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000)
        );
        
        // Assume on-time payments (each worth 25 points)
        totalPoints += estimatedMonthsActive * 25;
      }
      
      // Points for auto-pay setup (ACH)
      if (contract.paymentMethod === 'ach') {
        totalPoints += 500;
      }
    }
    
    return totalPoints;
  }

  // Helper function to generate financial insights
  function generateFinancialInsights(
    contracts: Contract[], 
    accounts: any[], 
    transactionsSummary: any
  ): any[] {
    const insights = [];
    
    // Check if customer could benefit from early payoff
    for (const contract of contracts) {
      if (contract.status === 'active') {
        // Find high-interest savings or checking accounts
        const highBalanceAccounts = accounts.filter(acc => 
          (acc.type === 'depository' && acc.balance > contract.financedAmount * 0.8)
        );
        
        if (highBalanceAccounts.length > 0) {
          insights.push({
            type: 'early_payoff_opportunity',
            title: 'Early Payoff Opportunity',
            description: `You have sufficient funds to pay off your contract early and save on interest.`,
            potentialSavings: contract.financedAmount * (contract.interestRate / 100) * 
              ((contract.termMonths - estimateRemainingMonths(contract)) / 12),
            contractId: contract.id,
            accountId: highBalanceAccounts[0].account_id
          });
        }
      }
    }
    
    // Income vs spending insights
    if (transactionsSummary.incomeLastMonth > 0 && 
        transactionsSummary.spendingLastMonth > 0) {
      const spendingRatio = transactionsSummary.spendingLastMonth / transactionsSummary.incomeLastMonth;
      
      if (spendingRatio > 0.9) {
        insights.push({
          type: 'high_spending',
          title: 'High Spending Alert',
          description: `Your spending last month was ${Math.round(spendingRatio * 100)}% of your income. Consider reducing expenses to build savings.`
        });
      } else if (spendingRatio < 0.6) {
        insights.push({
          type: 'savings_opportunity',
          title: 'Savings Opportunity',
          description: `Great job keeping expenses low! You saved ${Math.round((1 - spendingRatio) * 100)}% of your income last month.`
        });
      }
    }
    
    // Upcoming bill insights
    if (transactionsSummary.upcomingBills && transactionsSummary.upcomingBills.length > 0) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const upcomingBills = transactionsSummary.upcomingBills
        .filter((bill: any) => new Date(bill.predictedDate) <= nextWeek)
        .reduce((total: number, bill: any) => total + bill.amount, 0);
      
      if (upcomingBills > 0) {
        insights.push({
          type: 'upcoming_bills',
          title: 'Upcoming Bills',
          description: `You have approximately $${upcomingBills.toFixed(2)} in bills coming due in the next week.`,
          billsAmount: upcomingBills
        });
      }
    }
    
    // Identify top spending category
    if (transactionsSummary.categories && Object.keys(transactionsSummary.categories).length > 0) {
      const categories = Object.entries(transactionsSummary.categories)
        .sort((a: any, b: any) => b[1] - a[1]);
      
      if (categories.length > 0) {
        const topCategory = categories[0];
        insights.push({
          type: 'spending_pattern',
          title: 'Top Spending Category',
          description: `Your highest spending category last month was ${topCategory[0]} at $${topCategory[1].toFixed(2)}.`
        });
      }
    }
    
    return insights;
  }
  
  // Helper to estimate remaining months on a contract
  function estimateRemainingMonths(contract: Contract): number {
    if (contract.status !== 'active') return 0;
    
    const startDate = new Date(contract.createdAt);
    const currentDate = new Date();
    const monthsElapsed = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                          (currentDate.getMonth() - startDate.getMonth());
    
    return Math.max(0, contract.termMonths - monthsElapsed);
  };
  
  // Function to generate personalized financial suggestions based on real data
  function generateSmartSuggestions(
    contracts: Contract[],
    transactionsSummary: any,
    cashFlow: any
  ): any[] {
    const suggestions = [];
    
    // Early payment suggestion - based on cash flow data
    if (cashFlow.netCashFlow > 0 && contracts.some(c => c.status === 'active')) {
      const activeContracts = contracts.filter(c => c.status === 'active');
      
      // If customer has excess cash flow, suggest increasing payments
      if (cashFlow.netCashFlow > (activeContracts[0].monthlyPayment * 0.5)) {
        suggestions.push({
          title: "Increase Your Monthly Payment",
          description: `Based on your cash flow, you could increase your payment by $${Math.floor(cashFlow.netCashFlow * 0.5)} per month and pay off your contract earlier.`,
          actionText: "Set Up Extra Payment",
          actionUrl: `/contracts/${activeContracts[0].id}/payments`
        });
      }
    }
    
    // Auto-payment suggestion - if not already set up
    const hasAutoPayment = contracts.some(c => c.paymentMethod === 'ach');
    if (!hasAutoPayment && contracts.some(c => c.status === 'active')) {
      suggestions.push({
        title: "Set Up Auto-Payment",
        description: "Set up automatic payments to earn 500 rewards points and never worry about missing a payment date.",
        actionText: "Enable Auto-Pay",
        actionUrl: "/settings/payments"
      });
    }
    
    // Budget suggestion based on spending patterns
    if (cashFlow.categories && cashFlow.categories.length > 0) {
      const topCategory = cashFlow.categories[0];
      if (topCategory.amount > (cashFlow.monthlyIncome * 0.3)) {
        suggestions.push({
          title: "Budget Your Spending",
          description: `Your spending on ${topCategory.name} is ${Math.round((topCategory.amount / cashFlow.monthlyIncome) * 100)}% of your income. Consider creating a budget.`,
          actionText: "Create Budget",
          actionUrl: "/tools/budget"
        });
      }
    }
    
    // Financial health tip based on income vs spending
    if (cashFlow.monthlyIncome > 0 && cashFlow.monthlyExpenses > 0) {
      const savingsRate = 1 - (cashFlow.monthlyExpenses / cashFlow.monthlyIncome);
      
      if (savingsRate < 0.1) {
        suggestions.push({
          title: "Build Your Emergency Fund",
          description: "Financial experts recommend saving at least 10% of your income. Your current savings rate is below this target.",
          actionText: "Learn More",
          actionUrl: "/resources/emergency-fund"
        });
      } else if (savingsRate > 0.2) {
        suggestions.push({
          title: "Consider Investing",
          description: "You're saving over 20% of your income. This is a great opportunity to consider investing for your future.",
          actionText: "Explore Options",
          actionUrl: "/resources/investing"
        });
      }
    }
    
    // Add suggestion for bills consolidation if many upcoming bills
    if (transactionsSummary.upcomingBills && transactionsSummary.upcomingBills.length > 3) {
      suggestions.push({
        title: "Streamline Your Bills",
        description: `You have ${transactionsSummary.upcomingBills.length} recurring bills. Consider consolidating some services to simplify your finances.`,
        actionText: "View All Bills",
        actionUrl: "/tools/bill-tracker"
      });
    }
    
    return suggestions;
  };

  // Endpoint to trigger sending surveys for eligible contracts
  apiRouter.post("/admin/trigger-satisfaction-surveys", async (req: Request, res: Response) => {
    try {
      // Check if the user is an admin (you may want to enhance this with proper auth middleware)
      if (req.session.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Only admin users can trigger surveys"
        });
      }
      
      const { daysActive } = req.body;
      
      // Default to 30 days if not specified
      const daysToCheck = daysActive ? parseInt(daysActive) : 30;
      
      // Get contracts that are eligible for survey
      const eligibleContracts = await storage.getActiveContractsDueForSurvey(daysToCheck);
      
      if (eligibleContracts.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No eligible contracts found for survey",
          data: { count: 0 }
        });
      }
      
      // Track successfully sent surveys
      const sentSurveys = [];
      
      // Track merchant IDs to update performance metrics only once per merchant
      const merchantIdsToUpdate = new Set<number>();
      
      // For each eligible contract, send a survey notification
      for (const contract of eligibleContracts) {
        try {
          // Get the customer details
          const customer = await storage.getUser(contract.customerId);
          
          if (!customer) {
            console.warn(`Customer not found for contract ${contract.id}`);
            continue;
          }
          
          // Send survey notification via SMS and in-app
          await notificationService.sendNotification('customer_satisfaction_survey', {
            recipientId: customer.id,
            recipientType: 'customer',
            recipientPhone: customer.phone || undefined,
            data: {
              customerName: customer.firstName || customer.name || "Valued Customer",
              contractNumber: contract.contractNumber,
              contractId: contract.id,
              customerId: customer.id
            },
            channels: ['sms', 'in_app']
          });
          
          // Create a survey record with null rating (to be filled by customer)
          const surveyData: InsertCustomerSatisfactionSurvey = {
            contractId: contract.id,
            customerId: customer.id,
            rating: null, // Will be filled when customer responds
            respondedAt: null,
            sentAt: new Date()
          };
          
          await storage.createSatisfactionSurvey(surveyData);
          
          sentSurveys.push({
            contractId: contract.id,
            customerId: customer.id,
            contractNumber: contract.contractNumber
          });
          
          // Add merchant ID to the set of merchants to update
          merchantIdsToUpdate.add(contract.merchantId);
          
          logger.info({
            message: `Satisfaction survey sent for contract ${contract.contractNumber}`,
            category: "system",
            source: logSourceEnum.enumValues.find(src => src === "notification") || "internal",
            metadata: {
              contractId: contract.id,
              customerId: customer.id
            }
          });
        } catch (error) {
          logger.error({
            message: `Error sending survey for contract ${contract.id}: ${error instanceof Error ? error.message : String(error)}`,
            category: "system",
            source: logSourceEnum.enumValues.find(src => src === "notification") || "internal",
            metadata: {
              contractId: contract.id,
              error: error instanceof Error ? error.stack : String(error)
            }
          });
        }
      }
      
      // Update merchant performance metrics for all affected merchants
      if (merchantIdsToUpdate.size > 0) {
        try {
          // Convert Set to Array for processing
          const merchantIds = Array.from(merchantIdsToUpdate);
          
          for (const merchantId of merchantIds) {
            await merchantAnalyticsService.updateMerchantPerformance(merchantId);
            
            logger.info({
              message: "Merchant performance metrics updated after sending surveys",
              category: "system",
              source: logSourceEnum.enumValues.find(src => src === "analytics") || "internal",
              metadata: {
                merchantId,
                affectedContractsCount: eligibleContracts.filter(c => c.merchantId === merchantId).length
              }
            });
          }
        } catch (updateError) {
          logger.error({
            message: `Error updating merchant performance metrics: ${updateError instanceof Error ? updateError.message : String(updateError)}`,
            category: "system",
            source: logSourceEnum.enumValues.find(src => src === "analytics") || "internal",
            metadata: {
              merchantIds: Array.from(merchantIdsToUpdate),
              error: updateError instanceof Error ? updateError.stack : String(updateError)
            }
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        message: `Successfully sent ${sentSurveys.length} customer satisfaction surveys`,
        data: {
          count: sentSurveys.length,
          sentSurveys
        }
      });
    } catch (error) {
      logger.error({
        message: `Error triggering satisfaction surveys: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return res.status(500).json({
        success: false,
        message: "An error occurred while triggering satisfaction surveys"
      });
    }
  });

  // Add a 404 handler for API routes that don't match any defined endpoint
  apiRouter.use((req: Request, res: Response) => {
    logger.warn({
      message: `API 404: Endpoint not found - ${req.method} ${req.originalUrl}`,
      category: "api",
      source: "internal",
      metadata: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        params: req.params,
        query: req.query,
      },
    });
    
    res.status(404).json({
      success: false,
      message: "API endpoint not found",
      path: req.originalUrl
    });
  });

  // Health routes are now handled by the healthRouter
  
  // Mount the index routes - these contain other modular routes
  console.log("Mounting index routes...");
  apiRouter.use(indexRoutes);

  // Mount the API router
  app.use("/api", apiRouter);

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}