import express, { Request, Response, Router } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";
import { 
  insertConversationSchema, 
  insertMessageSchema,
  insertSupportTicketSchema,
  insertTicketAttachmentSchema,
  insertTicketActivityLogSchema,
  type InsertConversation, 
  type Conversation,
  type Message,
  type InsertMessage,
  type SupportTicket,
  type InsertSupportTicket,
  type TicketAttachment,
  type InsertTicketAttachment,
  type TicketActivityLog,
  type InsertTicketActivityLog 
} from "@shared/schema";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { notificationService } from "../services/index";
import { NotificationType } from "../services/notification";
import crypto from "crypto";
import { authenticateToken, isAuthenticated } from "../middleware/auth";

const router = Router();

// ===== CONVERSATION ROUTES =====

// Get all conversations (with optional filtering)
router.get("/", async (req: Request, res: Response) => {
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
    
    let conversations: Conversation[] = [];
    
    if (parsedContractId) {
      // Get conversations by contract ID
      conversations = await storage.getConversationsByContractId(parsedContractId);
    } else if (parsedUserId) {
      // Get conversations by user ID
      conversations = await storage.getConversationsByUserId(parsedUserId);
    } else {
      // Get all conversations with pagination
      // In a real app, you might want to restrict this by user role
      conversations = await storage.getAllConversations(parsedLimit, parsedOffset);
    }
    
    // Filter by status if specified
    if (status) {
      conversations = conversations.filter(conv => conv.status === status);
    }
    
    logger.info({
      message: `Retrieved ${conversations.length} conversations`,
      category: "api",
      source: "internal",
      metadata: {
        contractId: parsedContractId,
        userId: parsedUserId,
        status,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
    
    res.json({
      success: true,
      conversations,
      meta: {
        count: conversations.length,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving conversations: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve conversations"
    });
  }
});

// ===== SUPPORT TICKET ROUTES =====

// Get all support tickets (with optional filtering)
router.get("/tickets", async (req: Request, res: Response) => {
  try {
    const { merchantId, status, category, assignedTo, limit, offset } = req.query;
    
    // Validate query parameters
    const parsedMerchantId = merchantId ? parseInt(merchantId as string) : undefined;
    const parsedAssignedTo = assignedTo ? parseInt(assignedTo as string) : undefined;
    const parsedLimit = limit ? parseInt(limit as string) : 20;
    const parsedOffset = offset ? parseInt(offset as string) : 0;
    
    if (
      (merchantId && isNaN(parsedMerchantId!)) || 
      (assignedTo && isNaN(parsedAssignedTo!)) ||
      isNaN(parsedLimit) || 
      isNaN(parsedOffset)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters"
      });
    }
    
    let tickets = await storage.getAllSupportTickets(parsedLimit, parsedOffset);
    
    // Apply filters if specified
    if (parsedMerchantId) {
      tickets = tickets.filter(ticket => ticket.merchantId === parsedMerchantId);
    }
    
    if (status) {
      tickets = tickets.filter(ticket => ticket.status === status);
    }
    
    if (category) {
      tickets = tickets.filter(ticket => ticket.category === category);
    }
    
    if (parsedAssignedTo) {
      tickets = tickets.filter(ticket => ticket.assignedTo === parsedAssignedTo);
    }
    
    logger.info({
      message: `Retrieved ${tickets.length} support tickets`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: parsedMerchantId,
        status,
        category,
        assignedTo: parsedAssignedTo,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
    
    res.json({
      success: true,
      tickets,
      meta: {
        count: tickets.length,
        limit: parsedLimit,
        offset: parsedOffset
      }
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

// Get conversation by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID format"
      });
    }
    
    const conversation = await storage.getConversation(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }
    
    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving conversation: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        conversationId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve conversation"
    });
  }
});

