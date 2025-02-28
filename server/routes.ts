import express, { type Express, Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertMerchantSchema, insertContractSchema, insertApplicationProgressSchema, insertLogSchema } from "@shared/schema";

function generateContractNumber(): string {
  return `SHI-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const apiRouter = express.Router();
  
  // Auth routes
  apiRouter.post("/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      
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
        metadata: JSON.stringify({ ip: req.ip, userAgent: req.get("user-agent") })
      });
      
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // User routes
  apiRouter.post("/users", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user with email already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({ message: "User with this email already exists" });
      }
      
      const newUser = await storage.createUser(userData);
      
      // Create log for user creation
      await storage.createLog({
        level: "info",
        message: `User created: ${newUser.email}`,
        metadata: JSON.stringify({ id: newUser.id, role: newUser.role })
      });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = fromZodError(error);
        return res.status(400).json({ message: "Validation error", errors: formattedError });
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
        metadata: JSON.stringify({ id: newMerchant.id, email: newMerchant.email })
      });
      
      res.status(201).json(newMerchant);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = fromZodError(error);
        return res.status(400).json({ message: "Validation error", errors: formattedError });
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
          completed: false
        });
      }
      
      // Create log for contract creation
      await storage.createLog({
        level: "info",
        message: `Contract created: ${newContract.contractNumber}`,
        metadata: JSON.stringify({
          id: newContract.id,
          merchantId: newContract.merchantId,
          amount: newContract.amount
        })
      });
      
      res.status(201).json(newContract);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedError = fromZodError(error);
        return res.status(400).json({ message: "Validation error", errors: formattedError });
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
          return res.status(400).json({ message: "Invalid merchant ID format" });
        }
        contracts = await storage.getContractsByMerchantId(id);
      } else if (customerId) {
        const id = parseInt(customerId as string);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid customer ID format" });
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
      const progress = await storage.getApplicationProgressByContractId(contract.id);
      
      res.json({ contract, progress });
    } catch (error) {
      console.error("Get contract error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  apiRouter.patch("/contracts/:id/status", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      const { status } = req.body;
      if (!status || !["pending", "active", "completed", "declined", "cancelled"].includes(status)) {
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
        metadata: JSON.stringify({ id: contract.id, previousStatus: contract.status })
      });
      
      res.json(updatedContract);
    } catch (error) {
      console.error("Update contract status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  apiRouter.patch("/contracts/:id/step", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      const { step } = req.body;
      if (!step || !["terms", "kyc", "bank", "payment", "signing", "completed"].includes(step)) {
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
        metadata: JSON.stringify({ id: contract.id, previousStep: contract.currentStep })
      });
      
      res.json(updatedContract);
    } catch (error) {
      console.error("Update contract step error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Application Progress routes
  apiRouter.get("/application-progress", async (req: Request, res: Response) => {
    try {
      const { contractId } = req.query;
      
      if (!contractId) {
        return res.status(400).json({ message: "Contract ID is required" });
      }
      
      const id = parseInt(contractId as string);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid contract ID format" });
      }
      
      const progress = await storage.getApplicationProgressByContractId(id);
      res.json(progress);
    } catch (error) {
      console.error("Get application progress error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  apiRouter.patch("/application-progress/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      const { completed, data } = req.body;
      if (typeof completed !== "boolean") {
        return res.status(400).json({ message: "Completed must be a boolean" });
      }
      
      const progress = await storage.getApplicationProgress(id);
      if (!progress) {
        return res.status(404).json({ message: "Application progress not found" });
      }
      
      const updatedProgress = await storage.updateApplicationProgressCompletion(id, completed, data);
      
      // If this step is completed, check if we should update the contract's current step
      if (completed) {
        const contract = await storage.getContract(progress.contractId);
        if (contract) {
          // Get all progress items for this contract
          const allProgress = await storage.getApplicationProgressByContractId(contract.id);
          
          // Find the next incomplete step
          const steps = ["terms", "kyc", "bank", "payment", "signing"];
          const nextIncompleteStepIndex = steps.findIndex(step => {
            const stepProgress = allProgress.find(p => p.step === step);
            return stepProgress && !stepProgress.completed;
          });
          
          // If all steps are complete, mark as completed, otherwise update to the next step
          if (nextIncompleteStepIndex === -1) {
            await storage.updateContractStep(contract.id, "completed");
            await storage.updateContractStatus(contract.id, "active");
          } else {
            await storage.updateContractStep(contract.id, steps[nextIncompleteStepIndex]);
          }
        }
      }
      
      // Create log for application progress update
      await storage.createLog({
        level: "info",
        message: `Application progress updated: ${progress.step} to ${completed ? "completed" : "incomplete"}`,
        metadata: JSON.stringify({ id: progress.id, contractId: progress.contractId })
      });
      
      res.json(updatedProgress);
    } catch (error) {
      console.error("Update application progress error:", error);
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
  
  // SMS simulation endpoint (in a real app, this would use Twilio or similar)
  apiRouter.post("/send-sms", async (req: Request, res: Response) => {
    try {
      const { phoneNumber, merchantId, amount } = req.body;
      
      if (!phoneNumber || !merchantId || !amount) {
        return res.status(400).json({ message: "Phone number, merchant ID, and amount are required" });
      }
      
      // Get merchant
      const merchant = await storage.getMerchant(parseInt(merchantId));
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }
      
      // In a real app, we would send an actual SMS here
      // For now, we'll just simulate it
      console.log(`SMS sent to ${phoneNumber}: You've been invited by ${merchant.name} to apply for financing of $${amount}. Click here to apply: https://shifi.com/apply/123`);
      
      // Create log for SMS sending
      await storage.createLog({
        level: "info",
        message: `SMS sent to ${phoneNumber}`,
        metadata: JSON.stringify({ merchantId, amount })
      });
      
      res.json({ success: true, message: "SMS sent successfully" });
    } catch (error) {
      console.error("Send SMS error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Mock API for DiDit KYC (in a real app, this would call the DiDit API)
  apiRouter.post("/mock/didit-kyc", (req: Request, res: Response) => {
    const { firstName, lastName, dob, address, licenseNumber } = req.body;
    
    if (!firstName || !lastName || !dob || !address || !licenseNumber) {
      return res.status(400).json({ message: "All fields are required" });
    }
    
    // Simulate API response
    setTimeout(() => {
      const response = {
        success: true,
        verificationId: "KYC" + Math.floor(10000000 + Math.random() * 90000000),
        customerData: {
          firstName,
          lastName,
          dob,
          address,
          licenseNumber,
          verified: true,
          score: 85,
        }
      };
      
      res.json(response);
    }, 1000); // Simulate API delay
  });
  
  // Mock API for Plaid (in a real app, this would call the Plaid API)
  apiRouter.post("/mock/plaid-link", (req: Request, res: Response) => {
    const { publicToken, accountId } = req.body;
    
    if (!publicToken || !accountId) {
      return res.status(400).json({ message: "Public token and account ID are required" });
    }
    
    // Simulate API response
    setTimeout(() => {
      const response = {
        success: true,
        accessToken: "access-sandbox-" + Math.random().toString(36).substring(2, 15),
        accountData: {
          accountId,
          accountName: "Checking Account",
          accountType: "checking",
          accountSubtype: "checking",
          accountMask: "1234",
          institution: {
            name: "Chase",
            institutionId: "ins_3"
          }
        }
      };
      
      res.json(response);
    }, 1000); // Simulate API delay
  });
  
  // Mock API for Thanks Roger contract signing (in a real app, this would call the Thanks Roger API)
  apiRouter.post("/mock/thanks-roger-signing", (req: Request, res: Response) => {
    const { contractId, signerName, signerEmail } = req.body;
    
    if (!contractId || !signerName || !signerEmail) {
      return res.status(400).json({ message: "Contract ID, signer name, and signer email are required" });
    }
    
    // Simulate API response
    setTimeout(() => {
      const response = {
        success: true,
        signatureId: "SIG" + Math.floor(10000000 + Math.random() * 90000000),
        contractId,
        signedAt: new Date().toISOString(),
        status: "signed",
        documentUrl: "https://example.com/contracts/signed.pdf"
      };
      
      res.json(response);
    }, 1000); // Simulate API delay
  });
  
  // Mount the API router
  app.use("/api", apiRouter);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
