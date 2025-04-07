import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../services/logger';
import { z } from 'zod';

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

/**
 * Get messages for a specific support ticket
 */
router.get("/:id/messages", async (req: Request, res: Response) => {
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
          message: `User ${req.user.id} attempted to access messages for ticket ${id} belonging to merchant ${ticket.merchantId} but is associated with merchant ${userMerchantId}`,
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
    
    // Check if the ticket has a conversation ID
    if (!ticket.conversationId) {
      return res.json([]);
    }
    
    // Get messages for the conversation
    const messages = await storage.getMessagesByConversationId(ticket.conversationId);
    
    return res.json(messages);
  } catch (error) {
    logger.error({
      message: `Error retrieving ticket messages: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        ticketId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve ticket messages"
    });
  }
});

/**
 * Add a message to a support ticket
 */
router.post("/:id/messages", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID format"
      });
    }
    
    // Validate request body
    const messageSchema = z.object({
      content: z.string().min(1, "Message content is required"),
      senderId: z.number().optional(),
      senderType: z.enum(["admin", "merchant", "customer", "system"]).default("merchant")
    });
    
    const validatedData = messageSchema.parse(req.body);
    
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
          message: `User ${req.user.id} attempted to add a message to ticket ${id} belonging to merchant ${ticket.merchantId} but is associated with merchant ${userMerchantId}`,
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
          message: "You can only add messages to tickets for your merchant account"
        });
      }
    }
    
    // Check if the ticket has a conversation ID
    if (!ticket.conversationId) {
      // Create a new conversation for this ticket
      const conversation = await storage.createConversation({
        createdBy: req.user.id,
        status: "active",
        priority: ticket.priority,
        category: ticket.category,
        subject: ticket.subject,
        topic: `Support Ticket #${ticket.ticketNumber}`
      });
      
      // Update the ticket with the new conversation ID
      await storage.updateSupportTicket(id, {
        conversationId: conversation.id,
        updatedAt: new Date()
      });
      
      // Update our ticket object with the new conversation ID
      ticket.conversationId = conversation.id;
    }
    
    // Add the message
    const message = await storage.createMessage({
      conversationId: ticket.conversationId,
      senderId: validatedData.senderId || req.user.id,
      senderRole: validatedData.senderType,
      content: validatedData.content,
      isRead: false
    });
    
    // If the sender is a merchant, update the ticket status to pending_customer
    // to indicate that customer/admin needs to respond
    if (validatedData.senderType === "merchant") {
      await storage.updateSupportTicket(id, {
        status: "pending_customer",
        updatedAt: new Date()
      });
    } 
    // If the sender is an admin, update the ticket status to pending_merchant
    // to indicate that merchant needs to respond
    else if (validatedData.senderType === "admin") {
      await storage.updateSupportTicket(id, {
        status: "pending_merchant",
        updatedAt: new Date()
      });
    }
    
    // Log the activity
    await storage.createTicketActivityLog({
      ticketId: id,
      activityType: "message_added",
      performedBy: req.user.id,
      performedByType: req.user.role,
      metadata: JSON.stringify({
        messageId: message.id,
        senderType: validatedData.senderType
      })
    });
    
    return res.json({
      success: true,
      message
    });
  } catch (error) {
    logger.error({
      message: `Error adding ticket message: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        ticketId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to add ticket message"
    });
  }
});

/**
 * Update support ticket status
 */
router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID format"
      });
    }
    
    // Validate request body
    const statusSchema = z.object({
      status: z.enum([
        "new", 
        "in_progress", 
        "pending_merchant", 
        "pending_customer", 
        "resolved", 
        "closed",
        "escalated",
        "under_review"
      ]),
      updatedBy: z.number().optional(),
      updatedByType: z.enum(["admin", "merchant", "system"]).default("merchant")
    });
    
    const validatedData = statusSchema.parse(req.body);
    
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
          message: `User ${req.user.id} attempted to update status of ticket ${id} belonging to merchant ${ticket.merchantId} but is associated with merchant ${userMerchantId}`,
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
          message: "You can only update tickets for your merchant account"
        });
      }
      
      // Merchants can only change status to these values
      const allowedMerchantStatusChanges = ["resolved", "in_progress"];
      if (!allowedMerchantStatusChanges.includes(validatedData.status)) {
        return res.status(403).json({
          success: false,
          message: `Merchants can only change ticket status to: ${allowedMerchantStatusChanges.join(", ")}`
        });
      }
    }
    
    // Update timestamps based on status
    const updateData: any = {
      status: validatedData.status,
      updatedAt: new Date()
    };
    
    if (validatedData.status === "resolved") {
      updateData.resolvedAt = new Date();
    } else if (validatedData.status === "closed") {
      updateData.closedAt = new Date();
    }
    
    // Update the ticket status
    await storage.updateSupportTicket(id, updateData);
    
    // Log the activity
    await storage.createTicketActivityLog({
      ticketId: id,
      activityType: "status_change",
      performedBy: req.user.id,
      performedByType: req.user.role,
      metadata: JSON.stringify({
        oldStatus: ticket.status,
        newStatus: validatedData.status
      })
    });
    
    return res.json({
      success: true,
      message: "Ticket status updated successfully"
    });
  } catch (error) {
    logger.error({
      message: `Error updating ticket status: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        ticketId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to update ticket status"
    });
  }
});

export default router;