// Create a new conversation
router.post("/", async (req: Request, res: Response) => {
  try {
    // Define an extended schema that includes the initial message
    const extendedSchema = z.object({
      merchantId: z.number({
        required_error: "Merchant ID is required",
        invalid_type_error: "Merchant ID must be a number"
      }),
      contractId: z.number().optional().nullable(),
      topic: z.string({
        required_error: "Topic is required",
        invalid_type_error: "Topic must be a string"
      }).min(1, "Topic cannot be empty"),
      message: z.string({
        required_error: "Initial message is required",
        invalid_type_error: "Message must be a string"
      }).min(1, "Message cannot be empty"),
      createdBy: z.number({
        required_error: "Creator ID is required",
        invalid_type_error: "Creator ID must be a number"
      }).optional(),
      category: z.string({
        required_error: "Category is required",
        invalid_type_error: "Category must be a string"
      }).default("general"),
      priority: z.string().optional().default("normal"),
      status: z.enum(["active", "resolved", "archived"]).optional().default("active"),
    });
    
    // Parse and validate the input
    const validatedData = extendedSchema.parse(req.body);
    
    // Extract message content from validated data
    const { message, ...conversationData } = validatedData;
    
    // If createdBy is not provided, use the authenticated user's ID if available
    if (!conversationData.createdBy && req.user) {
      conversationData.createdBy = req.user.id;
    }
    
    // Ensure createdBy exists at this point
    if (!conversationData.createdBy) {
      return res.status(400).json({
        success: false,
        message: "Creator ID (createdBy) is required"
      });
    }
    
    // Validate that the merchant exists
    const merchant = await storage.getMerchant(conversationData.merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Referenced merchant not found"
      });
    }
    
    // Validate that the contract exists if specified
    if (conversationData.contractId) {
      const contract = await storage.getContract(conversationData.contractId);
      if (!contract) {
        return res.status(404).json({
          success: false,
          message: "Referenced contract not found"
        });
      }
    }
    
    // Validate that the creator exists
    const creator = await storage.getUser(conversationData.createdBy);
    if (!creator) {
      return res.status(404).json({
        success: false,
        message: "Creator user not found"
      });
    }
    
    // Create the conversation
    // Map fields from our validated schema to the database schema
    const conversationDbData = {
      merchantId: conversationData.merchantId,
      contractId: conversationData.contractId,
      subject: conversationData.topic, // Map 'topic' to 'subject' for DB
      status: conversationData.status,
      metadata: JSON.stringify({
        priority: conversationData.priority,
        category: conversationData.category,
        createdBy: conversationData.createdBy
      })
    };
    
    // Create the conversation in the database
    const newConversation = await storage.createConversation(conversationDbData);
    
    // Create the initial message
    const newMessage = await storage.createMessage({
      conversationId: newConversation.id,
      senderId: conversationData.createdBy,
      content: message,
      isRead: false,
    });
    
    logger.info({
      message: `Created new conversation: ${conversationData.topic}`,
      category: "api",
      source: "internal",
      userId: conversationData.createdBy,
      metadata: {
        conversationId: newConversation.id,
        contractId: conversationData.contractId,
        category: conversationData.category,
        messageId: newMessage.id
      }
    });
    
    // Return the ID for redirection plus conversation details
    res.status(201).json({
      success: true,
      id: newConversation.id,
      conversation: {
        ...newConversation,
        // Add the fields expected by the client that are stored in metadata
        topic: conversationData.topic,
        priority: conversationData.priority,
        category: conversationData.category,
        createdBy: conversationData.createdBy
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: fromZodError(error).toString()
      });
    }
    
    logger.error({
      message: `Error creating conversation: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        requestBody: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to create conversation"
    });
  }
});

// Update conversation status
router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID format"
      });
    }
    
    const { status } = req.body;
    if (!status || !["active", "resolved", "archived"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing status parameter"
      });
    }
    
    const conversation = await storage.getConversation(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }
    
    const updatedConversation = await storage.updateConversationStatus(id, status);
    
    logger.info({
      message: `Updated conversation status: ${conversation.topic} -> ${status}`,
      category: "api",
      source: "internal",
      metadata: {
        conversationId: id,
        oldStatus: conversation.status,
        newStatus: status
      }
    });
    
    res.json({
      success: true,
      conversation: updatedConversation
    });
  } catch (error) {
    logger.error({
      message: `Error updating conversation status: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        conversationId: req.params.id,
        requestBody: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to update conversation status"
    });
  }
});

