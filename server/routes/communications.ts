import express, { Request, Response, Router } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";
import { 
  insertConversationSchema, 
  insertMessageSchema,
  type InsertConversation, 
  type Conversation,
  type Message,
  type InsertMessage 
} from "@shared/schema";
import { storage } from "../storage";
import { logger } from "../services/logger";

const router = Router();

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
    const conversationData = insertConversationSchema.parse(req.body);
    
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
    
    const newConversation = await storage.createConversation(conversationData);
    
    logger.info({
      message: `Created new conversation: ${newConversation.topic}`,
      category: "api",
      source: "internal",
      userId: conversationData.createdBy,
      metadata: {
        conversationId: newConversation.id,
        contractId: conversationData.contractId,
        category: conversationData.category
      }
    });
    
    res.status(201).json({
      success: true,
      conversation: newConversation
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

export default router;