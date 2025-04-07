import axios from 'axios';
import { logger } from './logger';
import { InsertChatMessage, ChatSession, ChatMessage } from '../../shared/schema';

// Interfaces for Intercom types
interface IntercomUser {
  id: string;
  user_id?: string;
  email?: string;
  name?: string;
  role?: string;
  signed_up_at?: number;
  custom_attributes?: Record<string, any>;
}

interface IntercomMessage {
  id: string;
  type: 'comment' | 'note' | 'assignment' | 'attachment';
  body: string;
  author: {
    id: string;
    type: 'admin' | 'user' | 'bot';
  };
  attachments?: any[];
  url?: string;
  created_at: number;
}

interface IntercomConversation {
  id: string;
  created_at: number;
  updated_at: number;
  source: {
    type: string;
    id: string;
  };
  customers: IntercomUser[];
  assignee: {
    id: string;
    type: 'admin' | 'team';
  };
  conversation_parts: {
    conversation_parts: IntercomMessage[];
    total_count: number;
  };
  state: 'open' | 'closed';
  read: boolean;
  tags?: {
    tags: { id: string; name: string }[];
  };
}

interface IntercomAdmin {
  id: string;
  email: string;
  name: string;
  away_mode_enabled: boolean;
  away_mode_reassign: boolean;
}

/**
 * Service for interacting with the Intercom API
 */
class IntercomService {
  private token: string;
  private baseUrl: string = 'https://api.intercom.io';
  private headers: Record<string, string>;

  constructor() {
    this.token = process.env.INTERCOM_ACCESS_TOKEN || '';
    this.headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Intercom-Version': '2.10'
    };

    // Validate that we have an API token
    if (!this.token) {
      logger.warn('INTERCOM_ACCESS_TOKEN not set. Intercom service will not function correctly.');
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.token;
  }

