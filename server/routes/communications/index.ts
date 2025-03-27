import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middleware/auth';
import { storage } from '../../storage';
import { logger } from '../../services/logger';
import merchantRoutes from './merchant';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Register merchant-specific routes
router.use('/merchant', merchantRoutes);

// ===== CONVERSATION ROUTES =====

/**
 * Get all conversations with optional filtering
 */
router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const { contractId, userId, status, limit, offset } = req.query;
    
    // Validate query parameters
    const parsedContractId = contractId ? parseInt(contractId as string) : undefined;
    const parsedUserId = userId ? parseInt(userId as string) : undefined;
    const parsedLimit = limit ? parseInt(limit as string) : 20;
    const parsedOffset = offset ? parseInt(offset as string) : 0;
    
    if (
      (contractId && isNaN(parsedContractId!)) || 
      (userId && isNaN(parsedUserId!)) ||
      isNaN(parsedLimit) || 
      isNaN(parsedOffset)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters"
      });
    }
    
    let conversations = [];
    
    if (parsedContractId) {
      // Get conversations by contract ID
      conversations = await storage.getConversationsByContractId(parsedContractId);
    } else if (parsedUserId) {
      // Get conversations by user ID
      conversations = await storage.getConversationsByUserId(parsedUserId);
    } else {
      // Get all conversations with pagination
      conversations = await storage.getAllConversations(parsedLimit, parsedOffset);
    }
    
    // Filter by status if specified
    if (status) {
      conversations = conversations.filter(conv => conv.status === status);
    }
    
    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    logger.error({
      message: `Failed to get conversations: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        query: req.query,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get conversations"
    });
  }
});

/**
 * Get a specific conversation by ID
 */
router.get("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const conversationId = parseInt(req.params.id);
    
    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID"
      });
    }
    
    const conversation = await storage.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }
    
    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    logger.error({
      message: `Failed to get conversation: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        conversationId: req.params.id,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get conversation"
    });
  }
});

// ===== SUPPORT TICKET ROUTES =====

// For backward compatibility, add routes for support tickets using the same handlers
// These can be used with both /api/communications/support-tickets and /api/support-tickets
router.get("/support-tickets", async (req: Request, res: Response) => {
  // Forward to conversations endpoint with appropriate filtering
  req.query.type = 'support';
  
  try {
    const { userId, status, limit, offset } = req.query;
    
    // Validate query parameters
    const parsedUserId = userId ? parseInt(userId as string) : undefined;
    const parsedLimit = limit ? parseInt(limit as string) : 20;
    const parsedOffset = offset ? parseInt(offset as string) : 0;
    
    if (
      (userId && isNaN(parsedUserId!)) ||
      isNaN(parsedLimit) || 
      isNaN(parsedOffset)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters"
      });
    }
    
    // Get all conversations
    let tickets = await storage.getAllConversations(parsedLimit, parsedOffset);
    // Filter for support tickets by category
    tickets = tickets.filter(ticket => ticket.category === 'support');
    
    // Additional filters
    if (parsedUserId) {
      tickets = tickets.filter(ticket => ticket.createdBy === parsedUserId);
    }
    
    if (status) {
      tickets = tickets.filter(ticket => ticket.status === status);
    }
    
    res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    logger.error({
      message: `Failed to get support tickets: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        query: req.query,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get support tickets"
    });
  }
});

// Export as default
export default router;