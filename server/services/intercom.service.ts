/**
 * Intercom Service for real-time chat integration
 * This service provides methods to interact with the Intercom API
 */

import axios from 'axios';
import { logger } from '../services/logger';

class IntercomService {
  private apiKey: string;
  private appId: string;
  private baseUrl: string = 'https://api.intercom.io';
  private initialized: boolean = false;

  constructor() {
    this.apiKey = process.env.INTERCOM_API_KEY || '';
    this.appId = process.env.INTERCOM_APP_ID || '';
    this.initialized = Boolean(this.apiKey && this.appId);

    if (!this.initialized) {
      logger.warn('Intercom service initialization failed - missing API credentials', {
        category: 'system',
        source: 'intercom',
        metadata: {
          hasApiKey: Boolean(this.apiKey),
          hasAppId: Boolean(this.appId)
        }
      });
    } else {
      logger.info('Intercom service initialized successfully', {
        category: 'system',
        source: 'intercom'
      });
    }
  }

  /**
   * Check if the Intercom service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the Intercom App ID for client-side initialization
   */
  getAppId(): string {
    return this.appId;
  }

  /**
   * Create or update a contact in Intercom
   * @param userData User data to create/update the contact
   */
  async createOrUpdateContact(userData: {
    email: string;
    name?: string;
    userId?: string;
    role?: 'user' | 'merchant' | 'admin';
    companyId?: string;
    companyName?: string;
  }) {
    if (!this.initialized) {
      logger.warn('Intercom create contact failed - service not initialized', {
        category: 'intercom',
        source: 'internal'
      });
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/contacts`,
        {
          role: 'contact',
          email: userData.email,
          name: userData.name,
          external_id: userData.userId || undefined,
          custom_attributes: {
            user_role: userData.role || 'user'
          },
          ...(userData.companyId && userData.companyName ? {
            companies: [{
              company_id: userData.companyId,
              name: userData.companyName
            }]
          } : {})
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Intercom contact created/updated successfully', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          userId: userData.userId,
          email: userData.email
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create/update Intercom contact', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          userData
        }
      });
      return null;
    }
  }

  /**
   * Create a conversation with a contact
   * @param contactId Intercom contact ID
   * @param message Initial message to send
   */
  async createConversation(contactId: string, message: string) {
    if (!this.initialized) {
      logger.warn('Intercom create conversation failed - service not initialized', {
        category: 'intercom',
        source: 'internal'
      });
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/conversations`,
        {
          from: {
            type: 'contact',
            id: contactId
          },
          body: message
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Intercom conversation created successfully', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          contactId,
          conversationId: response.data.id
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create Intercom conversation', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          contactId
        }
      });
      return null;
    }
  }

  /**
   * Retrieve a user's conversations
   * @param contactId Intercom contact ID
   */
  async getConversations(contactId: string) {
    if (!this.initialized) {
      logger.warn('Intercom get conversations failed - service not initialized', {
        category: 'intercom',
        source: 'internal'
      });
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/conversations?contact_id=${contactId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      return response.data.conversations;
    } catch (error) {
      logger.error('Failed to get Intercom conversations', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          contactId
        }
      });
      return null;
    }
  }

  /**
   * Add a note to a conversation (internal team comments)
   * @param conversationId Intercom conversation ID
   * @param adminId Admin ID who is adding the note
   * @param note Text of the note
   */
  async addNoteToConversation(conversationId: string, adminId: string, note: string) {
    if (!this.initialized) {
      logger.warn('Intercom add note failed - service not initialized', {
        category: 'intercom',
        source: 'internal'
      });
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/conversations/${conversationId}/notes`,
        {
          admin_id: adminId,
          body: note
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Note added to Intercom conversation', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          conversationId,
          adminId
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to add note to Intercom conversation', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          conversationId,
          adminId
        }
      });
      return null;
    }
  }

  /**
   * Assign a conversation to a specific team member
   * @param conversationId Intercom conversation ID
   * @param assigneeId ID of the team member to assign the conversation to
   */
  async assignConversation(conversationId: string, assigneeId: string) {
    if (!this.initialized) {
      logger.warn('Intercom assign conversation failed - service not initialized', {
        category: 'intercom',
        source: 'internal'
      });
      return null;
    }

    try {
      const response = await axios.put(
        `${this.baseUrl}/conversations/${conversationId}/assign`,
        {
          assignment: {
            type: 'admin',
            admin_id: assigneeId
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Intercom conversation assigned successfully', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          conversationId,
          assigneeId
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to assign Intercom conversation', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          conversationId,
          assigneeId
        }
      });
      return null;
    }
  }

  /**
   * Close a conversation
   * @param conversationId Intercom conversation ID
   */
  async closeConversation(conversationId: string) {
    if (!this.initialized) {
      logger.warn('Intercom close conversation failed - service not initialized', {
        category: 'intercom',
        source: 'internal'
      });
      return null;
    }

    try {
      const response = await axios.put(
        `${this.baseUrl}/conversations/${conversationId}/close`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Intercom conversation closed successfully', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          conversationId
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to close Intercom conversation', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          conversationId
        }
      });
      return null;
    }
  }

  /**
   * Get all team members (admins) from your Intercom workspace
   */
  async getTeamMembers() {
    if (!this.initialized) {
      logger.warn('Intercom get team members failed - service not initialized', {
        category: 'intercom',
        source: 'internal'
      });
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/admins`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      return response.data.admins;
    } catch (error) {
      logger.error('Failed to get Intercom team members', {
        category: 'intercom',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return null;
    }
  }
}

// Create a singleton instance
const intercomService = new IntercomService();

export default intercomService;