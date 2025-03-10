import express, { type Express, Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";

import { eq } from "drizzle-orm";
import { db } from "./db";
import { contracts } from "@shared/schema"; // Fix import path

import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertMerchantSchema,
  insertContractSchema,
  insertApplicationProgressSchema,
  insertLogSchema,
} from "@shared/schema";
import { twilioService } from "./services/twilio";
import { diditService } from "./services/didit";
import { plaidService } from "./services/plaid";
import { thanksRogerService } from "./services/thanksroger";
import { logger } from "./services/logger";
import { underwritingService } from './services/underwriting';
// Create admin reports router
const adminReportsRouter = express.Router();
import merchantAnalytics from "./routes/merchantAnalytics"; // Added import

// Register merchant analytics routes
adminReportsRouter.use("/complaint-trends", merchantAnalytics);

// Authentication middleware
export const authenticateToken = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication token is required" });
  }

  const secret = process.env.JWT_SECRET || 'default_secret_key_for_development';

  jwt.verify(token, secret, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    (req as any).user = user;
    next();
  });
};

// Admin role middleware
export const isAdmin = (req: Request, res: Response, next: Function) => {
  if ((req as any).user && (req as any).user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: "Access denied: Admin role required" });
  }
};

// Merchant role middleware
export const isMerchantUser = (req: Request, res: Response, next: Function) => {
  if ((req as any).user && (req as any).user.role === 'merchant') {
    next();
  } else {
    res.status(403).json({ message: "Access denied: Merchant role required" });
  }
};

