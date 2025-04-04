import { Request, Response, Router } from "express";
import { storage } from "../../storage";
import { logger } from "../../services/logger";
import { z } from "zod";
import { sortByDateDesc } from "../../utils/dateHelpers";
import { executeDbOperation } from "../../utils/asyncDb";

const router = Router();

// Get all conversations for the logged-in merchant
router.get("/", async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only merchant users can access their conversations."
      });
    }

    // Get the merchant ID for the logged-in user
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found for this user."
      });
    }

    // Get all conversations for this merchant
    const conversations = await storage.getConversationsForMerchant(merchant.id);
    
    // Get unread message count
    const unreadCount = await storage.getUnreadMessageCountForMerchant(merchant.id);
    
    logger.info({
      message: `Retrieved ${conversations.length} conversations for merchant ${merchant.id}`,
      category: "api",
      source: "communication",
      metadata: {
        merchantId: merchant.id,
        userId: req.user.id,
        unreadCount
      }
    });

    // Create mapped conversations with subject field for backward compatibility
    const mappedConversations = conversations.map(c => ({
      ...c,
      // Map topic to subject for client compatibility
      subject: c.topic,
      // Add unread messages count (for now, we'll just use the total unread count for all)
      unreadMessages: unreadCount
    }));

    return res.json({
      success: true,
      conversations: mappedConversations,
    });
    
  } catch (error) {
    logger.error({
      message: `Error getting merchant conversations: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "communication", 
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : null,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve conversations.",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Create a new conversation as a merchant
router.post("/", async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only merchant users can create conversations."
      });
    }

    // Validate request body
    const schema = z.object({
      topic: z.string().min(1),
      message: z.string().min(1),
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    });

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.errors,
      });
    }

    const { topic, message, priority } = validationResult.data;

    // Get the merchant ID for the logged-in user
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found for this user."
      });
    }

    // Create metadata that includes other fields that aren't in the DB schema
    const metadata = JSON.stringify({ 
      priority,
      category: "general" // Default category
    });

    // First, create the conversation with the correct field names
    const conversation = await storage.createConversation({
      merchantId: merchant.id,
      topic: topic, // Use 'topic' field directly as per schema
      subject: topic, // For backwards compatibility with routes expecting 'subject'
      status: "active",
      category: "general", // Default category for merchant-initiated conversations
      priority: priority, // Set priority directly
      createdBy: req.user.id, // Set the creator
      metadata: metadata, // Store additional metadata
    });

    // Then, create the initial message
    await storage.createMessage({
      conversationId: conversation.id,
      userId: req.user.id,
      content: message,
      isFromMerchant: true,
      createdAt: new Date(),
      isRead: false,
    });

    logger.info({
      message: `Merchant created new conversation: ${topic}`,
      category: "communication",
      source: "merchant",
      metadata: {
        merchantId: merchant.id,
        userId: req.user.id,
        conversationId: conversation.id,
        priority,
      }
    });

    return res.status(201).json({
      success: true,
      id: conversation.id,
      message: "Conversation created successfully."
    });
    
  } catch (error) {
    logger.error({
      message: `Error creating conversation: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "communication", 
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : null,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Failed to create conversation.",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get a specific conversation
router.get("/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only merchant users can access their conversations."
      });
    }

    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID."
      });
    }

    // Get the merchant ID for the logged-in user
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found for this user."
      });
    }

    // Get the conversation
    const conversation = await storage.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found."
      });
    }

    // Verify that this conversation belongs to the merchant
    if (conversation.merchantId !== merchant.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. This conversation doesn't belong to your account."
      });
    }

    logger.info({
      message: `Merchant accessed conversation ${conversationId}`,
      category: "api",
      source: "communication",
      metadata: {
        merchantId: merchant.id,
        userId: req.user.id,
        conversationId,
      }
    });

    return res.json({
      success: true,
      conversation,
    });
    
  } catch (error) {
    logger.error({
      message: `Error getting conversation: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "communication", 
      metadata: {
        userId: req.user?.id,
        conversationId: req.params.id,
        error: error instanceof Error ? error.stack : null,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve conversation.",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get messages for a conversation
router.get("/:id/messages", async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only merchant users can access their conversation messages."
      });
    }

    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID."
      });
    }

    // Get the merchant ID for the logged-in user
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found for this user."
      });
    }

    // Get the conversation
    const conversation = await storage.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found."
      });
    }

    // Verify that this conversation belongs to the merchant
    if (conversation.merchantId !== merchant.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. This conversation doesn't belong to your account."
      });
    }

    // Get messages for this conversation
    const messages = await storage.getMessagesByConversationId(conversationId);
    
    // Sort messages by creation date (oldest first)
    messages.sort((a, b) => 
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

    return res.json({
      success: true,
      messages: messages.map(message => ({
        ...message,
        // Determine if the message is from the merchant
        isFromMerchant: message.isFromMerchant || false,
      })),
    });
    
  } catch (error) {
    logger.error({
      message: `Error getting conversation messages: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "communication", 
      metadata: {
        userId: req.user?.id,
        conversationId: req.params.id,
        error: error instanceof Error ? error.stack : null,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve conversation messages.",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Create a new message in a conversation
router.post("/:id/messages", async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only merchant users can send messages in their conversations."
      });
    }

    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID."
      });
    }

    // Validate request body
    const schema = z.object({
      content: z.string().min(1),
    });

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.errors,
      });
    }

    const { content } = validationResult.data;

    // Get the merchant ID for the logged-in user
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found for this user."
      });
    }

    // Get the conversation
    const conversation = await storage.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found."
      });
    }

    // Verify that this conversation belongs to the merchant
    if (conversation.merchantId !== merchant.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. This conversation doesn't belong to your account."
      });
    }

    // Check if the conversation is active
    if (conversation.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Cannot send messages in a conversation that is not active."
      });
    }

    // Create the message
    const message = await storage.createMessage({
      conversationId,
      userId: req.user.id,
      content,
      isFromMerchant: true,
      createdAt: new Date(),
      isRead: false,
    });

    // Update the conversation's last message timestamp
    await storage.updateConversation(conversationId, {
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info({
      message: `Merchant sent message in conversation ${conversationId}`,
      category: "communication",
      source: "merchant",
      metadata: {
        merchantId: merchant.id,
        userId: req.user.id,
        conversationId,
        messageId: message.id,
      }
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully."
    });
    
  } catch (error) {
    logger.error({
      message: `Error sending message: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "communication", 
      metadata: {
        userId: req.user?.id,
        conversationId: req.params.id,
        error: error instanceof Error ? error.stack : null,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Failed to send message.",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get unread messages count for the merchant
router.get("/unread-count", async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only merchant users can access their messages count."
      });
    }

    // Get the merchant ID for the logged-in user
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found for this user."
      });
    }

    // Get all conversations for this merchant
    const conversations = await storage.getConversationsForMerchant(merchant.id);
    
    let unreadCount = 0;

    // Instead of looping through each conversation, use the optimized 
    // method in storage that handles the database join properly
    unreadCount = await storage.getUnreadMessageCountForMerchant(merchant.id);

    return res.json({
      success: true,
      unreadCount: unreadCount,
      count: unreadCount, // Keep count for backward compatibility
    });
    
  } catch (error) {
    logger.error({
      message: `Error getting unread messages count: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "communication", 
      metadata: {
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : null,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Failed to get unread messages count.",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Mark individual message as read
router.post("/messages/:id/read", async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only merchant users can mark messages as read."
      });
    }

    const messageId = parseInt(req.params.id);
    if (isNaN(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID."
      });
    }

    // Get the merchant ID for the logged-in user
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found for this user."
      });
    }

    // Update the message as read
    const updatedMessage = await storage.markMessageAsRead(messageId);
    
    if (!updatedMessage) {
      return res.status(404).json({
        success: false,
        message: "Message not found or could not be updated."
      });
    }

    logger.info({
      message: `Merchant marked message ${messageId} as read`,
      category: "communication",
      source: "merchant",
      metadata: {
        merchantId: merchant.id,
        userId: req.user.id,
        messageId
      }
    });

    return res.json({
      success: true,
      message: "Message marked as read successfully."
    });
    
  } catch (error) {
    logger.error({
      message: `Error marking message as read: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "communication", 
      metadata: {
        userId: req.user?.id,
        messageId: req.params.id,
        error: error instanceof Error ? error.stack : null,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Failed to mark message as read.",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Mark all messages in a conversation as read
router.post("/:id/read", async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only merchant users can mark messages as read."
      });
    }

    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID."
      });
    }

    // Get the merchant ID for the logged-in user
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found for this user."
      });
    }

    // Get the conversation
    const conversation = await storage.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found."
      });
    }

    // Verify that this conversation belongs to the merchant
    if (conversation.merchantId !== merchant.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. This conversation doesn't belong to your account."
      });
    }

    // Mark all messages from admins as read (not from the merchant themselves)
    const updatedCount = await storage.markAllMessagesAsRead(conversationId, req.user.id);

    logger.info({
      message: `Merchant marked ${updatedCount} messages as read in conversation ${conversationId}`,
      category: "communication",
      source: "merchant",
      metadata: {
        merchantId: merchant.id,
        userId: req.user.id,
        conversationId,
        updatedCount,
      }
    });

    return res.json({
      success: true,
      updatedCount,
    });
    
  } catch (error) {
    logger.error({
      message: `Error marking messages as read: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "communication", 
      metadata: {
        userId: req.user?.id,
        conversationId: req.params.id,
        error: error instanceof Error ? error.stack : null,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Failed to mark messages as read.",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Update conversation status
router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only merchant users can update their conversation status."
      });
    }

    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID."
      });
    }

    // Validate request body
    const schema = z.object({
      status: z.enum(["active", "resolved", "archived"]),
    });

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
        errors: validationResult.error.errors,
      });
    }

    const { status } = validationResult.data;

    // Get the merchant ID for the logged-in user
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found for this user."
      });
    }

    // Get the conversation
    const conversation = await storage.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found."
      });
    }

    // Verify that this conversation belongs to the merchant
    if (conversation.merchantId !== merchant.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. This conversation doesn't belong to your account."
      });
    }

    // Update the conversation status
    await storage.updateConversationStatus(conversationId, status);

    // If reopening a conversation, update the timestamp
    if (status === "active") {
      await storage.updateConversation(conversationId, {
        updatedAt: new Date(),
      });
    }

    logger.info({
      message: `Merchant updated conversation ${conversationId} status to ${status}`,
      category: "communication",
      source: "merchant",
      metadata: {
        merchantId: merchant.id,
        userId: req.user.id,
        conversationId,
        oldStatus: conversation.status,
        newStatus: status,
      }
    });

    return res.json({
      success: true,
      message: `Conversation status updated to ${status}.`
    });
    
  } catch (error) {
    logger.error({
      message: `Error updating conversation status: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "communication", 
      metadata: {
        userId: req.user?.id,
        conversationId: req.params.id,
        error: error instanceof Error ? error.stack : null,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Failed to update conversation status.",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Mark a specific message as read
router.patch("/:conversationId/messages/:messageId/read", async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "merchant") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only merchant users can mark messages as read."
      });
    }

    const conversationId = parseInt(req.params.conversationId);
    const messageId = parseInt(req.params.messageId);
    
    if (isNaN(conversationId) || isNaN(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation or message ID."
      });
    }

    // Get the merchant ID for the logged-in user
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant profile not found for this user."
      });
    }

    // Get the conversation
    const conversation = await storage.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found."
      });
    }

    // Verify that this conversation belongs to the merchant
    if (conversation.merchantId !== merchant.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. This conversation doesn't belong to your account."
      });
    }

    // Get the message to verify it belongs to the specified conversation
    const messages = await storage.getMessagesByConversationId(conversationId);
    const messageToUpdate = messages.find(msg => msg.id === messageId);
    
    if (!messageToUpdate) {
      return res.status(404).json({
        success: false,
        message: "Message not found in this conversation."
      });
    }

    // Mark the message as read
    const updatedMessage = await storage.markMessageAsRead(messageId);

    logger.info({
      message: `Merchant marked message ${messageId} as read in conversation ${conversationId}`,
      category: "communication",
      source: "merchant",
      metadata: {
        merchantId: merchant.id,
        userId: req.user.id,
        conversationId,
        messageId
      }
    });

    return res.json({
      success: true,
      message: updatedMessage
    });
    
  } catch (error) {
    logger.error({
      message: `Error marking message as read: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "communication", 
      metadata: {
        userId: req.user?.id,
        conversationId: req.params.conversationId,
        messageId: req.params.messageId,
        error: error instanceof Error ? error.stack : null,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Failed to mark message as read.",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;