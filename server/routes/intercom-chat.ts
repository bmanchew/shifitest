import express, { Request, Response } from "express";
import { storage } from "../storage";
import { intercomService } from "../services/intercom";
import { logger } from "../logger";

const router = express.Router();

/**
 * Get all chat sessions for a merchant
 */
router.get("/sessions/merchant/:merchantId", async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    // Validate the merchantId
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID format"
      });
    }
    
    // Get all chat sessions for the merchant
    const sessions = await storage.getChatSessionsByMerchantId(merchantId);
    
    return res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error({
      message: `Error fetching chat sessions for merchant: ${error instanceof Error ? error.message : String(error)}`,
      category: "api", 
      source: "intercom",
      metadata: {
        merchantId: req.params.merchantId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve chat sessions"
    });
  }
});

/**
 * Get all chat sessions for an agent
 */
router.get("/sessions/agent/:agentId", async (req: Request, res: Response) => {
  try {
    const agentId = parseInt(req.params.agentId);
    
    // Validate the agentId
    if (isNaN(agentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent ID format"
      });
    }
    
    // Get all chat sessions for the agent
    const sessions = await storage.getChatSessionsByAgentId(agentId);
    
    return res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error({
      message: `Error fetching chat sessions for agent: ${error instanceof Error ? error.message : String(error)}`,
      category: "api", 
      source: "intercom",
      metadata: {
        agentId: req.params.agentId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve chat sessions"
    });
  }
});

/**
 * Get all chat sessions
 */
router.get("/sessions", async (req: Request, res: Response) => {
  try {
    // Get query parameters for pagination and filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Get all chat sessions with pagination
    const sessions = await storage.getAllChatSessions(offset, limit, status);
    
    // Get total count for pagination
    const totalCount = await storage.getChatSessionsCount(status);
    
    return res.json({
      success: true,
      data: sessions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    logger.error({
      message: `Error fetching all chat sessions: ${error instanceof Error ? error.message : String(error)}`,
      category: "api", 
      source: "intercom",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve chat sessions"
    });
  }
});

/**
 * Get a specific chat session by ID
 */
router.get("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    
    // Validate the sessionId
    if (isNaN(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID format"
      });
    }
    
    // Get the chat session
    const session = await storage.getChatSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }
    
    // Get messages for the session
    const messages = await storage.getChatMessagesByChatSessionId(session.id);
    
    return res.json({
      success: true,
      data: {
        session,
        messages
      }
    });
  } catch (error) {
    logger.error({
      message: `Error fetching chat session: ${error instanceof Error ? error.message : String(error)}`,
      category: "api", 
      source: "intercom",
      metadata: {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve chat session"
    });
  }
});

/**
 * Update a chat session (e.g., assign to agent, change status)
 */
router.patch("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { agentId, status } = req.body;
    
    // Validate the sessionId
    if (isNaN(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID format"
      });
    }
    
    // Get the chat session
    const session = await storage.getChatSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }
    
    // Update data
    const updates: Record<string, any> = {
      updatedAt: new Date()
    };
    
    if (agentId !== undefined) {
      updates.agentId = agentId;
      
      // If we're assigning to an agent, also update in Intercom
      if (agentId && session.externalId) {
        try {
          // Get the agent's Intercom admin ID
          const agent = await storage.getSupportAgent(agentId);
          if (agent && agent.externalId) {
            await intercomService.assignConversation(
              session.externalId,
              agent.externalId
            );
          }
        } catch (intercomError) {
          logger.warn({
            message: `Failed to assign conversation in Intercom: ${intercomError instanceof Error ? intercomError.message : String(intercomError)}`,
            category: "api",
            source: "intercom",
            metadata: {
              sessionId,
              agentId
            }
          });
          // Continue with the local update even if Intercom update fails
        }
      }
    }
    
    if (status !== undefined) {
      updates.status = status;
      
      // If we're closing the chat, also close it in Intercom
      if (status === 'closed' && session.externalId) {
        try {
          await intercomService.closeConversation(session.externalId);
        } catch (intercomError) {
          logger.warn({
            message: `Failed to close conversation in Intercom: ${intercomError instanceof Error ? intercomError.message : String(intercomError)}`,
            category: "api",
            source: "intercom",
            metadata: {
              sessionId,
              status
            }
          });
          // Continue with the local update even if Intercom update fails
        }
      }
    }
    
    // Update the chat session
    const updatedSession = await storage.updateChatSession(sessionId, updates);
    
    return res.json({
      success: true,
      data: updatedSession
    });
  } catch (error) {
    logger.error({
      message: `Error updating chat session: ${error instanceof Error ? error.message : String(error)}`,
      category: "api", 
      source: "intercom",
      metadata: {
        sessionId: req.params.sessionId,
        updates: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to update chat session"
    });
  }
});

/**
 * Send a new message to a chat session
 */