// Get messages for a conversation
router.get("/:id/messages", async (req: Request, res: Response) => {
  try {
    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID format"
      });
    }
    
    const { limit, offset } = req.query;
    const parsedLimit = limit ? parseInt(limit as string) : 50;
    const parsedOffset = offset ? parseInt(offset as string) : 0;
    
    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters"
      });
    }
    
    // Verify conversation exists
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }
    
    const messages = await storage.getMessagesByConversationId(
      conversationId,
      { limit: parsedLimit, offset: parsedOffset }
    );
    
    res.json({
      success: true,
      messages,
      meta: {
        count: messages.length,
        conversationId,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving messages: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        conversationId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve messages"
    });
  }
});

// Send a message in a conversation
router.post("/:id/messages", async (req: Request, res: Response) => {
  try {
    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID format"
      });
    }
    
    // Verify conversation exists
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }
    
    // Parse and validate message data
    const messageData: InsertMessage = {
      ...insertMessageSchema.parse(req.body),
      conversationId
    };
    
    // Verify sender exists
    const sender = await storage.getUser(messageData.senderId);
    if (!sender) {
      return res.status(404).json({
        success: false,
        message: "Sender user not found"
      });
    }
    
    const newMessage = await storage.createMessage(messageData);
    
    // Update conversation's lastMessageAt timestamp
    await storage.updateConversation(conversationId, {
      lastMessageAt: new Date(),
      // If conversation was resolved or archived, reactivate it
      status: conversation.status !== "active" ? "active" : conversation.status
    });
    
    logger.info({
      message: `New message sent in conversation: ${conversation.topic}`,
      category: "api",
      source: "internal",
      userId: messageData.senderId,
      metadata: {
        conversationId,
        messageId: newMessage.id,
        senderRole: messageData.senderRole
      }
    });
    
    res.status(201).json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: fromZodError(error).toString()
      });
    }
    
    logger.error({
      message: `Error sending message: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        conversationId: req.params.id,
        requestBody: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to send message"
    });
  }
});

// Mark message as read
router.patch("/messages/:id/read", async (req: Request, res: Response) => {
  try {
    const messageId = parseInt(req.params.id);
    if (isNaN(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID format"
      });
    }
    
    const updatedMessage = await storage.markMessageAsRead(messageId);
    if (!updatedMessage) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }
    
    res.json({
      success: true,
      message: updatedMessage
    });
  } catch (error) {
    logger.error({
      message: `Error marking message as read: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        messageId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to mark message as read"
    });
  }
});