  /**
   * Create or update a user in Intercom
   * @param userData User information to register
   * @returns The created/updated user
   */
  async createOrUpdateUser(userData: {
    userId: number;
    email: string;
    name: string;
    role: string;
    merchantId?: number;
    companyName?: string;
  }): Promise<IntercomUser> {
    try {
      const payload = {
        role: 'user',
        external_id: `user-${userData.userId}`,
        email: userData.email,
        name: userData.name,
        custom_attributes: {
          role: userData.role,
          user_id: userData.userId,
          ...(userData.merchantId && { merchant_id: userData.merchantId }),
          ...(userData.companyName && { company_name: userData.companyName })
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/contacts`,
        payload,
        { headers: this.headers }
      );

      logger.info(`Intercom user created/updated: ${response.data.id}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Error creating/updating Intercom user: ${error.message}`, {
        userId: userData.userId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Start a new conversation in Intercom
   * @param contactId Intercom contact ID
   * @param message Initial message
   * @param assigneeId ID of the admin to assign the conversation to (optional)
   * @returns The created conversation
   */
  async startConversation(contactId: string, message: string, assigneeId?: string): Promise<IntercomConversation> {
    try {
      const payload: any = {
        source: {
          type: 'user',
          id: contactId
        },
        body: message
      };

      if (assigneeId) {
        payload.assignee = {
          type: 'admin',
          id: assigneeId
        };
      }

      const response = await axios.post(
        `${this.baseUrl}/conversations`,
        payload,
        { headers: this.headers }
      );

      logger.info(`Intercom conversation started: ${response.data.conversation_id}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Error starting Intercom conversation: ${error.message}`, {
        contactId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Send a reply to an existing conversation
   * @param conversationId Intercom conversation ID
   * @param message The message to send
   * @param authorId The ID of the sender (contact ID or admin ID)
   * @param isAdmin Whether the sender is an admin
   * @returns The updated conversation
   */
  async replyToConversation(
    conversationId: string,
    message: string,
    authorId: string,
    isAdmin: boolean = false
  ): Promise<IntercomConversation> {
    try {
      const payload: any = {
        body: message,
        type: 'comment'
      };

      if (isAdmin) {
        payload.admin_id = authorId;
      } else {
        payload.intercom_user_id = authorId;
      }

      const response = await axios.post(
        `${this.baseUrl}/conversations/${conversationId}/reply`,
        payload,
        { headers: this.headers }
      );

      logger.info(`Reply sent to Intercom conversation: ${conversationId}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Error replying to Intercom conversation: ${error.message}`, {
        conversationId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Get conversation by ID
   * @param conversationId Intercom conversation ID
   * @returns The conversation
   */
  async getConversation(conversationId: string): Promise<IntercomConversation> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/conversations/${conversationId}`,
        { headers: this.headers }
      );

      return response.data;
    } catch (error: any) {
      logger.error(`Error fetching Intercom conversation: ${error.message}`, {
        conversationId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Get conversations for a user
   * @param userId User's Intercom ID
   * @returns List of conversations
   */
  async getUserConversations(userId: string): Promise<IntercomConversation[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/conversations?user_id=${userId}`,
        { headers: this.headers }
      );

      return response.data.conversations;
    } catch (error: any) {
      logger.error(`Error fetching user Intercom conversations: ${error.message}`, {
        userId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Close a conversation
   * @param conversationId Intercom conversation ID
   * @returns The updated conversation
   */
  async closeConversation(conversationId: string): Promise<IntercomConversation> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/conversations/${conversationId}/parts`,
        {
          type: 'close',
          admin_id: null
        },
        { headers: this.headers }
      );

      logger.info(`Intercom conversation closed: ${conversationId}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Error closing Intercom conversation: ${error.message}`, {
        conversationId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Get all admins (support agents)
   * @returns List of admins
   */
  async getAdmins(): Promise<IntercomAdmin[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/admins`,
        { headers: this.headers }
      );

      return response.data.admins;
    } catch (error: any) {
      logger.error(`Error fetching Intercom admins: ${error.message}`, {
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Assign a conversation to an admin
   * @param conversationId Intercom conversation ID
   * @param adminId Intercom admin ID
   * @returns The updated conversation
   */
  async assignConversation(conversationId: string, adminId: string): Promise<IntercomConversation> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/conversations/${conversationId}/parts`,
        {
          type: 'assignment',
          assigned_to: { type: 'admin', id: adminId }
        },
        { headers: this.headers }
      );

      logger.info(`Intercom conversation assigned: ${conversationId} to admin ${adminId}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Error assigning Intercom conversation: ${error.message}`, {
        conversationId,
        adminId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Convert a conversation to a chat session in our database format
   * @param conversation Intercom conversation
   * @param merchantId The internal merchant ID
   * @param agentId The internal agent ID
   * @returns Formatted chat session data
   */
  convertToDbChatSession(
    conversation: IntercomConversation, 
    merchantId: number, 
    agentId?: number
  ): Partial<ChatSession> {
    return {
      merchantId,
      agentId,
      externalId: conversation.id,
      status: conversation.state === 'open' ? 'active' : 'closed',
      startedAt: new Date(conversation.created_at * 1000),
      lastActivityAt: new Date(conversation.updated_at * 1000),
      subject: "Chat with support", // Default subject
      source: "intercom"
    };
  }

  /**
   * Convert Intercom messages to our database format
   * @param conversation Intercom conversation
   * @param sessionId Our internal chat session ID
   * @returns Formatted chat messages
   */
  convertToDbChatMessages(
    conversation: IntercomConversation, 
    sessionId: number
  ): Partial<InsertChatMessage>[] {
    const messages: Partial<InsertChatMessage>[] = [];

    // Add the initial message
    if (conversation.source && conversation.source.type === 'user') {
      messages.push({
        sessionId,
        externalId: conversation.id, // Using conversation ID as the first message doesn't have its own ID
        content: conversation.conversation_parts.conversation_parts[0]?.body || "Started conversation",
        sentAt: new Date(conversation.created_at * 1000),
        senderId: conversation.customers[0]?.user_id || null,
        senderType: 'merchant', // First message is always from the customer/merchant
        messageType: 'text',
        isRead: true
      });
    }

    // Add all subsequent messages
    conversation.conversation_parts.conversation_parts.forEach(part => {
      if (part.type === 'comment') {
        messages.push({
          sessionId,
          externalId: part.id,
          content: part.body,
          sentAt: new Date(part.created_at * 1000),
          senderId: part.author.id,
          senderType: part.author.type === 'admin' ? 'agent' : 'merchant',
          messageType: 'text',
          isRead: part.author.type === 'admin' ? true : conversation.read
        });
      }
    });

    return messages;
  }

  /**
   * Webhook handler for Intercom events
   * @param event The webhook event data
   * @returns Processing result
   */
  async handleWebhookEvent(event: any): Promise<{ success: boolean; message: string }> {
    try {
      const eventType = event.type;
      logger.info(`Received Intercom webhook event: ${eventType}`, { event });

      switch (eventType) {
        case 'conversation.user.created':
        case 'conversation.user.replied':
        case 'conversation.admin.replied':
        case 'conversation.admin.assigned':
        case 'conversation.admin.closed':
          // These events would trigger appropriate database updates
          return { success: true, message: `Processed ${eventType} event` };
        default:
          logger.info(`Unhandled Intercom webhook event type: ${eventType}`);
          return { success: true, message: `Ignored ${eventType} event` };
      }
    } catch (error: any) {
      logger.error(`Error processing Intercom webhook: ${error.message}`, { error });
      return { success: false, message: error.message };
    }
  }
}

export const intercomService = new IntercomService();