router.post("/sessions/:sessionId/messages", async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { content, senderId, senderRole } = req.body;
    
    // Validate the sessionId
    if (isNaN(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID format"
      });
    }
    
    // Validate required fields
    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Message content is required"
      });
    }
    
    if (!senderId) {
      return res.status(400).json({
        success: false,
        message: "Sender ID is required"
      });
    }
    
    if (!senderRole) {
      return res.status(400).json({
        success: false,
        message: "Sender role is required"
      });
    }
    
    // Get the chat session
    const session = await storage.getChatSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Chat session not found"
      });
    }
    
    // Create the message in our database
    const message = await storage.createChatMessage({
      chatSessionId: sessionId,
      content,
      senderId,
      senderRole,
      isRead: false
    });
    
    // Send the message to Intercom if the session has an external ID
    if (session.externalId) {
      try {
        const isAdmin = senderRole === 'admin';
        const authorId = isAdmin ? 
          (await storage.getSupportAgent(senderId))?.externalId : 
          session.merchantExternalId;
          
        if (authorId) {
          await intercomService.replyToConversation(
            session.externalId,
            content,
            authorId,
            isAdmin
          );
        }
      } catch (intercomError) {
        logger.warn({
          message: `Failed to send message to Intercom: ${intercomError instanceof Error ? intercomError.message : String(intercomError)}`,
          category: "api",
          source: "intercom",
          metadata: {
            sessionId,
            messageId: message.id
          }
        });
        // We've already created the message in our DB, so we'll return success
      }
    }
    
    // Update the session's updatedAt timestamp
    await storage.updateChatSession(sessionId, {
      updatedAt: new Date()
    });
    
    return res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    logger.error({
      message: `Error sending chat message: ${error instanceof Error ? error.message : String(error)}`,
      category: "api", 
      source: "intercom",
      metadata: {
        sessionId: req.params.sessionId,
        message: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to send chat message"
    });
  }
});

/**
 * Start a new chat session
 */
router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const { merchantId, initialMessage } = req.body;
    
    // Validate required fields
    if (!merchantId) {
      return res.status(400).json({
        success: false,
        message: "Merchant ID is required"
      });
    }
    
    // Get the merchant
    const merchant = await storage.getMerchant(merchantId);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    // Check if Intercom service is configured
    if (intercomService.isConfigured()) {
      try {
        // Create or update the merchant user in Intercom
        const intercomUser = await intercomService.createOrUpdateUser({
          email: merchant.email,
          name: merchant.name,
          userId: merchant.id.toString(),
          role: 'merchant',
          customAttributes: {
            merchantId: merchant.id,
            phone: merchant.phone || '',
            address: merchant.address || ''
          }
        });
        
        // Start a conversation in Intercom
        const conversation = initialMessage ?
          await intercomService.startConversation(intercomUser.id, initialMessage) :
          await intercomService.startConversation(intercomUser.id, 'New conversation started');
        
        // Create the chat session in our database
        const session = await storage.createChatSession({
          merchantId,
          status: 'open',
          externalId: conversation.id,
          merchantExternalId: intercomUser.id,
          // Assign to the first admin if available
          agentId: conversation.assignee?.id ? null : null, // Will be updated later when we know our internal agent ID
          externalAgentId: conversation.assignee?.id || null,
          metadata: JSON.stringify({
            source: 'intercom',
            intercomData: {
              conversationId: conversation.id,
              userId: intercomUser.id
            }
          })
        });
        
        // If there's an initial message, add it to our database
        if (initialMessage) {
          await storage.createChatMessage({
            chatSessionId: session.id,
            content: initialMessage,
            senderId: merchantId,
            senderRole: 'merchant',
            isRead: false
          });
        }
        
        return res.status(201).json({
          success: true,
          data: session
        });
      } catch (intercomError) {
        logger.error({
          message: `Error creating Intercom chat session: ${intercomError instanceof Error ? intercomError.message : String(intercomError)}`,
          category: "api", 
          source: "intercom",
          metadata: {
            merchantId,
            error: intercomError instanceof Error ? intercomError.stack : String(intercomError)
          }
        });
        
        // Create a local-only chat session as fallback
        const session = await storage.createChatSession({
          merchantId,
          status: 'open',
          metadata: JSON.stringify({
            source: 'local',
            failedIntercomIntegration: true,
            error: intercomError instanceof Error ? intercomError.message : String(intercomError)
          })
        });
        
        // Add the initial message
        if (initialMessage) {
          await storage.createChatMessage({
            chatSessionId: session.id,
            content: initialMessage,
            senderId: merchantId,
            senderRole: 'merchant',
            isRead: false
          });
        }
        
        return res.status(201).json({
          success: true,
          data: session,
          warning: "Created local session due to Intercom API error"
        });
      }
    } else {
      // Intercom is not configured, create a local-only chat session
      const session = await storage.createChatSession({
        merchantId,
        status: 'open',
        metadata: JSON.stringify({
          source: 'local',
          intercomNotConfigured: true
        })
      });
      
      // Add the initial message
      if (initialMessage) {
        await storage.createChatMessage({
          chatSessionId: session.id,
          content: initialMessage,
          senderId: merchantId,
          senderRole: 'merchant',
          isRead: false
        });
      }
      
      return res.status(201).json({
        success: true,
        data: session,
        warning: "Created local session (Intercom not configured)"
      });
    }
  } catch (error) {
    logger.error({
      message: `Error creating chat session: ${error instanceof Error ? error.message : String(error)}`,
      category: "api", 
      source: "intercom",
      metadata: {
        merchantId: req.body.merchantId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to create chat session"
    });
  }
});

/**
 * Webhook endpoint for Intercom events
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;
    
    logger.info({
      message: "Received Intercom webhook event",
      category: "api",
      source: "intercom",
      metadata: {
        topic: webhookData.topic,
        type: webhookData.type
      }
    });
    
    // Process the webhook event
    const result = await intercomService.handleWebhookEvent(webhookData);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      logger.warn({
        message: `Failed to process Intercom webhook: ${result.message}`,
        category: "api",
        source: "intercom",
        metadata: {
          topic: webhookData.topic,
          type: webhookData.type
        }
      });
      
      return res.status(422).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    logger.error({
      message: `Error processing Intercom webhook: ${error instanceof Error ? error.message : String(error)}`,
      category: "api", 
      source: "intercom",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        body: req.body
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to process webhook"
    });
  }
});

export default router;