// Mark all messages in a conversation as read for a specific user
router.post("/:id/read", async (req: Request, res: Response) => {
  try {
    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID format"
      });
    }
    
    const { userId } = req.body;
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required"
      });
    }
    
    const parsedUserId = parseInt(userId);
    
    // Verify conversation exists
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }
    
    // Verify user exists
    const user = await storage.getUser(parsedUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    const updatedCount = await storage.markAllMessagesAsRead(conversationId, parsedUserId);
    
    res.json({
      success: true,
      messagesRead: updatedCount,
      message: `Marked ${updatedCount} messages as read`
    });
  } catch (error) {
    logger.error({
      message: `Error marking messages as read: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        conversationId: req.params.id,
        requestBody: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to mark messages as read"
    });
  }
});

// Get unread message count for a merchant
// Get unread message count for merchant by ID
router.get("/merchant/:merchantId/unread-count", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID format"
      });
    }
    
    // Check if merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    try {
      const unreadCount = await storage.getUnreadMessageCountForMerchant(merchantId);
      
      // Ensure format is consistent with merchant/unread-count endpoint
      res.json({
        success: true,
        unreadCount,
        count: unreadCount
      });
    } catch (dbError) {
      // Handle database errors specifically
      logger.error({
        message: `Database error retrieving unread count: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
        category: "api",
        source: "internal",
        metadata: {
          merchantId,
          error: dbError instanceof Error ? dbError.stack : String(dbError)
        }
      });
      
      // Return 0 count when there's a database error rather than failing the API call
      // Include count property for consistency with successful response
      res.json({
        success: true,
        unreadCount: 0,
        count: 0
      });
    }
  } catch (error) {
    logger.error({
      message: `Error retrieving merchant unread count: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: req.params.merchantId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve merchant unread message count"
    });
  }
});

// Special endpoint for the frontend that uses the current authenticated merchant
// This endpoint matches the URL /api/communications/merchant/unread-count that the frontend expects
router.get("/merchant/unread-count", authenticateToken, async (req: Request, res: Response) => {
  try {
    // Get the current authenticated user from request
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - User not authenticated"
      });
    }
    
    // Find the merchant associated with this user
    const merchant = await storage.getMerchantByUserId(user.id);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found for current user"
      });
    }
    
    const merchantId = merchant.id;
    
    try {
      const unreadCount = await storage.getUnreadMessageCountForMerchant(merchantId);
      
      // Return data in format expected by the frontend
      // Ensure we include both unreadCount and count properties
      // This is to maintain compatibility with different versions of the frontend
      res.json({
        success: true,
        unreadCount,
        count: unreadCount
      });
    } catch (dbError) {
      // Handle database errors specifically
      logger.error({
        message: `Database error retrieving unread count: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
        category: "api",
        source: "internal",
        metadata: {
          merchantId,
          userId: user.id,
          error: dbError instanceof Error ? dbError.stack : String(dbError)
        }
      });
      
      // Return 0 count when there's a database error rather than failing the API call
      // Include both count and unreadCount properties
      res.json({
        success: true,
        unreadCount: 0,
        count: 0
      });
    }
  } catch (error) {
    logger.error({
      message: `Error retrieving merchant unread count for current user: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve merchant unread message count"
    });
  }
});

// Get conversations for a merchant
router.get("/merchant/:merchantId", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID format"
      });
    }
    
    // Check if merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    const conversations = await storage.getConversationsForMerchant(merchantId);
    
    res.json({
      success: true,
      conversations,
      count: conversations.length
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving merchant conversations: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: req.params.merchantId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve merchant conversations"
    });
  }
});

// Get conversations for a customer's contracts
router.get("/customer/:customerId", async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId);
    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID format"
      });
    }
    
    // Check if customer exists
    const customer = await storage.getUser(customerId);
    if (!customer || customer.role !== "customer") {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }
    
    // Get all contracts for this customer
    const contracts = await storage.getContractsByCustomerId(customerId);
    if (contracts.length === 0) {
      return res.json({
        success: true,
        conversations: [],
        count: 0
      });
    }
    
    // Get conversations for each contract
    const allConversations: Conversation[] = [];
    for (const contract of contracts) {
      const contractConversations = await storage.getConversationsByContractId(contract.id);
      allConversations.push(...contractConversations);
    }
    
    // Remove duplicates based on conversation ID
    const uniqueConversations = [...new Map(allConversations.map(conv => [conv.id, conv])).values()];
    
    res.json({
      success: true,
      conversations: uniqueConversations,
      count: uniqueConversations.length
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving customer conversations: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        customerId: req.params.customerId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve customer conversations"
    });
  }
});

// ===== SUPPORT TICKET ROUTES =====

// Get support tickets with optional filtering
router.get("/tickets", async (req: Request, res: Response) => {
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
    
    let tickets = await storage.getAllSupportTickets({ limit: parsedLimit, offset: parsedOffset });
    
    // Apply filters if provided
    if (parsedMerchantId) {
      tickets = tickets.filter(ticket => ticket.merchantId === parsedMerchantId);
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
      tickets,
      meta: {
        count: tickets.length,
        limit: parsedLimit,
        offset: parsedOffset
      }
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

// Get support ticket by ID
router.get("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID format"
      });
    }
    
    const ticket = await storage.getSupportTicket(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found"
      });
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

// Create a new support ticket (general API endpoint)
router.post("/tickets", async (req: Request, res: Response) => {
  try {
    // Generate ticket number (format: TICKET-XXXXX)
    const ticketNumber = `TICKET-${crypto.randomInt(10000, 99999)}`;
    
    // Create a new object without Zod validation first
    const rawTicketData = {
      ...req.body,
      ticketNumber
    };
    
    // Create a custom validation schema that overrides the priority field
    const customTicketSchema = insertSupportTicketSchema.extend({
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal")
    });
    
    // Now parse with the updated Zod schema
    const ticketData = customTicketSchema.parse(rawTicketData);
    
    // Validate that the merchant exists
    const merchant = await storage.getMerchant(ticketData.merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Referenced merchant not found"
      });
    }
    
    // Validate that the creator exists
    const creator = await storage.getUser(ticketData.createdBy);
    if (!creator) {
      return res.status(404).json({
        success: false,
        message: "Creator user not found"
      });
    }
    
    const newTicket = await storage.createSupportTicket(ticketData);
    
    // Log the ticket creation in the activity log
    await storage.createTicketActivityLog({
      ticketId: newTicket.id,
      actionType: "created",
      userId: ticketData.createdBy,
      actionDetails: "Ticket created"
    });
    
    logger.info({
      message: `Created new support ticket: ${newTicket.subject}`,
      category: "api",
      source: "internal",
      userId: ticketData.createdBy,
      metadata: {
        ticketId: newTicket.id,
        merchantId: ticketData.merchantId,
        category: ticketData.category,
        priority: ticketData.priority
      }
    });
    
    res.status(201).json({
      success: true,
      ticket: newTicket
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: fromZodError(error).toString()
      });
    }
    
    logger.error({
      message: `Error creating support ticket: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        requestBody: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to create support ticket"
    });
  }
});

