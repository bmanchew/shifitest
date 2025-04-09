import { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { plaidService } from "../services/plaid";

/**
 * Plaid controller for handling Plaid API interactions
 */
export const plaidController = {
  /**
   * Get accounts for the authenticated user
   * @param req Express Request
   * @param res Express Response
   */
  async getAccounts(req: Request, res: Response) {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      }
      
      // Get Plaid connection for the user
      const plaidConnection = await storage.getPlaidConnection(req.user.id);
      
      if (!plaidConnection) {
        return res.status(404).json({
          success: false,
          message: "No Plaid connection found"
        });
      }
      
      // Get accounts from Plaid
      const accounts = await plaidService.getAccounts(plaidConnection.accessToken);
      
      res.status(200).json({
        success: true,
        accounts
      });
    } catch (error) {
      logger.error({
        message: `Error getting Plaid accounts: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        userId: req.user?.id,
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting accounts",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  
  /**
   * Handle Plaid webhook
   * @param req Express Request
   * @param res Express Response
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      // Log webhook received
      logger.info({
        message: `Plaid webhook received: ${req.body.webhook_type} - ${req.body.webhook_code}`,
        category: "webhook",
        source: "plaid",
        metadata: {
          webhookType: req.body.webhook_type,
          webhookCode: req.body.webhook_code,
          itemId: req.body.item_id
        }
      });
      
      // Store webhook in database for audit purposes
      await storage.createPlaidWebhookLog({
        webhookType: req.body.webhook_type,
        webhookCode: req.body.webhook_code,
        itemId: req.body.item_id,
        data: req.body,
        receivedAt: new Date()
      });
      
      // Process webhook asynchronously to avoid blocking the response
      // This is important because Plaid expects a quick response
      setImmediate(async () => {
        try {
          await plaidService.processWebhook(req.body);
        } catch (processError) {
          logger.error({
            message: `Error processing Plaid webhook: ${processError instanceof Error ? processError.message : String(processError)}`,
            category: "webhook",
            source: "plaid",
            metadata: {
              webhookType: req.body.webhook_type,
              webhookCode: req.body.webhook_code,
              itemId: req.body.item_id,
              error: processError instanceof Error ? processError.message : String(processError),
              stack: processError instanceof Error ? processError.stack : undefined
            }
          });
        }
      });
      
      // Respond to Plaid immediately
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error({
        message: `Error handling Plaid webhook: ${error instanceof Error ? error.message : String(error)}`,
        category: "webhook",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          body: req.body
        }
      });
      
      // Still respond to Plaid with success to avoid retries
      res.status(200).json({ received: true });
    }
  },
  
  /**
   * Get active Plaid merchants (admin only)
   * @param req Express Request
   * @param res Express Response
   */
  async getActivePlaidMerchants(req: Request, res: Response) {
    try {
      // Check if user is admin (should be verified by middleware already)
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin privileges required."
        });
      }
      
      // Get active Plaid merchants
      const merchants = await storage.getActivePlaidMerchants();
      
      res.status(200).json({
        success: true,
        merchants
      });
    } catch (error) {
      logger.error({
        message: `Error getting active Plaid merchants: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        userId: req.user?.id,
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting active Plaid merchants"
      });
    }
  },
  
  /**
   * Get contract bank connection
   * @param req Express Request
   * @param res Express Response
   */
  async getContractBankConnection(req: Request, res: Response) {
    try {
      const { contractId } = req.params;
      
      if (!contractId) {
        return res.status(400).json({
          success: false,
          message: "Contract ID is required"
        });
      }
      
      // Get bank connection for contract
      const connection = await plaidService.getBankConnectionForContract(parseInt(contractId));
      
      if (!connection) {
        return res.status(404).json({
          success: false,
          message: "No bank connection found for this contract"
        });
      }
      
      // Remove sensitive information
      const { accessToken, ...safeConnection } = connection;
      
      res.status(200).json({
        success: true,
        connection: safeConnection
      });
    } catch (error) {
      logger.error({
        message: `Error getting contract bank connection: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        userId: req.user?.id,
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          contractId: req.params.contractId
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting contract bank connection"
      });
    }
  },
  
  /**
   * Create a Plaid link token
   * @param req Express Request
   * @param res Express Response
   */
  async createLinkToken(req: Request, res: Response) {
    try {
      // Extract parameters from request
      const { products, redirect_uri, merchantId, isSignup } = req.body;
      
      let clientUserId;
      let userEmail;
      
      // For merchant signup flow where user isn't authenticated yet
      if (isSignup === true) {
        // Generate a temporary ID for signup flow
        clientUserId = `signup-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        logger.info({
          message: `Creating Plaid link token for merchant signup`,
          category: "api",
          source: "plaid",
          metadata: {
            clientUserId,
            isSignup: true,
            products: products || ["auth", "transactions", "assets"]
          }
        });
      } else if (!req.user) {
        // For non-signup flows where authentication is required
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      } else {
        // For authenticated users
        clientUserId = req.user.id.toString();
        userEmail = req.user.email;
        
        logger.info({
          message: `Plaid link token created for user: ${userEmail}`,
          category: "api",
          userId: req.user.id,
          source: "plaid",
          metadata: {
            products,
            merchantId
          }
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
      
      // Check if Plaid is properly initialized
      if (!plaidService.isInitialized()) {
        logger.error({
          message: "Plaid service not initialized when trying to create link token",
          category: "api",
          source: "plaid",
          metadata: {
            clientUserId,
            isSignup: isSignup
          },
        });
        
        return res.status(503).json({
          success: false,
          message: "Plaid service is not available. Please try again later.",
          error: "PLAID_NOT_INITIALIZED"
        });
      }
      
      // Create a real link token using the Plaid service
      const linkTokenResponse = await plaidService.createLinkToken({
        userId: clientUserId,
        clientUserId,
        products: formattedProducts,
        redirect_uri: redirect_uri
      });
      
      res.status(200).json({
        success: true,
        linkToken: linkTokenResponse.linkToken,
        link_token: linkTokenResponse.linkToken, // For backward compatibility
        expiration: linkTokenResponse.expiration
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
        message: `Error creating Plaid link token: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        userId: req.user?.id,
        source: "plaid",
        metadata: {
          errorDetails,
          errorCode,
          errorStack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error creating link token",
        error_code: errorCode
      });
    }
  },
  
  /**
   * Exchange a public token for an access token
   * @param req Express Request
   * @param res Express Response
   */
  async exchangePublicToken(req: Request, res: Response) {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      }
      
      const { public_token, metadata } = req.body;
      
      if (!public_token) {
        return res.status(400).json({
          success: false,
          message: "Public token is required"
        });
      }
      
      // Exchange public token for access token
      // This would use the Plaid client in a real implementation
      const accessToken = "placeholder_access_token"; // Replace with actual Plaid client call
      const itemId = "placeholder_item_id"; // Replace with actual Plaid client call
      
      // Store Plaid connection in database
      await storage.createPlaidConnection({
        userId: req.user.id,
        accessToken,
        itemId,
        status: "active",
        institutionId: metadata?.institution?.id,
        institutionName: metadata?.institution?.name,
        createdAt: new Date()
      });
      
      logger.info({
        message: `Plaid public token exchanged for user: ${req.user.email}`,
        category: "api",
        userId: req.user.id,
        source: "plaid",
        metadata: {
          itemId,
          institutionId: metadata?.institution?.id,
          institutionName: metadata?.institution?.name
        }
      });
      
      res.status(200).json({
        success: true,
        message: "Bank account connected successfully"
      });
    } catch (error) {
      logger.error({
        message: `Error exchanging Plaid public token: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        userId: req.user?.id,
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error connecting bank account"
      });
    }
  },
  
  /**
   * Get transactions for the authenticated user
   * @param req Express Request
   * @param res Express Response
   */
  async getTransactions(req: Request, res: Response) {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      }
      
      // Parse query parameters
      const startDate = req.query.startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Default to 30 days ago
      const endDate = req.query.endDate as string || new Date().toISOString().split('T')[0]; // Default to today
      
      // Get Plaid connection for the user
      const plaidConnection = await storage.getPlaidConnection(req.user.id);
      
      if (!plaidConnection) {
        return res.status(404).json({
          success: false,
          message: "No Plaid connection found"
        });
      }
      
      // Get transactions from storage
      const transactions = await storage.getPlaidTransactions(plaidConnection.itemId, startDate, endDate);
      
      res.status(200).json({
        success: true,
        transactions,
        startDate,
        endDate
      });
    } catch (error) {
      logger.error({
        message: `Error getting Plaid transactions: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        userId: req.user?.id,
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          startDate: req.query.startDate,
          endDate: req.query.endDate
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting transactions"
      });
    }
  },
  
  /**
   * Get all Plaid connections (admin only)
   * @param req Express Request
   * @param res Express Response
   */
  async getAllConnections(req: Request, res: Response) {
    try {
      // Check if user is admin (should be verified by middleware already)
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin privileges required."
        });
      }
      
      // Get all Plaid connections
      const connections = await storage.getAllPlaidConnections();
      
      // Remove sensitive information
      const safeConnections = connections.map(conn => {
        const { accessToken, ...safeConnection } = conn;
        return safeConnection;
      });
      
      res.status(200).json({
        success: true,
        connections: safeConnections
      });
    } catch (error) {
      logger.error({
        message: `Error getting all Plaid connections: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        userId: req.user?.id,
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting Plaid connections"
      });
    }
  },
  
  /**
   * Create an asset report for a contract (admin only)
   * @param req Express Request
   * @param res Express Response
   */
  async createAssetReport(req: Request, res: Response) {
    try {
      // Check if user is admin (should be verified by middleware already)
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin privileges required."
        });
      }
      
      const { contractId, daysRequested = 60 } = req.body;
      
      if (!contractId) {
        return res.status(400).json({
          success: false,
          message: "Contract ID is required"
        });
      }
      
      // Get bank connection for contract
      const connection = await plaidService.getBankConnectionForContract(parseInt(contractId));
      
      if (!connection) {
        return res.status(404).json({
          success: false,
          message: "No bank connection found for this contract"
        });
      }
      
      // Create asset report
      // This would use the Plaid client in a real implementation
      const assetReportToken = "placeholder_asset_report_token"; // Replace with actual Plaid client call
      const assetReportId = "placeholder_asset_report_id"; // Replace with actual Plaid client call
      
      // Store asset report in database
      await storage.createAssetReport({
        contractId: parseInt(contractId),
        assetReportToken,
        assetReportId,
        status: "pending",
        daysRequested,
        createdAt: new Date()
      });
      
      logger.info({
        message: `Asset report created for contract: ${contractId}`,
        category: "api",
        userId: req.user.id,
        source: "plaid",
        metadata: {
          contractId,
          daysRequested,
          assetReportId
        }
      });
      
      res.status(201).json({
        success: true,
        message: "Asset report creation initiated",
        assetReportId
      });
    } catch (error) {
      logger.error({
        message: `Error creating asset report: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        userId: req.user?.id,
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          contractId: req.body.contractId
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error creating asset report"
      });
    }
  },
  
  /**
   * Get an asset report (admin only)
   * @param req Express Request
   * @param res Express Response
   */
  async getAssetReport(req: Request, res: Response) {
    try {
      // Check if user is admin (should be verified by middleware already)
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin privileges required."
        });
      }
      
      const { assetReportId } = req.params;
      
      if (!assetReportId) {
        return res.status(400).json({
          success: false,
          message: "Asset report ID is required"
        });
      }
      
      // Get asset report from database
      const assetReport = await storage.getAssetReport(assetReportId);
      
      if (!assetReport) {
        return res.status(404).json({
          success: false,
          message: "Asset report not found"
        });
      }
      
      // If report is not ready, just return the status
      if (assetReport.status !== 'ready') {
        return res.status(200).json({
          success: true,
          assetReport: {
            id: assetReport.id,
            contractId: assetReport.contractId,
            status: assetReport.status,
            daysRequested: assetReport.daysRequested,
            createdAt: assetReport.createdAt
          }
        });
      }
      
      // Get asset report data from Plaid
      // This would use the Plaid client in a real implementation
      const reportData = { /* Placeholder for actual Plaid data */ };
      
      res.status(200).json({
        success: true,
        assetReport: {
          id: assetReport.id,
          contractId: assetReport.contractId,
          status: assetReport.status,
          daysRequested: assetReport.daysRequested,
          createdAt: assetReport.createdAt,
          report: reportData
        }
      });
    } catch (error) {
      logger.error({
        message: `Error getting asset report: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        userId: req.user?.id,
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          assetReportId: req.params.assetReportId
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting asset report"
      });
    }
  },
  
  /**
   * Refresh an asset report (admin only)
   * @param req Express Request
   * @param res Express Response
   */
  async refreshAssetReport(req: Request, res: Response) {
    try {
      // Check if user is admin (should be verified by middleware already)
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin privileges required."
        });
      }
      
      const { assetReportId } = req.params;
      const { daysRequested } = req.body;
      
      if (!assetReportId) {
        return res.status(400).json({
          success: false,
          message: "Asset report ID is required"
        });
      }
      
      // Get asset report from database
      const assetReport = await storage.getAssetReport(assetReportId);
      
      if (!assetReport) {
        return res.status(404).json({
          success: false,
          message: "Asset report not found"
        });
      }
      
      // Refresh asset report with Plaid
      // This would use the Plaid client in a real implementation
      const newAssetReportToken = "placeholder_new_asset_report_token"; // Replace with actual Plaid client call
      const newAssetReportId = "placeholder_new_asset_report_id"; // Replace with actual Plaid client call
      
      // Update asset report in database
      await storage.updateAssetReport(assetReportId, {
        assetReportToken: newAssetReportToken,
        assetReportId: newAssetReportId,
        status: "pending",
        daysRequested: daysRequested || assetReport.daysRequested,
        createdAt: new Date()
      });
      
      logger.info({
        message: `Asset report refreshed: ${assetReportId}`,
        category: "api",
        userId: req.user.id,
        source: "plaid",
        metadata: {
          assetReportId,
          newAssetReportId,
          daysRequested
        }
      });
      
      res.status(200).json({
        success: true,
        message: "Asset report refresh initiated",
        assetReportId: newAssetReportId
      });
    } catch (error) {
      logger.error({
        message: `Error refreshing asset report: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        userId: req.user?.id,
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          assetReportId: req.params.assetReportId
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error refreshing asset report"
      });
    }
  },
  
  /**
   * Get an asset report PDF (admin only)
   * @param req Express Request
   * @param res Express Response
   */
  async getAssetReportPdf(req: Request, res: Response) {
    try {
      // Check if user is admin (should be verified by middleware already)
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin privileges required."
        });
      }
      
      const { assetReportId } = req.params;
      
      if (!assetReportId) {
        return res.status(400).json({
          success: false,
          message: "Asset report ID is required"
        });
      }
      
      // Get asset report from database
      const assetReport = await storage.getAssetReport(assetReportId);
      
      if (!assetReport) {
        return res.status(404).json({
          success: false,
          message: "Asset report not found"
        });
      }
      
      // If report is not ready, return an error
      if (assetReport.status !== 'ready') {
        return res.status(400).json({
          success: false,
          message: "Asset report is not ready yet"
        });
      }
      
      // Get asset report PDF from Plaid
      // This would use the Plaid client in a real implementation
      const pdfBuffer = Buffer.from("placeholder_pdf_data"); // Replace with actual Plaid client call
      
      // Set appropriate headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="asset-report-${assetReportId}.pdf"`);
      
      // Send the PDF
      res.send(pdfBuffer);
    } catch (error) {
      logger.error({
        message: `Error getting asset report PDF: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        userId: req.user?.id,
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          assetReportId: req.params.assetReportId
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting asset report PDF"
      });
    }
  }
};