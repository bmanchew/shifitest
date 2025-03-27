import { Router, Request, Response } from "express";
import { sesameAIService } from "../services/sesameAI";
import { logger } from "../services/logger";
import path from "path";

/**
 * Register routes for the SesameAI service
 * @param router Express router to register routes on
 */
export function registerSesameAIRoutes(router: Router) {
  const sesameRouter = Router();

  /**
   * Check service status
   */
  sesameRouter.get("/status", (req: Request, res: Response) => {
    const isInitialized = sesameAIService.isInitialized();

    logger.info({
      message: `SesameAI service status check: ${isInitialized ? "initialized" : "not initialized"}`,
      category: "api",
      source: "sesameai",
    });

    return res.json({
      success: true,
      status: isInitialized ? "ready" : "unavailable",
      message: isInitialized 
        ? "SesameAI service is ready" 
        : "SesameAI service is not initialized. Please check server logs for details."
    });
  });

  /**
   * Generate a voice response from text
   */
  sesameRouter.post("/generate", async (req: Request, res: Response) => {
    try {
      const { text, speakerId = 0 } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          message: "Text input is required"
        });
      }

      // Check if service is initialized
      if (!sesameAIService.isInitialized()) {
        return res.status(503).json({
          success: false,
          message: "SesameAI service is not initialized"
        });
      }

      logger.info({
        message: "Generating voice response",
        category: "api",
        source: "sesameai",
        metadata: {
          textLength: text.length,
          speakerId
        }
      });

      // Generate the voice response
      const outputPath = await sesameAIService.generateVoiceResponse(text, speakerId);
      
      // Convert to a public URL
      const fileName = path.basename(outputPath);
      const publicUrl = `/audio/${fileName}`;

      return res.json({
        success: true,
        audioUrl: publicUrl,
        text,
        speakerId
      });
    } catch (error) {
      logger.error({
        message: `Error generating voice response: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "sesameai",
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });

      return res.status(500).json({
        success: false,
        message: "Failed to generate voice response",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Generate a voice notification for a payment reminder
   */
  sesameRouter.post("/payment-reminder", async (req: Request, res: Response) => {
    try {
      const { contractId, customerName, amount, dueDate } = req.body;

      if (!contractId || !customerName || !amount || !dueDate) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: contractId, customerName, amount, dueDate"
        });
      }

      // Check if service is initialized
      if (!sesameAIService.isInitialized()) {
        return res.status(503).json({
          success: false,
          message: "SesameAI service is not initialized"
        });
      }

      // Create the payment reminder message
      const formattedAmount = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD' 
      }).format(amount);
      
      const formattedDate = new Date(dueDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });

      // Generate the reminder text
      const reminderText = `Hello ${customerName}, this is an automated reminder from ShiFi Financial. Your payment of ${formattedAmount} is due on ${formattedDate}. Please log in to your account to make your payment. Thank you for your business.`;

      logger.info({
        message: "Generating payment reminder voice message",
        category: "api",
        source: "sesameai",
        metadata: {
          contractId,
          customerName,
          amount,
          dueDate
        }
      });

      // Generate the voice message with the female voice (ID 2)
      const outputPath = await sesameAIService.generateVoiceResponse(reminderText, 2);
      
      // Convert to a public URL
      const fileName = path.basename(outputPath);
      const publicUrl = `/audio/${fileName}`;

      return res.json({
        success: true,
        audioUrl: publicUrl,
        text: reminderText,
        contractId,
        customerName,
        amount: formattedAmount,
        dueDate: formattedDate
      });
    } catch (error) {
      logger.error({
        message: `Error generating payment reminder: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "sesameai",
        metadata: {
          error: error instanceof Error ? error.stack : null,
          requestBody: req.body
        }
      });

      return res.status(500).json({
        success: false,
        message: "Failed to generate payment reminder voice message",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Generate a voice notification for application status updates
   */
  sesameRouter.post("/application-status", async (req: Request, res: Response) => {
    try {
      const { contractId, customerName, status, nextStep } = req.body;

      if (!contractId || !customerName || !status) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: contractId, customerName, status"
        });
      }

      // Check if service is initialized
      if (!sesameAIService.isInitialized()) {
        return res.status(503).json({
          success: false,
          message: "SesameAI service is not initialized"
        });
      }

      // Map status to a user-friendly message
      let statusMessage = "";
      switch (status) {
        case "pending":
          statusMessage = "is currently under review";
          break;
        case "approved":
          statusMessage = "has been approved";
          break;
        case "completed":
          statusMessage = "has been successfully completed";
          break;
        case "declined":
          statusMessage = "could not be approved at this time";
          break;
        default:
          statusMessage = `is now in ${status} status`;
      }

      // Create the next steps message
      const nextStepMessage = nextStep 
        ? ` The next step is: ${nextStep}.` 
        : "";

      // Generate the status update text
      const statusText = `Hello ${customerName}, this is an automated message from ShiFi Financial. Your application ${statusMessage}.${nextStepMessage} If you have any questions, please contact our customer service team. Thank you for choosing ShiFi Financial.`;

      logger.info({
        message: "Generating application status voice message",
        category: "api",
        source: "sesameai",
        metadata: {
          contractId,
          customerName,
          status,
          nextStep
        }
      });

      // Generate the voice message with the male voice (ID 1)
      const outputPath = await sesameAIService.generateVoiceResponse(statusText, 1);
      
      // Convert to a public URL
      const fileName = path.basename(outputPath);
      const publicUrl = `/audio/${fileName}`;

      return res.json({
        success: true,
        audioUrl: publicUrl,
        text: statusText,
        contractId,
        customerName,
        status
      });
    } catch (error) {
      logger.error({
        message: `Error generating application status voice message: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "sesameai",
        metadata: {
          error: error instanceof Error ? error.stack : null,
          requestBody: req.body
        }
      });

      return res.status(500).json({
        success: false,
        message: "Failed to generate application status voice message",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Mount the sesameRouter at the /sesameai endpoint
  router.use("/sesameai", sesameRouter);
}