// Merchant Support Ticket Submission Portal API endpoint
router.post("/merchant-support", async (req: Request, res: Response) => {
  try {
    // Generate ticket number (format: TICKET-XXXXX)
    const ticketNumber = `TICKET-${crypto.randomInt(10000, 99999)}`;
    
    // Extract merchant information from request
    const { 
      merchantId, 
      createdBy, 
      category, 
      subcategory, 
      subject, 
      description, 
      priority = "normal",
      contactInfo = {} 
    } = req.body;
    
    // Create the ticket data object
    const rawTicketData = {
      ticketNumber,
      merchantId,
      createdBy,
      category,
      subcategory,
      subject,
      description,
      priority,
      status: "new",
      metadata: JSON.stringify({
        contactInfo,
        submittedVia: "merchant-portal"
      })
    };
    
    // Create a custom validation schema for merchant portal submissions
    const merchantPortalTicketSchema = insertSupportTicketSchema.extend({
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      subcategory: z.string().optional(),
      metadata: z.string().optional()
    });
    
    // Validate the data
    const ticketData = merchantPortalTicketSchema.parse(rawTicketData);
    
    // Validate that the merchant exists
    const merchant = await storage.getMerchant(ticketData.merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Referenced merchant not found"
      });
    }
    
    // Validate that the creator exists
    const creator = await storage.getUser(ticketData.createdBy);
    if (!creator) {
      return res.status(404).json({
        success: false,
        message: "Creator user not found"
      });
    }
    
    // Create the support ticket
    const newTicket = await storage.createSupportTicket(ticketData);
    
    // Log the ticket creation in the activity log
    await storage.createTicketActivityLog({
      ticketId: newTicket.id,
      actionType: "created",
      userId: ticketData.createdBy,
      actionDetails: `Support ticket created via Merchant Portal with status "new"`
    });
    
    // Send a notification to the merchant about their ticket submission
    await notificationService.sendNotification("merchant_ticket_created" as NotificationType, {
      recipientId: merchant.userId,
      recipientType: "merchant",
      channels: ["email", "in_app"],
      subject: `Support Ticket #${newTicket.ticketNumber} Received`,
      message: `We've received your support request regarding "${newTicket.subject}". Our team will respond to you within 1 business day.`,
      data: {
        ticketNumber: newTicket.ticketNumber,
        category: newTicket.category,
        priority: newTicket.priority,
        subject: newTicket.subject
      }
    });
    
    // Notify admins about new ticket
    // Query for admin users (users with role = 'admin')
    const adminUsers = await storage.getAllUsers();
    // Filter for admin users
    const admins = adminUsers.filter(user => user.role === 'admin');
    
    if (admins && admins.length > 0) {
      // Notify the first admin (we could implement a rotation or assignment system later)
      const admin = admins[0];
      await notificationService.sendNotification("admin_new_ticket" as NotificationType, {
        recipientId: admin.id,
        recipientType: "admin",
        channels: ["email", "in_app"],
        subject: `New Support Ticket #${newTicket.ticketNumber}`,
        message: `A new support ticket has been submitted by ${merchant.name}: "${newTicket.subject}"`,
        data: {
          ticketId: newTicket.id,
          ticketNumber: newTicket.ticketNumber,
          merchantId: merchant.id,
          merchantName: merchant.name,
          category: newTicket.category,
          priority: newTicket.priority
        }
      });
    }
    
    logger.info({
      message: `Created new merchant support ticket: ${newTicket.subject}`,
      category: "api",
      source: "internal",
      userId: ticketData.createdBy,
      metadata: {
        ticketId: newTicket.id,
        merchantId: ticketData.merchantId,
        category: ticketData.category,
        subcategory: ticketData.subcategory,
        priority: ticketData.priority,
        submittedVia: "merchant-portal"
      }
    });
    
    res.status(201).json({
      success: true,
      ticket: newTicket,
      message: `Support ticket #${newTicket.ticketNumber} created successfully. You will receive a confirmation email shortly.`
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: fromZodError(error).toString()
      });
    }
    
    logger.error({
      message: `Error creating merchant support ticket: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        requestBody: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to create support ticket. Please try again later."
    });
  }
});

// Update support ticket status, priority, or assignment
router.patch("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID format"
      });
    }
    
    const { status, priority, assignedTo, notes } = req.body;
    const updateData: Partial<SupportTicket> = {};
    
    // Only include valid fields in the update
    if (status) {
      if (!["new", "in_progress", "pending_merchant", "pending_customer", "resolved", "closed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value"
        });
      }
      updateData.status = status;
    }
    
    if (priority) {
      if (!["low", "normal", "high", "urgent"].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Invalid priority value"
        });
      }
      updateData.priority = priority;
    }
    
    if (assignedTo !== undefined) {
      // If assignedTo is null, it's valid (unassigning)
      if (assignedTo !== null) {
        const assignedUser = await storage.getUser(assignedTo);
        if (!assignedUser) {
          return res.status(404).json({
            success: false,
            message: "Assigned user not found"
          });
        }
      }
      updateData.assignedTo = assignedTo;
    }
    
    if (notes) {
      updateData.notes = notes;
    }
    
    // If no valid updates provided
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update"
      });
    }
    
    // Update the ticket
    const ticket = await storage.getSupportTicket(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found"
      });
    }
    
    // Add updates timestamp
    updateData.updatedAt = new Date();
    
    const updatedTicket = await storage.updateSupportTicket(id, updateData);
    
    // Log the ticket update in the activity log
    const activityDetails = Object.keys(updateData)
      .filter(key => key !== 'updatedAt')
      .map(key => {
        const oldValue = ticket[key as keyof SupportTicket];
        const newValue = updateData[key as keyof SupportTicket];
        return `${key}: ${oldValue} → ${newValue}`;
      })
      .join(", ");
    
    if (activityDetails) {
      await storage.createTicketActivityLog({
        ticketId: id,
        actionType: "updated",
        userId: req.body.updatedBy || null, // We expect the client to provide who updated it
        actionDetails: activityDetails
      });
    }
    
    logger.info({
      message: `Updated support ticket: ${ticket.subject}`,
      category: "api",
      source: "internal",
      userId: req.body.updatedBy,
      metadata: {
        ticketId: id,
        updates: updateData
      }
    });
    
    res.json({
      success: true,
      ticket: updatedTicket
    });
  } catch (error) {
    logger.error({
      message: `Error updating support ticket: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        ticketId: req.params.id,
        requestBody: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to update support ticket"
    });
  }
});