// Helper function to convert metadata to JSON string for storage
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

  // Enable CORS for all API routes
  apiRouter.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
  });

  // Auth routes
  apiRouter.post("/auth/login", async (req: Request, res: Response) => {
    try {
      console.log("Login attempt:", req.body.email);
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      console.log("User found:", !!user);

      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // In a real app, we would generate a JWT token here
      // Instead, we'll just return the user object without password
      const { password: _, ...userWithoutPassword } = user;

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

      console.log("Login successful for user:", user.email, "with role:", user.role);
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ================ UNDERWRITING ROUTES =================
  app.post('/api/underwriting/process', async (req, res) => {
    const { userId, contractId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    try {
      const result = await underwritingService.processUnderwriting(parseInt(userId), contractId ? parseInt(contractId) : undefined);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({
        message: 'Error processing underwriting',
        error,
        metadata: {
          userId,
          contractId
        }
      });
      res.status(500).json({ message: 'Error processing underwriting', error: error.message });
    }
  });

  app.get('/api/underwriting/user/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
      const data = await storage.getUnderwritingDataByUserId(parseInt(userId));
      res.json({ success: true, data });
    } catch (error) {
      logger.error({
        message: 'Error retrieving underwriting data',
        error,
        metadata: {
          userId
        }
      });
      res.status(500).json({ message: 'Error retrieving underwriting data', error: error.message });
    }
  });

  app.get('/api/underwriting/contract/:contractId', async (req, res) => {
    const { contractId } = req.params;
    const userRole = req.query.role as string || 'customer';

    try {
      const data = await storage.getUnderwritingDataByContractId(parseInt(contractId));

      // For non-admin users, limit the data to just the credit tier
      if (userRole !== 'admin') {
        // If data exists, only return limited information
        if (data && data.length > 0) {
          const limitedData = data.map(item => ({
            id: item.id,
            contractId: item.contractId,
            creditTier: item.creditTier,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          }));
          return res.json({ success: true, data: limitedData });
        }
      }

      // For admins, return complete data
      res.json({ success: true, data });
    } catch (error) {
      logger.error({
        message: 'Error retrieving underwriting data',
        error,
        metadata: {
          contractId
        }
      });
      res.status(500).json({ message: 'Error retrieving underwriting data', error: error.message });
    }
  });

  // ================ USER ROUTES =================
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

  apiRouter.get("/contracts", async (req: Request, res: Response) => {
    try {
      const { merchantId, customerId } = req.query;

      let contracts;
      if (merchantId) {
        const id = parseInt(merchantId as string);
        if (isNaN(id)) {
          return res
            .status(400)
            .json({ message: "Invalid merchant ID format" });
        }
        contracts = await storage.getContractsByMerchantId(id);
      } else if (customerId) {
        const id = parseInt(customerId as string);
        if (isNaN(id)) {
          return res
            .status(400)
            .json({ message: "Invalid customer ID format" });
        }
        contracts = await storage.getContractsByCustomerId(id);
      } else {
        contracts = await storage.getAllContracts();
      }

      res.json(contracts);
    } catch (error) {
      console.error("Get contracts error:", error);
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


  // Route to handle creation of application progress items
  apiRouter.post("/application-progress", async (req: Request, res: Response) => {
    try {
      const { contractId, step, completed, data } = req.body;

      console.log("Creating application progress:", { 
        contractId, 
        contractIdType: typeof contractId,
        step, 
        completed, 
        dataExists: !!data 
      });

      if (!contractId || !step) {
        console.error("Missing required fields:", { contractId, step });
        return res.status(400).json({ 
          message: "Contract ID and step are required" 
        });
      }

      // Verify the contract exists with safer parsing
      let contractIdNum: number;
      try {
        // Handle different input types properly
        if (typeof contractId === 'string') {
          contractIdNum = parseInt(contractId);
        } else if (typeof contractId === 'number') {
          contractIdNum = contractId;
        } else {
          contractIdNum = parseInt(String(contractId));
        }

        if (isNaN(contractIdNum)) {
          throw new Error(`Invalid contract ID format: ${contractId}`);
        }

        console.log(`Parsed contract ID: ${contractIdNum} (from input: ${contractId})`);
      } catch (parseError) {
        console.error("Contract ID parse error:", parseError);
        return res.status(400).json({ 
          message: `Invalid contract ID format: ${contractId}`,
          details: String(parseError)
        });
      }

      // Verify the contract exists
      try {
        const contract = await storage.getContract(contractIdNum);
        if (!contract) {
          console.error(`Contract not found: ${contractIdNum}`);
          return res.status(404).json({ 
            message: "Contract not found",
            details: `No contract with ID ${contractIdNum} exists in the database`
          });
        }
        console.log(`Found contract: ${contract.id}, number: ${contract.contractNumber}`);
      } catch (dbError) {
        console.error(`Database error when looking up contract ${contractIdNum}:`, dbError);
        return res.status(500).json({
          message: "Error looking up contract",
          details: String(dbError)
        });
      }

      // Create the application progress item
      const progressItem = await storage.createApplicationProgress({
        contractId: contractIdNum,
        step: step,
        completed: !!completed,
        data: data || null
      });

      // Log the creation
      await storage.createLog({
        level: "info",
        category: "contract",
        message: `Application progress created for contract ${contractIdNum}, step ${step}`,
        metadata: JSON.stringify({ 
          contractId: contractIdNum, 
          step, 
          completed: !!completed 
        })
      });

      console.log(`Successfully created progress item for contract ${contractIdNum}, step ${step}`);
      res.status(201).json(progressItem);
    } catch (error) {
      console.error("Create application progress error:", error);
      res.status(500).json({ 
        message: "Internal server error", 
        error: error instanceof Error ? error.message : String(error)
      });
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

  // SMS endpoint using Twilio API
  apiRouter.post("/send-sms", async (req: Request, res: Response) => {
    try {
      // Check if this is a test SMS from admin panel
      if (req.body.phone && req.body.isTest) {
        // This is a test request from the admin API verification
        console.log(`Processing test SMS to ${req.body.phone}`);

        // Create test log entry
        await storage.createLog({
          level: "info",
          category: "api",
          source: "twilio",
          message: `Test SMS to ${req.body.phone}`,
          metadata: JSON.stringify(req.body),
        });

        // Send a real test message via Twilio service
        const testResult = await twilioService.sendSMS({
          to: req.body.phone,
          body: "This is a test message from ShiFi. Your API verification was successful.",
        });

        // Return appropriate response
        return res.json({
          success: true,
          message: testResult.isSimulated
            ? `Test SMS would be sent to ${req.body.phone}`
            : `Test SMS sent to ${req.body.phone}`,
          messageId:
            testResult.messageId ||
            "SM" + Math.random().toString(36).substring(2, 15).toUpperCase(),
          status: testResult.isSimulated ? "simulated" : "delivered",
        });
      }

      // Regular SMS flow
      const { phoneNumber, merchantId, amount } = req.body;

      if (!phoneNumber || !merchantId || !amount) {
        return res.status(400).json({
          message: "Phone number, merchant ID, and amount are required",
        });
      }

      // Get merchant
      const merchant = await storage.getMerchant(parseInt(merchantId));
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }

      // Create a contract for this financing request
      const contractNumber = generateContractNumber();
      const termMonths = 24; // Fixed term
      const interestRate = 0; // 0% APR
      const downPaymentPercent = 15; // 15% down payment
      const downPayment = amount * (downPaymentPercent / 100);
      const financedAmount = amount - downPayment;
      const monthlyPayment = financedAmount / termMonths;

      console.log("Creating contract with:", {
        contractNumber,
        merchantId,
        amount,
        downPayment,
        financedAmount,
        termMonths,
        interestRate,
        monthlyPayment,
      });

      // Create a new contract
      const newContract = await storage.createContract({
        contractNumber,
        merchantId,
        customerId: null, // Will be set when the customer completes the application
        amount,
        downPayment,
        financedAmount,
        termMonths,
        interestRate,
        monthlyPayment,
        status: "pending",
        currentStep: "terms",
      });

      // Create application progress for this contract
      const newProgress = await storage.createApplicationProgress({
        contractId: newContract.id,
        step: "terms",
        completed: false,
        data: null,
      });

      // Get the application base URL from Replit
      const replitDomain = getAppDomain();
      const applicationUrl = `https://${replitDomain}/apply/${newContract.id}`;

      // Prepare the SMS message
      const messageText = `You've been invited by ${merchant.name} to apply for financing of $${amount}. Click here to apply: ${applicationUrl}`;

      try {
        // Send SMS using our Twilio service
        const result = await twilioService.sendSMS({
          to: phoneNumber,
          body: messageText,
        });

        if (result.isSimulated) {
          console.log(`Simulated SMS to ${phoneNumber}: ${messageText}`);
        } else if (result.success) {
          console.log(
            `Successfully sent SMS to ${phoneNumber}, Message ID: ${result.messageId}`,
          );
        } else {
          console.error(`Failed to send SMS: ${result.error}`);
          throw new Error(result.error);
        }
      } catch (twilioError) {
        console.error("Twilio service error:", twilioError);
        throwtwilioError;
      }

      // Create log for SMS sending
      await storage.createLog({
        level: "info",
        category: "api",
        source: "twilio",
        message: `SMS sent to ${phoneNumber}`,
        metadata: JSON.stringify({
          merchantId,
          amount,
          contractId: newContract.id,
        }),
      });

      res.json({ success: true, message: "SMS sent successfully" });
    } catch (error) {
      console.error("Send SMS error:", error);

      // Create error log
      await storage.createLog({
        level: "error",
        category: "api",
        source: "twilio",
        message: `Failed to send SMS: ${error instanceof Error ? error.message : String(error)}`,
        metadata: JSON.stringify({
          error: error instanceof Error ? error.stack : null,
        }),
      });

      res.status(500).json({ message: "Internal server error" });
    }
  });

  // KYC verification API endpoint
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
          redirectUrl,        },
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

  // DiDit mock KYC verification UI - this simulates the DiDit verification page
  apiRouter.get("/mock/didit-kyc", async (req: Request, res: Response) => {
    try {
      const { sessionId, contractId } = req.query;

      if (!sessionId || !contractId) {
        return res.status(400).send("Missing required parameters");
      }

      // Get the application URL for messaging back to the parent window
      const appUrl = `https://${getAppDomain()}`;

      // Log access to the mock verification page
      logger.info({
        message: `Accessing mock DiDit verification page`,
        category: "api",
        source: "didit",
        metadata: {
          sessionId: String(sessionId),
          contractId: String(contractId),
          appUrl,
        },
      });

      // Return an HTML page that simulates the DiDit KYC verification UI
      res.setHeader("Content-Type", "text/html");
      return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>DiDit Verification</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sansserif; margin: 0; padding: 0; color: #333; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(to right, #4776E6, #8E54E9); color: white; padding: 20px; text-align: center; }
            .logo { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .step { display: none; padding: 20px; }
            .step.active { display: block; }
            .button { background: linear-gradient(to right, #4776E6, #8E54E9); border: none; color: white; padding: 10px 20px; 
                      border-radius: 4px; font-size: 16px; cursor: pointer; margin-top: 20px; }
            .center { text-align: center; }
            .success-icon { font-size: 48px; color: #4CAF50; margin: 20px 0; }
            .progress-bar { height: 5px; background: #eee; margin: 20px 0; }
            .progress-bar-inner { height: 100%; background: linear-gradient(to right, #4776E6, #8E54E9); width: 0; transition: width 0.3s; }
            .image-capture { border: 2px dashed #ccc; padding: 20px; text-align: center; margin: 15px 0; }
            .help-text { font-size: 14px; color: #666; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">DiDit Identity Verification</div>
            <div>Contract #${contractId} | Session ID: ${sessionId}</div>
          </div>
          <div class="container">
            <div class="progress-bar">
              <div class="progress-bar-inner" id="progress"></div>
            </div>

            <div class="step active" id="step1">
              <h2>Welcome to DiDit Identity Verification</h2>
              <p>We'll guide you through a simple identity verification process to confirm you are who you say you are.</p>
              <p>You'll need to:</p>
              <ol>
                <li>Take a photo of your ID document (passport, driver's license, or ID card)</li>
                <li>Take a selfie to match with your document photo</li>
              </ol>
              <p>This should take less than 2 minutes to complete.</p>
              <div class="center">
                <button class="button" onclick="nextStep(1, 2)">Start Verification</button>
              </div>
            </div>

            <div class="step" id="step2">
              <h2>Document Verification</h2>
              <p>Please take a clear photo of your identification document.</p>
              <div class="image-capture">
                <p><strong>Upload or capture your ID document</strong></p>
                <p class="help-text">Make sure all text is clearly visible and not blurry</p>
                <input type="file" accept="image/*" capture="environment" id="docImage">
              </div>
              <div class="center">
                <button class="button" onclick="nextStep(2, 3)">Continue</button>
              </div>
            </div>

            <div class="step" id="step3">
              <h2>Selfie Verification</h2>
              <p>Now let's take a selfie to match with your document photo.</p>
              <div class="image-capture">
                <p><strong>Take a selfie</strong></p>
                <p class="help-text">Make sure your face is clearly visible with good lighting</p>
                <input type="file" accept="image/*" capture="user" id="selfieImage">
              </div>
              <div class="center">
                <button class="button" onclick="nextStep(3, 4)">Continue</button>
              </div>
            </div>

            <div class="step" id="step4">
              <h2>Processing Your Verification</h2>
              <p class="center">Please wait while we process your identity verification...</p>
              <div class="center">
                <div class="success-icon" id="loading">⏳</div>
              </div>

              <script>
                // Simulate a successful verification after a short delay
                setTimeout(function() {
                  document.getElementById('loading').innerHTML = "✅";
                  document.getElementById('step4').innerHTML += '<h3 class="center">Verification Successful!</h3><p class="center">Your identity has been verified successfully.</p><div class="center"><button class="button" onclick="completeVerification()">Return to Application</button></div>';

                  // Send a simulated webhook notification to our application
                  fetch('/api/kyc/webhook', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      event_type: 'verification.completed',
                      session_id: '${sessionId}',
                      status: 'approved',
                      decision: {
                        status: 'approved'
                      },
                      vendor_data: '${contractId}',
                      customer_details: {
                        first_name: 'John',
                        last_name: 'Doe'
                      }
                    })
                  });
                }, 3000);
              </script>
            </div>
          </div>

          <script>
            // Update progress bar as user moves through steps
            function nextStep(current, next) {
              document.getElementById('step' + current).classList.remove('active');
              document.getElementById('step' + next).classList.add('active');
              document.getElementById('progress').style.width = (next * 25) + '%';
            }

            // Redirect back to the application when verification is complete
            function completeVerification() {
              window.opener ? window.opener.postMessage('verification_complete', '*') : null;
              window.parent.postMessage('verification_complete', '*');
              window.location.href = '/customer/application';
            }
          </script>
        </body>
      </html>
      `);
    } catch (error) {
      logger.error({
        message: `Error serving mock DiDit verification page: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      res.status(500).send("An error occurred");
    }
  });

  // DiDit KYC - Legacy test endpoint - for admin API verification
  apiRouter.post("/mock/didit-kyc", async (req: Request, res: Response) => {
    try {
      // Check if this is a test request from the admin panel
      if (req.body.firstName && req.body.lastName && req.body.email) {
        // This is a test request from the admin API verification
        console.log("Processing test KYC verification request");

        // Create test log entry
        await storage.createLog({
          level: "info",
          category: "api",
          source: "didit",
          message: `Test KYC verification for ${req.body.firstName} ${req.body.lastName}`,
          metadata: JSON.stringify(req.body),
        });

        // Return success for test with DiDit-like response format
        const sessionId =
          "session_" + Math.random().toString(36).substring(2, 15);
        return res.json({
          status: "completed",
          session_id: sessionId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          decision: {
            status: "approved",
            verification_result: "pass",
            reason: "All verification checks passed successfully",
            score: 0.95,
            verification_id:
              "vid_" + Math.floor(10000000 + Math.random() * 90000000),
          },
          customer_details: {
            first_name: req.body.firstName,
            last_name: req.body.lastName,
            email: req.body.email,
            dob: req.body.dob || "1990-01-01",
            address: {
              line1: "123 Main St",
              city: "New York",
              state: "NY",
              postal_code: "10001",
              country: "US",
            },
          },
        });
      }

      // Regular contract flow
      const { contractId, documentImage, selfieImage } = req.body;

      if (!contractId || !documentImage || !selfieImage) {
        return res.status(400).json({
          status: "error",
          error_code: "missing_required_fields",
          error_message:
            "Contract ID, document image, and selfie image are required",
          request_id: "req_" + Math.random().toString(36).substring(2, 15),
        });
      }

      // Get the domain for callback URLs
      const domain = getAppDomain();
      const callbackUrl = `https://${domain}/api/kyc/webhook`;

      let sessionData = null;

      // Check if DiDit service is initialized with credentials
      if (diditService.isInitialized()) {
        try {
          // Use our DiDit service to create a real verification session
          console.log("Using DiDit service for KYC verification");

          // Create verification session
          sessionData = await diditService.createVerificationSession({
            contractId,
            callbackUrl,
            allowedDocumentTypes: ["passport", "driving_license", "id_card"],
            allowedChecks: ["ocr", "face", "document_liveness", "aml"],
            requiredFields: [
              "first_name",
              "last_name",
              "date_of_birth",
              "document_number",
            ],
          });

          if (sessionData) {
            console.log(
              `DiDit verification session created: ${sessionData.session_id}`,
            );
          } else {
            console.warn(
              "Could not create DiDit verification session, falling back to simulation",
            );
          }
        } catch (diditError) {
          console.error("DiDit API error:", diditError);
          // Log the error but continue with simulation
          await storage.createLog({
            level: "error",
            category: "api",
            source: "didit",
            message: `Failed to create verification session: ${diditError instanceof Error ? diditError.message : String(diditError)}`,
            metadata: JSON.stringify({
              contractId,
              error:
                diditError instanceof Error
                  ? diditError.stack
                  : String(diditError),
            }),
          });
        }
      } else {
        console.warn(
          "DiDit service not initialized, falling back to simulation",
        );
      }

      // Create log for KYC verification
      await storage.createLog({
        level: "info",
        category: "api",
        source: "didit",
        message: `KYC verification for contract ${contractId}`,
        metadata: JSON.stringify({ contractId }),
      });

      // Generate a unique session ID in UUID format
      const sessionId =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

      // If we have a real session from DiDit, use that data
      if (sessionData) {
        // Return the real session data from DiDit
        res.json(sessionData);
      } else {
        // Simulate successful API response with proper DiDit format matching their documentation
        setTimeout(() => {
          const response = {
            session_id: sessionId,
            session_number: Math.floor(10000 + Math.random() * 90000),
            session_url: `https://verify.didit.me/session/${sessionId}`,
            vendor_data: contractId.toString(),
            callback: `https://${getAppDomain()}/api/kyc/webhook`,
            features: "OCR + FACE + AML",
            created_at: new Date().toISOString(),
            status: "created",
            expires_at: new Date(
              Date.now() + 24 * 60 * 60 * 1000,
            ).toISOString(), // 24 hours from now
          };

          res.json(response);
        }, 1000); // Simulate API delay
      }
    } catch (error) {
      console.error("KYC verification error:", error);

      // Create error log
      await storage.createLog({
        level: "error",
        category: "api",
        source: "didit",
        message: `Failed KYC verification: ${error instanceof Error ? error.message : String(error)}`,
        metadata: JSON.stringify({
          error: error instanceof Error ? error.stack : null,
        }),
      });

      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Thanks Roger contract signing endpoint
  apiRouter.post("/contract-signing", async (req: Request, res: Response) => {
    try {
      const { contractId, contractNumber, customerName, signatureData } = req.body;

      if (!contractId || !contractNumber || !customerName || !signatureData) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: contractId, contractNumber, customerName, and signatureData are required",
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
          message: "ThanksRoger API not fully configured. Missing env variables.",
          category: "contract",
          source: "thanksroger",
          metadata: { 
            apiKeySet: !!apiKey,
            workspaceIdSet: !!workspaceId,
            templateIdSet: !!templateId
          }
        });
      }

      // First, check if we already have a ThanksRoger contract ID for this contract
      // If not, create a new contract in ThanksRoger
      let thankRogerContractId = "";
      let signingLink = "";

      // Look up the ThanksRoger contract ID in the application progress
      const progress = await storage.getApplicationProgressByContractId(Number(contractId));
      const signingProgress = progress.find(step => step.step === "signing");

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
          const thanksRogerContract = await thanksRogerService.createFinancingContract({
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
              message: "Failed to create contract in Thanks Roger, using fallback mode",
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
                  createdAt: new Date().toISOString()
                })
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
                  createdAt: new Date().toISOString()
                })
              });
              signingProgressId = newProgress.id;
            }
          }
        } catch (error) {
          logger.error({
            message: `Error creating contract in ThanksRoger: ${error instanceof Error ? error.message : String(error)}`,
            category: "contract",
            source: "thanksroger",
            metadata: { contractId, contractNumber }
          });
          usingFallbackMode = true;
        }
      }

      // FALLBACK MODE: If we're in fallback mode, we'll store the signature locally without using ThanksRoger API
      if (usingFallbackMode) {
        logger.info({
          message: "Using fallback mode for contract signing - storing signature locally",
          category: "contract",
          source: "thanksroger",
          metadata: { contractId, contractNumber }
        });

        const signatureId = `local-sig-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        const signedAt = new Date().toISOString();

        // Update or create the signature progress
        const signatureData = {
          signatureId,
          signedAt,
          usingFallbackMode: true,
          status: "signed",
          contractNumber
        };

        if (signingProgressId) {
          await storage.updateApplicationProgressCompletion(
            signingProgressId,
            true, // Mark as completed
            JSON.stringify(signatureData)
          );
        } else {
          // Create new progress item
          const newProgress = await storage.createApplicationProgress({
            contractId: Number(contractId),
            step: "signing",
            completed: true,
            data: JSON.stringify(signatureData)
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
          message: "Contract signed successfully using fallback mode"
        });
      }

      // If we have a ThanksRoger contract ID, try to sign the contract through the API
      if (!thankRogerContractId) {
        return res.status(500).json({
          success: false,
          message: "Failed to obtain contract ID from ThanksRoger. Please try again or contact support.",
        });
      }

      try {
        // Now sign the contract with the provided signature data
        const signResult = await thanksRogerService.signContract({
          contractId: thankRogerContractId,
          signatureData,
          signerName: customerName,
          signatureDate: new Date().toISOString()
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
              documentUrl: signResult.documentUrl
            })
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
              documentUrl: signResult.documentUrl
            })
          });
          signingProgressId = newProgress.id;
        }

        // Update contract status
        await storage.updateContractStep(Number(contractId), "completed");
        await storage.updateContractStatus(Number(contractId), "active");

        // Return success response
        return res.json({
          success: true,
          contractId: thankRogerContractId,
          signatureId: signResult.signatureId,
          signingLink,
          signedAt: signResult.signedAt,
          status: signResult.status,
          message: "Contract signed successfully",
        });
      } catch (error) {
        logger.error({
          message: `Error signing contract with ThanksRoger API: ${error instanceof Error ? error.message : String(error)}`,
          category: "contract",
          source: "thanksroger",
          metadata: { contractId, thankRogerContractId }
        });

        // Switch to fallback mode if API signing fails
        logger.info({
          message: "Switching to fallback mode after API signing failure",
          category: "contract",
          source: "thanksroger"
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
              apiError: error instanceof Error ? error.message : String(error)
            })
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
              apiError: error instanceof Error ? error.message : String(error)
            })
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
          message: "Contract signed successfully using fallback mode"
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
        message: "An unexpected error occurred while processing your signature. Please try again or contact support.",
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
          constsignatureResponse = await fetch("https://api.thanksroger.com/v1/signatures", {
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
            throw new Error(`Thanks Roger API error: ${signatureResponse.status} ${signatureResponse.statusText}`);
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
  apiRouter.post("/kyc/webhook", async (req: Request, res: Response) => {
    try {
      // Extract webhook signature from headers for verification
      const webhookSignature = req.headers["x-signature"] as string;
      const webhookTimestamp = req.headers["x-timestamp"] as string;

      // Get the webhook secret from environment variables
      const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET_KEY;

      // Log the receipt of webhook with more detailed information
      logger.info({
        message: `Received DiDit webhook event`,
        category: "api",
        source: "didit",
        metadata: {
          eventType: req.body.event_type || req.body.status,
          sessionId: req.body.session_id,
          body: JSON.stringify(req.body),
          headers: JSON.stringify(req.headers),
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
      const { event_type, session_id, status, decision, vendor_data, customer_details } = req.body;

      // Extract contractId from vendor_data with improved error handling
      let contractId = null;
      try {
        if (vendor_data) {
          // Handle different vendor_data formats
          if (typeof vendor_data === 'string') {
            // Try to parse as JSON
            try {
              const parsedData = JSON.parse(vendor_data);
              contractId = parsedData.contractId?.toString();
            } catch (jsonError) {
              // If not valid JSON, check if the string itself is a numeric ID
              if (/^\d+$/.test(vendor_data)) {
                contractId = vendor_data;
              }
            }
          } else if (typeof vendor_data === 'object') {
            // Direct object access
            contractId = vendor_data.contractId?.toString();
          }
        }

        // Final fallback - try to find contract ID in the request body directly
        if (!contractId && req.body.contractId) {
          contractId = req.body.contractId.toString();
        }
      } catch (error) {
        logger.warn({
          message: `Failed to parse vendor_data in DiDit webhook: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "didit",
          metadata: { 
            vendor_data: typeof vendor_data === 'object' ? JSON.stringify(vendor_data) : vendor_data 
          },
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
          decision: decision ? JSON.stringify(decision) : null,
          isVerified,
          customer_details: customer_details ? JSON.stringify(customer_details) : null,
        },
      });

      if (!contractId) {
        logger.warn({
          message: "Missing contractId in DiDit webhook vendor_data",
          category: "api",
          source: "didit",
          metadata: { 
            vendor_data: typeof vendor_data === 'object' ? JSON.stringify(vendor_data) : vendor_data,
            body: JSON.stringify(req.body) 
          },
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
        status === "Declined" ||
        status === "approved" ||
        status === "declined" ||
        status === "completed"
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
          },
        });

        // Check if verification was approved with more comprehensive checks
        const isApproved =
          (decision?.status === "approved" || decision?.status === "Approved") ||
          status === "Approved" ||
          status === "approved" ||
          status === "completed" ||
          status === "Completed";

        try {
          // Find the KYC step in the application progress
          const applicationProgress = await storage.getApplicationProgressByContractId(parseInt(contractId));

          let kycStep = applicationProgress.find((step) => step.step === "kyc");

          // If KYC step doesn't exist, create it
          if (!kycStep) {
            logger.info({
              message: `Creating missing KYC step for contract ${contractId}`,
              category: "api",
              source: "didit",
            });

            const newKycStep = await storage.createApplicationProgress({
              contractId: parseInt(contractId),
              step: "kyc",
              completed: false,
              data: null
            });

            kycStep = newKycStep;
          }

          if (kycStep) {
            if (isApproved) {
              // Get customer details from different possible locations in the webhook
              const kycData = decision?.kyc || {};
              const customerInfo = customer_details || {};

              // Log full customer details received
              logger.info({
                message: `DiDit customer details for contract ${contractId}`,
                category: "api",
                source: "didit",
                metadata: { 
                  customerInfo: JSON.stringify(customerInfo),
                  kycData: JSON.stringify(kycData)
                },
              });

              // Prepare the data to save with all possible properties
              const kycSaveData = {
                verified: true,
                sessionId: session_id,
                verifiedAt: new Date().toISOString(),
                firstName: customerInfo.first_name || kycData.first_name,
                lastName: customerInfo.last_name || kycData.last_name,
                email: customerInfo.email || kycData.email,
                phone: customerInfo.phone || kycData.phone,
                documentType: kycData.document_type || customerInfo.document_type,
                documentNumber: kycData.document_number || customerInfo.document_number,
                dateOfBirth: customerInfo.date_of_birth || kycData.date_of_birth,
                address: kycData.address || customerInfo.address,
                completedVia: "webhook",
                rawResponse: JSON.stringify(req.body),
              };

              // Log the data we're about to save
              logger.info({
                message: `Saving KYC data for contract ${contractId}`,
                category: "api",
                source: "didit",
                metadata: { 
                  kycStepId: kycStep.id,
                  kycSaveData 
                },
              });

              // Mark the KYC step as completed
              const updateResult = await storage.updateApplicationProgressCompletion(
                kycStep.id,
                true, // Completed
                JSON.stringify(kycSaveData),
              );

              logger.info({
                message: `KYC step update result for contract ${contractId}`,
                category: "api",
                source: "didit",
                metadata: { updateResult },
              });

              // Move the contract to the next step and update customer information if available
              const contract = await storage.getContract(parseInt(contractId));
              if (contract) {
                // If contract doesn't have a customer ID yet, try to find or create user
                if (!contract.customerId && kycSaveData.firstName && kycSaveData.lastName) {
                  try {
                    // Try to find existing user by email
                    let user = null;
                    if (kycSaveData.email) {
                      user = await storage.getUserByEmail(kycSaveData.email);
                    }

                    // If no user found, create a new one based on KYC data
                    if (!user) {
                      logger.info({
                        message: `Creating new user from KYC data for contract ${contractId}`,
                        category: "user",
                        source: "didit"
                      });

                      // Generate a secure temporary password
                      const tempPassword = Math.random().toString(36).slice(-10);

                      // Create new user
                      user = await storage.createUser({
                        name: `${kycSaveData.firstName} ${kycSaveData.lastName}`,
                        email: kycSaveData.email || `customer-${Date.now()}@example.com`,
                        password: tempPassword, // In a real app, would hash and notify user
                        role: "customer",
                        phone: kycSaveData.phone || "",
                        metadata: JSON.stringify({
                          createdFromKyc: true,
                          kycSessionId: session_id
                        })
                      });

                      // Log user creation
                      logger.info({
                        message: `Created new user ${user.id} from KYC data`,
                        category: "user",
                        source: "didit",
                        metadata: { userId: user.id, contractId }
                      });
                    }

                    // Associate user with contract
                    if (user) {
                      await db.update(contracts)
                        .set({ customerId: user.id })
                        .where(eq(contracts.id, parseInt(contractId)))
                        .execute();

                      logger.info({
                        message: `Associated user ${user.id} with contract ${contractId}`,
                        category: "contract",
                        source: "didit"
                      });
                    }
                  } catch (userError) {
                    logger.error({
                      message: `Error creating/associating user from KYC data: ${userError instanceof Error ? userError.message : String(userError)}`,
                      category: "user",
                      source: "didit",
                      metadata: { contractId, kycData: JSON.stringify(kycSaveData) }
                    });
                  }
                }

                // Update contract step if currently on KYC
                if (contract.currentStep === "kyc") {
                  await storage.updateContractStep(parseInt(contractId), "bank");
                }
              }

              // Log successful KYC verification
              logger.info({
                message: `KYC verification approved for contract ${contractId}`,
                category: "contract",
                metadata: { contractId, kycStepId: kycStep.id },
              });
            } else {
              // Mark verification as failed but don't complete the step
              const failureData = {
                verified: false,
                sessionId: session_id,
                status: decision?.status || status,
                timestamp: new Date().toISOString(),
                reason: "Verification declined or incomplete",
                rawResponse: JSON.stringify(req.body),
              };

              await storage.updateApplicationProgressCompletion(
                kycStep.id,
                false, // Not completed
                JSON.stringify(failureData),
              );

              logger.warn({
                message: `KYC verification failed for contract ${contractId}`,
                category: "contract",
                metadata: {
                  contractId,
                  kycStepId: kycStep.id,
                  status: decision?.status || status,
                  failureData,
                },
              });
            }
          } else {
            logger.error({
              message: `Could not find or create KYC step for contract ${contractId}`,
              category: "contract",
              metadata: { contractId },
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

        // Store initial status in the KYC step
        try {
          const applicationProgress = await storage.getApplicationProgressByContractId(parseInt(contractId));
          const kycStep = applicationProgress.find((step) => step.step === "kyc");

          if (kycStep) {
            await storage.updateApplicationProgressCompletion(
              kycStep.id,
              false, // Not completed yet
              JSON.stringify({
                verified: false,
                sessionId: session_id,
                startedAt: new Date().toISOString(),
                status: "in_progress",
              })
            );
          }
        } catch (error) {
          logger.warn({
            message: `Error updating KYC step for verification start: ${error instanceof Error ? error.message : String(error)}`,
            category: "api",
            source: "didit",
            metadata: { contractId, sessionId: session_id },
          });
        }
      } else if (event_type === "verification.cancelled") {
        logger.info({
          message: `DiDit verification cancelled for session ${session_id}, contract ${contractId}`,
          category: "api",
          source: "didit",
          metadata: { sessionId: session_id, contractId },
        });

        // Update KYC step as cancelled
        try {
          const applicationProgress = await storage.getApplicationProgressByContractId(parseInt(contractId));
          const kycStep = applicationProgress.find((step) => step.step === "kyc");

          if (kycStep) {
            await storage.updateApplicationProgressCompletion(
              kycStep.id,
              false, // Not completed
              JSON.stringify({
                verified: false,
                sessionId: session_id,
                cancelledAt: new Date().toISOString(),
                status: "cancelled",
              })
            );
          }
        } catch (error) {
          logger.warn({
            message: `Error updating KYC step for verification cancellation: ${error instanceof Error ? error.message : String(error)}`,
            category: "api",
            source: "didit",
            metadata: { contractId, sessionId: session_id },
          });
        }
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
          body: req.body ? JSON.stringify(req.body) : null,
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

  // Create a link token - used to initialize Plaid Link
  apiRouter.post(
    "/plaid/create-link-token",
    async (req: Request, res: Response) => {
      try {
        const { userId, userName, userEmail, products, redirectUri } = req.body;

        if (!userId) {
          return res.status(400).json({
            success: false,
            message: "User ID is required",
          });
        }

        const clientUserId = userId.toString();

        logger.info({
          message: `Creating Plaid link token for user ${clientUserId}`,
          category: "api",
          source: "plaid",
          metadata: {
            userId: clientUserId,
            products,
          },
        });

        const linkTokenResponse = await plaidService.createLinkToken({
          userId: clientUserId,
          clientUserId,
          userName,
          userEmail,
          products, // Optional products array passed from frontend
          redirectUri, // Optional redirect URI for OAuth flow
        });

        res.json({
          success: true,
          linkToken: linkTokenResponse.linkToken,
          expiration: linkTokenResponse.expiration,
        });
      } catch (error) {
        logger.error({
          message: `Failed to create Plaid link token: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "plaid",
          metadata: {
            error: error instanceof Error ? error.stack : null,
          },
        });

        res.status(500).json({
          success: false,
          message: "Failed to create Plaid link token",
        });
      }
    },
  );

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

        // In a real app, store this in your database
        // For example:
        // await db.insert(bankAccounts).values(bankInfo);

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
        //   where: eq(bank`accounts.contractId, parseInt(contractId as string))
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

        if (bankStep && bankStep.completed && bankStep.data) {
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
        message: `Failed to get Plaidaccount info: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      res.status(500).json({
        success: false,
        message: "Failed to get account information",
      });
    }
  });

  // Create a transfer (payment)
  apiRouter.post(
    "/plaid/create-transfer",
    async (req: Request, res: Response) => {
      try {
        const { contractId, amount, description } = req.body;

        if (!contractId || !amount) {
          return res.status(400).json({
            success: false,
            message: "Contract ID and amount are required",
          });
        }

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

          return res.status(500).json({
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
        const { userId, contractId, daysRequested = 60 } = req.body;

        if (!userId && !contractId) {
          return res.status(400).json({
            success: false,
            message: "Either userId or contractId is required",
          });
        }

        // In a real app, fetch the access token from your database
        // For this example, we'll simulate the asset report creation

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

        // Simulate creating an asset report
        // In a real implementation, you would:
        // 1. Retrieve the access token from your database
        // 2. Make the actual asset report API call

        const assetReportId =
          "asset_" + Math.random().toString(36).substring(2, 15);
        const assetReportToken =
          "asset-token-" + Math.random().toString(36).substring(2, 15);

        // Create a record of the asset report
        const assetReportInfo = {
          userId: userId ? parseInt(userId) : null,
          contractId: contractId ? parseInt(contractId) : null,
          assetReportId,
          assetReportToken, // This should be encrypted in a real app
          daysRequested,
          status: "pending",
          createdAt: new Date(),
        };

        // In a real app, store this in your database
        // For example:
        // await db.insert(assetReports).values(assetReportInfo);

        // Create a log entry
        await storage.createLog({
          level: "info",
          category: "api",
          source: "plaid",
          message: `Asset report created`,
          userId: userId ? parseInt(userId) : null,
          metadata: JSON.stringify({
            contractId,
            assetReportId,
            daysRequested,
          }),
        });

        // Return success response
        // Do NOT include the asset report token in the response
        res.json({
          success: true,
          assetReportId,
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
          source: "plaid",
          message: `Failed to create asset report: ${error instanceof Error ? error.message : String(error)}`,
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

        // In a real app, fetch the asset report token from your database
        // For this example, we'll simulate the asset report retrieval

        logger.info({
          message: `Retrieving asset report`,
          category: "api",
          source: "plaid",
          metadata: { assetReportId },
        });

        // Simulate getting an asset report
        // In a real implementation, you would:
        // 1. Retrieve the asset report token from your database
        // 2. Makeactual asset report API call

        // Create some mock asset report data
        const mockAssetReport = {
          assetReportId,
          createdDate: new Date().toISOString(),
          daysRequested: 60,
          user: {
            firstName: "John",
            lastName: "Doe",
          },
          items: [
            {
              institutionName: "Chase",
              lastUpdated: new Date().toISOString(),
              accounts: [
                {
                  accountId:
                    "acc_" + Math.random().toString(36).substring(2, 10),
                  accountName: "Chase Checking",
                  type: "depository",
                  subtype: "checking",
                  currentBalance: 5280.25,
                  availableBalance: 5200.1,
                  transactions: [
                    {
                      transactionId:
                        "tx_" + Math.random().toString(36).substring(2, 10),
                      date: new Date(
                        Date.now() - 3 * 24 * 60 * 60 * 1000,
                      ).toISOString(),
                      description: "WALMART",
                      amount: 45.23,
                      pending: false,
                    },
                    {
                      transactionId:
                        "tx_" + Math.random().toString(36).substring(2, 10),
                      date: new Date(
                        Date.now() - 5 * 24 * 60 * 60 * 1000,
                      ).toISOString(),
                      description: "AMAZON",
                      amount: 67.89,
                      pending: false,
                    },
                  ],
                },
                {
                  accountId:
                    "acc_" + Math.random().toString(36).substring(2, 10),
                  accountName: "Chase Savings",
                  type: "depository",
                  subtype: "savings",
                  currentBalance: 10250.75,
                  availableBalance: 10250.75,
                  transactions: [
                    {
                      transactionId:
                        "tx_" + Math.random().toString(36).substring(2, 10),
                      date: new Date(
                        Date.now() - 10 * 24 * 60 * 60 * 1000,
                      ).toISOString(),
                      description: "TRANSFER FROM CHECKING",
                      amount: -500.0,
                      pending: false,
                    },
                  ],
                },
              ],
            },
          ],
          summary: {
            totalAccounts: 2,
            totalTransactions: 3,
            totalBalances: 15531.0,
            income: {
              estimatedMonthlyIncome: 5200,
              estimatedAnnualIncome: 62400,
              confidenceScore: 0.95,
            },
          },
        };

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

        // Return success response with the asset report data
        res.json({
          success: true,
          assetReport: mockAssetReport,
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
  apiRouter.post("/plaid/webhook", async (req: Request, res: Response) => {
    try {
      const { webhook_type, webhook_code, item_id } = req.body;

      logger.info({
        message: `Received Plaid webhook`,
        category: "api",
        source: "plaid",
        metadata: {
          webhookType: webhook_type,
          webhookCode: webhook_code,
          itemId: item_id,
        },
      });

      // Handle different webhook types
      switch (webhook_type) {
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

        case "AUTH":
          // Handle auth webhooks
          logger.info({
            message: `Auth webhook received: ${webhook_code}`,
            category: "api",
            source: "plaid",
            metadata: { itemId: item_id },
          });
          break;

        case "ASSETS":
          // Handle assets webhooks
          logger.info({
            message: `Assets webhook received: ${webhook_code}`,
            category: "api",
            source: "plaid",
            metadata: {
              itemId: item_id,
              assetReportId: req.body.asset_report_id,
            },
          });
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

  // ================ ADMIN ROUTES =================

  // Route to trigger database migrations (admin only)
  app.post('/api/admin/run-migrations', async (req, res) => {
    try {
      // In production this should have proper authentication
      const { runMigrations } = require('./migrations');
      await runMigrations();
      res.json({ success: true, message: 'Migrations completed successfully' });
    } catch (error) {
      logger.error({
        message: 'Error running migrations',
        error,
      });
      res.status(500).json({ success: false, message: 'Error running migrations', error: error.message });
    }
  });

  // Mount admin reports router
  app.use("/api/admin/reports", adminReportsRouter);

  // Route for creating application progress
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

  // Mount the API router
  app.use("/api", apiRouter);
  // merchantAnalytics routes are already included properly in the apiRouter

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}

// Helper function for monthly payment calculation
function calculateMonthlyPayment(principal: number, interestRate: number, termMonths: number): number {
  if (interestRate === 0) {
    return principal / termMonths;
  }

  const monthlyRate = interestRate / 100 / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

// Helper function to generate contract numbers
function generateContractNumber(): string {
  return `SHI-${Math.floor(1000 + Math.random() * 9000)}`;
}

//Helper function to calculate monthly payment.
function calculateMonthlyPayment(principal: number, interestRate: number, termMonths: number): number {
  if (interestRate === 0) {
    return principal / termMonths;
  }

  const monthlyRate = interestRate / 100 / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

// Add merchant routes
apiRouter.post("/merchant/send-financing-link", async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, amount, merchantId, termMonths, interestRate } = req.body;

    if (!customerName || !customerPhone || !amount || !merchantId) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    // Validate input data
    const parsedAmount = Number(amount);
    const parsedMerchantId = Number(merchantId);
    const parsedTermMonths = Number(termMonths) || 24;
    const parsedInterestRate = Number(interestRate) || 0;

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount value"
      });
    }

    if (isNaN(parsedMerchantId) || parsedMerchantId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID"
      });
    }

    // Get merchant information to verify it exists
    const merchant = await storage.getMerchant(parsedMerchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    const merchantName = merchant.name;

    // Calculate financial values
    const downPayment = parsedAmount * 0.15; // 15% down payment by default
    const financedAmount = parsedAmount * 0.85;
    const monthlyPayment = calculateMonthlyPayment(
      financedAmount, 
      parsedInterestRate, 
      parsedTermMonths
    );

    // Create a contract in pending status
    const contract = await storage.createContract({
      merchantId: parsedMerchantId,
      customerId: null, // Will be populated when customer creates account
      contractNumber: generateContractNumber(),
      amount: parsedAmount,
      downPayment: downPayment,
      financedAmount: financedAmount,
      termMonths: parsedTermMonths,
      interestRate: parsedInterestRate,
      monthlyPayment: monthlyPayment,
      status: "pending"
    });

    // Log the created contract for debugging
    logger.info({
      message: `Created new contract #${contract.contractNumber} with ID ${contract.id}`,
      category: "contract",
      source: "merchant",
      metadata: { 
        contractId: contract.id,
        merchantId: parsedMerchantId,
        amount: parsedAmount,
        status: "pending"
      }
    });

    // Format the amount as USD
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const formattedAmount = formatter.format(parsedAmount);

    // Send SMS notification
    try {
      // In a real app, integrate with an SMS provider like Twilio
      // For now, log the message
      logger.info({
        message: `SMS notification would be sent to ${customerPhone}`,
        category: "sms",
        source: "merchant",
        metadata: { 
          to: customerPhone, 
          customerName,
          customerEmail,
          amount: parsedAmount,
          contractId: contract.id,
          merchantId: parsedMerchantId
        }
      });

      // Include the actual contract ID in the URL
      const applicationUrl = `${req.protocol}://${req.get('host')}/customer/application/${contract.id}`;
      const smsMessage = `${customerName}, ${merchantName} has sent you a financing offer for ${formattedAmount}. View and accept: ${applicationUrl}`;

      logger.info({
        message: `SMS Content: ${smsMessage}`,
        category: "sms",
        source: "merchant"
      });
    } catch (error) {
      logger.error({
        message: `Failed to send SMS notification: ${error instanceof Error ? error.message : String(error)}`,
        category: "sms",
        source: "merchant",
        metadata: { customerPhone, contractId: contract.id }
      });
      // Continue execution even if SMS fails
    }

    res.json({ 
      success: true, 
      message: "Financing link sent successfully", 
      contractId: contract.id 
    });
  } catch (error) {
    logger.error({
      message: `Error sending financing link: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "merchant",
      metadata: { body: req.body }
    });
    res.status(500).json({ 
      success: false, 
      message: "Failed to send financing link" 
    });
  }
});

  // Mount the API router
  app.use("/api", apiRouter);
  // merchantAnalytics routes are already included properly in the apiRouter

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}

// Helper function for monthly payment calculation
function calculateMonthlyPayment(principal: number, interestRate: number, termMonths: number): number {
  if (interestRate === 0) {
    return principal / termMonths;
  }

  const monthlyRate = interestRate / 100 / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

// Helper function to generate contract numbers
function generateContractNumber(): string {
  return `SHI-${Math.floor(1000 + Math.random() * 9000)}`;
}

try {
    const { contractId, step, completed, data } = req.body;

    // Validate required fields
    if (!contractId || !step) {
      return res.status(400).json({
        message: "Missing required fields",
        details: "contractId and step are required"
      });
    }

    // Validate contract ID
    const contractIdNum = Number(contractId);

    if (isNaN(contractIdNum) || contractIdNum <= 0) {
      return res.status(400).json({
        message: "Invalid contract ID format",
        details: `Contract ID must be a positive number, received: ${contractId}`
      });
    }

    logger.info({
      message: `Processing application progress for contract: ${contractIdNum}, step: ${step}`,
      category: "api",
      source: "application",
      metadata: { contractId: contractIdNum, step, completed }
    });

    // Validate contract exists
    const contract = await storage.getContract(contractIdNum);
    if (!contract) {
      logger.warn({
        message: `Contract not found when creating application progress`,
        category: "api",
        source: "application",
        metadata: { contractId: contractIdNum }
      });

      return res.status(404).json({ 
        message: "Contract not found",
        details: `No contract with ID ${contractIdNum} exists in the database`
      });
    }

    // Check if progress for this step already exists
    const existingProgress = await storage.getApplicationProgressByContractAndStep(contractIdNum, step);

    let progress;
    if (existingProgress) {
      // Update existing progress
      progress = await storage.updateApplicationProgressCompletion(
        existingProgress.id,
        completed === true,
        data || existingProgress.data
      );

      logger.info({
        message: `Updated application progress: ${existingProgress.id} for contract ${contractIdNum}`,
        category: "api",
        source: "application",
        metadata: { progressId: existingProgress.id, contractId: contractIdNum, step }
      });
    } else {
      // Create new progress record
      progress = await storage.createApplicationProgress({
        contractId: contractIdNum,
        step,
        completed: completed === true,
        data: data || null
      });

      logger.info({
        message: `Created application progress for contract ${contractIdNum}`,
        category: "api",
        source: "application",
        metadata: { progressId: progress.id, contractId: contractIdNum, step }
      });
    }

    res.status(201).json(progress);
  } catch (error) {
    logger.error({
      message: `Error handling application progress: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "application",
      metadata: { body: req.body }
    });
    res.status(500).json({ 
      message: "Failed to process application progress", 
      details: error instanceof Error ? error.message : String(error)
    });
  }