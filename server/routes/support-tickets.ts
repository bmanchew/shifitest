import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../services/logger';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Get all support tickets (with optional filtering)
 * This route handles requests to /api/support-tickets
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { merchantId, status, priority, category, limit, offset } = req.query;
    
    // Validate query parameters
    const parsedMerchantId = merchantId ? parseInt(merchantId as string) : undefined;
    const parsedLimit = limit ? parseInt(limit as string) : 20;
    const parsedOffset = offset ? parseInt(offset as string) : 0;
    
    if (
      (merchantId && isNaN(parsedMerchantId!)) ||
      isNaN(parsedLimit) || 
      isNaN(parsedOffset)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters"
      });
    }
    
    // Check user authorization
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }
    
    // Get all tickets first
    let tickets = await storage.getAllSupportTickets();

    // For merchants, enforce that they can only see their own tickets
    if (req.user.role === 'merchant') {
      // If no merchantId was provided, get it from the user's merchant record
      const userMerchantId = req.merchant?.id;
      
      if (!userMerchantId) {
        logger.warn({
          message: `User ${req.user.id} has merchant role but no merchant record`,
          category: "security",
          source: "internal",
          userId: req.user.id,
          metadata: { path: req.path }
        });
        
        return res.status(400).json({
          success: false,
          message: "Merchant record not found"
        });
      }
      
      // If merchantId parameter was provided, ensure it matches the user's merchant ID
      if (parsedMerchantId && parsedMerchantId !== userMerchantId) {
        logger.warn({
          message: `User ${req.user.id} attempted to access tickets for merchant ${parsedMerchantId} but is associated with merchant ${userMerchantId}`,
          category: "security",
          source: "internal",
          userId: req.user.id,
          metadata: { path: req.path, requestedMerchantId: parsedMerchantId, userMerchantId }
        });
        
        return res.status(403).json({
          success: false,
          message: "You can only access tickets for your merchant account"
        });
      }
      
      // Always filter by the user's merchant ID
      tickets = tickets.filter(ticket => ticket.merchantId === userMerchantId);
    } else if (req.user.role === 'admin') {
      // For admins, use the query parameter if provided
      if (parsedMerchantId) {
        tickets = tickets.filter(ticket => ticket.merchantId === parsedMerchantId);
      }
    } else {
      // For other roles (non-admins, non-merchants), forbid access
      return res.status(403).json({
        success: false,
        message: "Insufficient permission to access tickets"
      });
    }
    
    if (status) {
      tickets = tickets.filter(ticket => ticket.status === status);
    }
    
    if (priority) {
      tickets = tickets.filter(ticket => ticket.priority === priority);
    }
    
    if (category) {
      tickets = tickets.filter(ticket => ticket.category === category);
    }
    
    logger.info({
      message: `Retrieved ${tickets.length} support tickets`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: parsedMerchantId,
        status,
        priority,
        category,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
    
    res.json({
      success: true,
      tickets: tickets,  // Use 'tickets' key for response to match frontend expectation
      count: tickets.length
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving support tickets: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve support tickets"
    });
  }
});

/**
 * Get support ticket by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID format"
      });
    }
    
    // Check user authorization
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }
    
    const ticket = await storage.getSupportTicket(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found"
      });
    }
    
    // For merchant users, verify that the ticket belongs to their merchant account
    if (req.user.role === 'merchant') {
      const userMerchantId = req.merchant?.id;
      
      if (!userMerchantId) {
        logger.warn({
          message: `User ${req.user.id} has merchant role but no merchant record`,
          category: "security",
          source: "internal",
          userId: req.user.id,
          metadata: { path: req.path }
        });
        
        return res.status(400).json({
          success: false,
          message: "Merchant record not found"
        });
      }
      
      // Check if ticket belongs to the merchant
      if (ticket.merchantId !== userMerchantId) {
        logger.warn({
          message: `User ${req.user.id} attempted to access ticket ${id} belonging to merchant ${ticket.merchantId} but is associated with merchant ${userMerchantId}`,
          category: "security",
          source: "internal",
          userId: req.user.id,
          metadata: { 
            path: req.path, 
            ticketId: id,
            ticketMerchantId: ticket.merchantId,
            userMerchantId 
          }
        });
        
        return res.status(403).json({
          success: false,
          message: "You can only access tickets for your merchant account"
        });
      }
    }
    
    // Get attachments for the ticket
    const attachments = await storage.getTicketAttachmentsByTicketId(id);
    
    // Get activity log for the ticket
    const activityLog = await storage.getTicketActivityLogsByTicketId(id);
    
    res.json({
      success: true,
      ticket,
      attachments,
      activityLog
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving support ticket: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        ticketId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve support ticket"
    });
  }
});

export default router;