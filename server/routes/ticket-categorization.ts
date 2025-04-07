import { Router } from "express";
import { z } from "zod";
import { ticketCategorizationService } from "../services/ticketCategorization";
import { logger } from "../services/logger";
import { isAuthenticated } from "../middleware/auth";

const router = Router();

// Schema for the categorization request
const categorizationRequestSchema = z.object({
  subject: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
});

/**
 * Route to get AI-powered categorization suggestions for a support ticket
 * 
 * This endpoint uses OpenAI's GPT models to suggest appropriate categories and priorities
 * for support tickets based on their subject and description.
 */
router.post("/api/support-tickets/ai-categorize", isAuthenticated, async (req, res) => {
  try {
    // Validate the request body
    const validationResult = categorizationRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.format(),
      });
    }

    const { subject, description } = validationResult.data;

    logger.info({
      message: "AI ticket categorization requested",
      category: "support",
      source: req.ip,
      metadata: {
        userId: req.user?.id,
        subject: subject.substring(0, 50) + (subject.length > 50 ? "..." : ""),
      },
    });

    // Get AI categorization
    const categorization = await ticketCategorizationService.categorizeTicket(
      subject,
      description
    );

    if (!categorization) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate categorization suggestions",
      });
    }

    // Return the suggestion
    return res.json({
      success: true,
      suggestion: {
        category: categorization.category,
        priority: categorization.priority,
        confidence: categorization.confidence,
        explanation: categorization.explanation,
        tags: categorization.tags,
      },
    });
  } catch (error) {
    logger.error({
      message: `Error in AI categorization: ${error instanceof Error ? error.message : String(error)}`,
      category: "support",
      source: req.ip,
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : null,
      },
    });

    return res.status(500).json({
      success: false,
      error: "An error occurred while processing your request",
    });
  }
});

export default router;