// Add attachment to support ticket
router.post("/tickets/:id/attachments", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID format"
      });
    }
    
    // Verify ticket exists
    const ticket = await storage.getSupportTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found"
      });
    }
    
    // Parse and validate attachment data
    const attachmentData: InsertTicketAttachment = {
      ...insertTicketAttachmentSchema.parse(req.body),
      ticketId
    };
    
    // Verify uploader exists
    const uploader = await storage.getUser(attachmentData.uploadedBy);
    if (!uploader) {
      return res.status(404).json({
        success: false,
        message: "Uploader user not found"
      });
    }
    
    const newAttachment = await storage.createTicketAttachment(attachmentData);
    
    // Log the attachment upload in the activity log
    await storage.createTicketActivityLog({
      ticketId,
      actionType: "attachment_added",
      userId: attachmentData.uploadedBy,
      actionDetails: `File uploaded: ${attachmentData.fileName} (${attachmentData.fileType}, ${attachmentData.fileSize} bytes)`
    });
    
    logger.info({
      message: `New attachment added to ticket: ${ticket.subject}`,
      category: "api",
      source: "internal",
      userId: attachmentData.uploadedBy,
      metadata: {
        ticketId,
        attachmentId: newAttachment.id,
        fileName: attachmentData.fileName,
        fileType: attachmentData.fileType
      }
    });
    
    res.status(201).json({
      success: true,
      attachment: newAttachment
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: fromZodError(error).toString()
      });
    }
    
    logger.error({
      message: `Error adding attachment to ticket: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        ticketId: req.params.id,
        requestBody: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to add attachment to ticket"
    });
  }
});

// Get activity log for a ticket
router.get("/tickets/:id/activity", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID format"
      });
    }
    
    // Verify ticket exists
    const ticket = await storage.getSupportTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found"
      });
    }
    
    const activityLog = await storage.getTicketActivityLogsByTicketId(ticketId);
    
    res.json({
      success: true,
      ticketId,
      activityLog
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving ticket activity log: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        ticketId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve ticket activity log"
    });
  }
});

// Get all support tickets (with optional filtering)
router.get("/tickets", async (req: Request, res: Response) => {
  try {
    const { merchantId, status, priority, category, assignedTo, limit, offset } = req.query;
    
    // Validate query parameters
    const parsedMerchantId = merchantId ? parseInt(merchantId as string) : undefined;
    const parsedAssignedTo = assignedTo ? parseInt(assignedTo as string) : undefined;
    const parsedLimit = limit ? parseInt(limit as string) : 20;
    const parsedOffset = offset ? parseInt(offset as string) : 0;
    
    if (
      (merchantId && isNaN(parsedMerchantId!)) || 
      (assignedTo && isNaN(parsedAssignedTo!)) ||
      isNaN(parsedLimit) || 
      isNaN(parsedOffset)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters"
      });
    }
    
    let tickets = await storage.getAllSupportTickets(parsedLimit, parsedOffset);
    
    // Apply filters if specified
    if (parsedMerchantId) {
      tickets = tickets.filter(ticket => ticket.merchantId === parsedMerchantId);
    }
    
    if (status) {
      tickets = tickets.filter(ticket => ticket.status === status);
    }
    
    if (category) {
      tickets = tickets.filter(ticket => ticket.category === category);
    }
    
    if (parsedAssignedTo) {
      tickets = tickets.filter(ticket => ticket.assignedTo === parsedAssignedTo);
    }
    
    if (priority) {
      tickets = tickets.filter(ticket => ticket.priority === priority);
    }
    
    logger.info({
      message: `Retrieved ${tickets.length} support tickets`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: parsedMerchantId,
        status,
        category,
        priority,
        assignedTo: parsedAssignedTo,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
    
    res.json({
      success: true,
      tickets,
      meta: {
        count: tickets.length,
        limit: parsedLimit,
        offset: parsedOffset
      }
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

// Get tickets for a merchant - Note: this route must be before the "/tickets/:id" route to avoid conflicts
router.get("/merchant/:merchantId/tickets", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID format"
      });
    }
    
    // Check if merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    const tickets = await storage.getSupportTicketsByMerchantId(merchantId);
    
    res.json({
      success: true,
      tickets,
      count: tickets.length
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving merchant tickets: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: req.params.merchantId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve merchant tickets"
    });
  }
});

export default router;