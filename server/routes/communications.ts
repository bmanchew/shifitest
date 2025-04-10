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
import { NotificationType, NotificationChannel } from "../services/notification";
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
    
    // Map database field 'topic' to expected client field 'subject' for backward compatibility
    const mappedConversations = conversations.map(convo => ({
      ...convo,
      subject: convo.topic // Add subject field that client code expects
    }));
    
    res.json({
      success: true,
      conversations: mappedConversations,
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
    
    // Map topic to subject for client compatibility
    const mappedConversation = {
      ...conversation,
      subject: conversation.topic // Add subject field that client code expects
    };
    
    res.json({
      success: true,
      conversation: mappedConversation
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
    console.log("Creating conversation with data:", req.body);
    
    // Log request headers for debugging CSRF issues
    console.log("Request headers:", {
      csrfToken: req.headers['x-csrf-token'] ? 'Present' : 'Missing',
      contentType: req.headers['content-type'],
      cookies: req.headers.cookie ? 'Present' : 'Missing'
    });
    
    // Define an extended schema that includes the initial message
    // Allow either 'topic' or 'subject' for better client compatibility
    const extendedSchema = z.object({
      merchantId: z.number({
        required_error: "Merchant ID is required",
        invalid_type_error: "Merchant ID must be a number"
      }),
      contractId: z.number().optional().nullable(),
      // Support both 'topic' and 'subject' field names
      subject: z.string().min(1, "Subject cannot be empty").optional(),
      topic: z.string().min(1, "Topic cannot be empty").optional(),
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
    let validatedData;
    try {
      validatedData = extendedSchema.parse(req.body);
      console.log("Validated data:", validatedData);
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        const formattedError = fromZodError(validationError);
        console.error("Validation error:", formattedError.toString());
        
        // Log validation error details
        const errorDetails = validationError.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        console.error("Validation error details:", errorDetails);
        
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: formattedError.toString(),
          details: errorDetails
        });
      }
      throw validationError; // Re-throw if not a Zod error
    }
    
    // Extract message content from validated data
    const { message, ...conversationData } = validatedData;
    
    // If createdBy is not provided, use the authenticated user's ID if available
    if (!conversationData.createdBy && req.user) {
      console.log("Using authenticated user ID:", req.user.id);
      conversationData.createdBy = req.user.id;
    }
    
    // Ensure createdBy exists at this point
    if (!conversationData.createdBy) {
      console.error("No createdBy ID found in request or user session");
      return res.status(400).json({
        success: false,
        message: "Creator ID (createdBy) is required",
        details: {
          requestBody: req.body,
          userPresent: !!req.user,
          userId: req.user?.id
        }
      });
    }
    
    // Validate that the merchant exists
    console.log("Looking up merchant:", conversationData.merchantId);
    const merchant = await storage.getMerchant(conversationData.merchantId);
    if (!merchant) {
      console.error("Merchant not found:", conversationData.merchantId);
      return res.status(404).json({
        success: false,
        message: "Referenced merchant not found",
        details: { merchantId: conversationData.merchantId }
      });
    }
    console.log("Found merchant:", merchant.businessName);
    
    // Validate that the contract exists if specified
    if (conversationData.contractId) {
      console.log("Looking up contract:", conversationData.contractId);
      const contract = await storage.getContract(conversationData.contractId);
      if (!contract) {
        console.error("Contract not found:", conversationData.contractId);
        return res.status(404).json({
          success: false,
          message: "Referenced contract not found",
          details: { contractId: conversationData.contractId }
        });
      }
      console.log("Found contract:", contract.contractNumber);
    }
    
    // Validate that the creator exists
    console.log("Looking up creator user:", conversationData.createdBy);
    const creator = await storage.getUser(conversationData.createdBy);
    if (!creator) {
      console.error("Creator user not found:", conversationData.createdBy);
      return res.status(404).json({
        success: false,
        message: "Creator user not found",
        details: { createdBy: conversationData.createdBy }
      });
    }
    console.log("Found creator:", creator.email);
    
    // Create the conversation with the correct field mapping
    // Allow either subject or topic field to support different clients
    console.log("Creating conversation with flexible field mapping for subject/topic");
    
    // Our storage method now handles both 'subject' and 'topic' fields, so we can pass the data directly
    // The storage method will normalize the fields internally
    
    // Check that at least one of subject or topic exists for backwards compatibility
    if (!conversationData.subject && !conversationData.topic) {
      console.error("Neither subject nor topic field was provided");
      return res.status(400).json({
        success: false,
        message: "Either subject or topic field is required",
        details: { providedFields: Object.keys(conversationData) }
      });
    }
    
    // We'll pass the full data to our storage method, which will handle normalization
    const conversationDbData = {
      // Preserve the original subject field for client-side compatibility
      subject: conversationData.subject,
      // Pass either the topic field if it exists, or the subject field mapped to topic
      topic: conversationData.topic || conversationData.subject,
      merchantId: conversationData.merchantId,
      contractId: conversationData.contractId,
      status: conversationData.status || 'active',
      createdBy: conversationData.createdBy,
      priority: conversationData.priority || 'normal',
      category: conversationData.category || 'general',
      // Keep metadata for other supplementary info
      metadata: JSON.stringify({
        originalFormat: conversationData.subject ? 'subject' : 'topic',
        created: new Date().toISOString()
      })
    };
    
    console.log("Conversation data being sent to storage:", conversationDbData);
    
    // Create the conversation in the database
    let newConversation;
    try {
      newConversation = await storage.createConversation(conversationDbData);
      console.log("New conversation created:", newConversation);
    } catch (dbError) {
      console.error("Database error creating conversation:", dbError);
      return res.status(500).json({
        success: false,
        message: "Database error when creating conversation",
        details: dbError instanceof Error ? dbError.message : String(dbError),
        code: "DB_CREATE_ERROR"
      });
    }
    
    if (!newConversation || !newConversation.id) {
      console.error("Invalid conversation created:", newConversation);
      return res.status(500).json({
        success: false,
        message: "Created conversation is invalid or missing ID",
        code: "INVALID_CONVERSATION"
      });
    }
    
    // Create the initial message with fields we know are in the schema
    console.log("Creating initial message for new conversation");
    const messageData = {
      conversationId: newConversation.id,
      senderId: conversationData.createdBy,
      content: message,
      // Include additional metadata if needed
      metadata: JSON.stringify({
        isFromMerchant: creator.role === 'merchant',
        senderRole: creator.role
      })
    };
    
    console.log("Creating initial message:", messageData);
    
    let newMessage;
    try {
      newMessage = await storage.createMessage(messageData);
      console.log("New message created:", newMessage);
    } catch (messageError) {
      console.error("Error creating initial message:", messageError);
      
      // Even if the message creation fails, the conversation was created
      logger.warn({
        message: `Created conversation but failed to create initial message: ${conversationData.topic}`,
        category: "api",
        source: "internal",
        userId: conversationData.createdBy,
        metadata: {
          conversationId: newConversation.id,
          error: messageError instanceof Error ? messageError.message : String(messageError)
        }
      });
      
      // Return a partial success
      return res.status(201).json({
        success: true,
        id: newConversation.id,
        conversationId: newConversation.id,
        conversation: newConversation,
        warning: "Conversation created but initial message failed" 
      });
    }
    
    // Use subjectContent here to be consistent
    logger.info({
      message: `Created new conversation with initial message: ${subjectContent}`,
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
    
    // Return the ID directly in the root of the response for client redirection
    // Include multiple formats to ensure compatibility with all clients
    const response = {
      success: true,
      id: newConversation.id, // This is what the client expects for redirection
      conversationId: newConversation.id, // Alternative field name
      conversation: newConversation, // Full conversation object for reference
      message: newMessage // Include the created message
    };
    
    console.log("Sending successful response:", 
      { id: response.id, conversationId: response.conversationId, success: response.success });
    
    res.status(201).json(response);
  } catch (error) {
    console.error("Unexpected conversation creation error:", error);
    
    logger.error({
      message: `Error creating conversation: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        requestBody: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    // Provide detailed error info to help debugging
    res.status(500).json({
      success: false,
      message: "Failed to create conversation due to an unexpected error",
      error: error instanceof Error ? error.message : String(error),
      code: "UNEXPECTED_ERROR",
      timestamp: new Date().toISOString()
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
    
    // Map topic to subject for client compatibility
    const mappedConversation = {
      ...updatedConversation,
      subject: updatedConversation.topic // Add subject field that client code expects
    };
    
    res.json({
      success: true,
      conversation: mappedConversation
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
    console.log("Creating message in conversation. Request:", {
      conversationId: req.params.id,
      body: req.body,
      user: req.user?.id,
      method: req.method,
      path: req.path,
      headers: {
        csrfToken: req.headers['x-csrf-token'] ? 'Present' : 'Missing',
        contentType: req.headers['content-type'],
        cookies: req.headers.cookie ? 'Present' : 'Missing'
      }
    });
    
    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      console.error(`Invalid conversation ID format: ${req.params.id}`);
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID format",
        details: { providedId: req.params.id }
      });
    }
    
    // Verify conversation exists
    console.log("Looking up conversation:", conversationId);
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      console.error(`Conversation not found: ${conversationId}`);
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
        details: { conversationId }
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
    
    // Map database field 'topic' to expected client field 'subject' for backward compatibility
    const mappedConversations = conversations.map(convo => ({
      ...convo,
      subject: convo.topic, // Add subject field that client code expects
      unreadMessages: convo.unreadMessages || 0,
    }));
    
    res.json({
      success: true,
      conversations: mappedConversations,
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

// Get conversations for the currently authenticated merchant
router.get("/merchant", authenticateToken, async (req: Request, res: Response) => {
  try {
    // Get the current authenticated user from request
    const user = (req as any).user;
    
    if (!user || user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only merchant users can access their conversations."
      });
    }
    
    // Find the merchant associated with this user
    const merchant = await storage.getMerchantByUserId(user.id);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found for this user."
      });
    }
    
    // Get all conversations for this merchant
    const conversations = await storage.getConversationsForMerchant(merchant.id);
    
    // Map database field 'topic' to expected client field 'subject' for backward compatibility
    const mappedConversations = conversations.map(convo => {
      // Determine if this object has a topic field (from database) or subject field
      const subject = convo.topic || convo.subject || "";
      
      return {
        ...convo,
        // Make sure it has the subject field regardless of whether database uses 'topic'
        subject: subject, 
        // Get unread count only if it exists
        unreadMessages: convo.unreadMessages || 0,
      };
    });
    
    logger.info({
      message: `Retrieved ${conversations.length} conversations for merchant ${merchant.id}`,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: merchant.id,
        userId: user.id,
      }
    });
    
    return res.json({
      success: true,
      conversations: mappedConversations,
    });
    
  } catch (error) {
    logger.error({
      message: `Error getting merchant conversations: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal", 
      metadata: {
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.stack : null,
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve conversations.",
      error: error instanceof Error ? error.message : "Unknown error"
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
    
    // Map database field 'topic' to expected client field 'subject' for backward compatibility
    const mappedConversations = uniqueConversations.map(convo => ({
      ...convo,
      subject: convo.topic // Add subject field that client code expects
    }));
    
    res.json({
      success: true,
      conversations: mappedConversations,
      count: mappedConversations.length
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
    
    // Create a custom validation schema that overrides the priority field and allows contractId
    const customTicketSchema = insertSupportTicketSchema.extend({
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      contractId: z.number().nullable().optional()
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
    
    // If contractId is provided, verify that the contract exists and belongs to the merchant
    if (ticketData.contractId) {
      const contract = await storage.getContract(ticketData.contractId);
      if (!contract) {
        return res.status(404).json({
          success: false,
          message: "Referenced contract not found"
        });
      }
      
      // Verify the contract belongs to this merchant
      if (contract.merchantId !== ticketData.merchantId) {
        logger.warn({
          message: `Contract ownership mismatch in ticket creation`,
          category: "security",
          source: "internal",
          userId: ticketData.createdBy,
          metadata: {
            contractId: ticketData.contractId,
            contractMerchantId: contract.merchantId,
            requestMerchantId: ticketData.merchantId
          }
        });
        
        return res.status(403).json({
          success: false,
          message: "The specified contract does not belong to this merchant"
        });
      }
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
        contractId: ticketData.contractId,
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
      contactInfo = {},
      contractId = null
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
      contractId: contractId ? Number(contractId) : null,
      metadata: JSON.stringify({
        contactInfo,
        submittedVia: "merchant-portal"
      })
    };
    
    // Create a custom validation schema for merchant portal submissions
    const merchantPortalTicketSchema = insertSupportTicketSchema.extend({
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      subcategory: z.string().optional(),
      metadata: z.string().optional(),
      contractId: z.number().nullable().optional()
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
    
    // If contractId is provided, verify that the contract exists and belongs to the merchant
    if (ticketData.contractId) {
      const contract = await storage.getContract(ticketData.contractId);
      if (!contract) {
        return res.status(404).json({
          success: false,
          message: "Referenced contract not found"
        });
      }
      
      // Verify the contract belongs to this merchant
      if (contract.merchantId !== ticketData.merchantId) {
        logger.warn({
          message: `Contract ownership mismatch in merchant ticket creation`,
          category: "security",
          source: "internal",
          userId: ticketData.createdBy,
          metadata: {
            contractId: ticketData.contractId,
            contractMerchantId: contract.merchantId,
            requestMerchantId: ticketData.merchantId
          }
        });
        
        return res.status(403).json({
          success: false,
          message: "The specified contract does not belong to this merchant"
        });
      }
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
          priority: newTicket.priority,
          contractId: newTicket.contractId
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
        contractId: ticketData.contractId,
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
      if (!["new", "in_progress", "pending_merchant", "pending_customer", "resolved", "closed", "under_review", "escalated"].includes(status)) {
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
    
    // Send SMS notifications for escalated tickets
    if (updateData.status === 'escalated' && ticket.status !== 'escalated') {
      try {
        // Get merchant information
        const merchant = await storage.getMerchant(ticket.merchantId);
        if (merchant) {
          // Get merchant user to send SMS
          const merchantUser = await storage.getUserByMerchantId(ticket.merchantId);
          if (merchantUser && merchantUser.phone) {
            // Send SMS to merchant
            await notificationService.sendNotification({
              userId: merchantUser.id,
              title: "Ticket Escalated",
              message: `Your support ticket #${ticket.ticketNumber} has been escalated and will receive priority attention.`,
              type: NotificationType.SYSTEM_ALERT,
              channels: [NotificationChannel.SMS],
            });
            
            logger.info({
              message: `Sent escalation SMS notification to merchant ${merchantUser.id}`,
              category: "notification", 
              source: "twilio",
              userId: merchantUser.id,
              metadata: {
                ticketId: id,
                ticketNumber: ticket.ticketNumber
              }
            });
          }
        }
        
        // Send SMS to assigned support rep if there is one
        if (ticket.assignedTo) {
          const supportRep = await storage.getUser(ticket.assignedTo);
          if (supportRep && supportRep.phone) {
            await notificationService.sendNotification({
              userId: supportRep.id,
              title: "Ticket Escalated",
              message: `Support ticket #${ticket.ticketNumber} has been escalated and requires immediate attention.`,
              type: NotificationType.SYSTEM_ALERT,
              channels: [NotificationChannel.SMS],
            });
            
            logger.info({
              message: `Sent escalation SMS notification to support rep ${supportRep.id}`,
              category: "notification",
              source: "twilio",
              userId: supportRep.id,
              metadata: {
                ticketId: id,
                ticketNumber: ticket.ticketNumber
              }
            });
          }
        }
      } catch (error) {
        // Log the notification error but don't fail the ticket update
        logger.error({
          message: `Error sending escalation notifications: ${error instanceof Error ? error.message : String(error)}`,
          category: "notification",
          source: "twilio",
          metadata: {
            ticketId: id,
            error: error instanceof Error ? error.stack : String(error)
          }
        });
      }
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