/**
 * Intercom API Routes
 * Handles all Intercom-related API endpoints for real-time chat
 */

import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import intercomService from '../services/intercom.service';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * GET /api/intercom/config
 * Returns the Intercom configuration for client-side initialization
 */
router.get('/config', isAuthenticated, (req, res) => {
  try {
    if (!intercomService.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Intercom service is not properly configured'
      });
    }

    // Determine user type and create appropriate Intercom user data
    const userData: any = {
      name: req.user?.name || '',
      email: req.user?.email || '',
      userId: req.user?.id.toString() || ''
    };

    // Add user type attributes
    if (req.user?.type === 'merchant') {
      userData.role = 'merchant';
      userData.companyId = req.user.merchantId?.toString();
      userData.companyName = req.user.merchantName || 'Merchant';
    } else if (req.user?.type === 'admin') {
      userData.role = 'admin';
    } else {
      userData.role = 'user';
    }

    return res.json({
      success: true,
      config: {
        appId: intercomService.getAppId(),
        userData: userData
      }
    });
  } catch (error) {
    logger.error('Error fetching Intercom configuration', {
      category: 'api',
      source: 'intercom',
      metadata: {
        error: error instanceof Error ? error.message : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Intercom configuration'
    });
  }
});

/**
 * POST /api/intercom/register-user
 * Registers or updates a user in Intercom
 */
router.post('/register-user', isAuthenticated, async (req, res) => {
  try {
    if (!intercomService.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Intercom service is not properly configured'
      });
    }

    const userData: any = {
      name: req.user?.name || '',
      email: req.user?.email || '',
      userId: req.user?.id.toString() || ''
    };

    // Add user type attributes
    if (req.user?.type === 'merchant') {
      userData.role = 'merchant';
      userData.companyId = req.user.merchantId?.toString();
      userData.companyName = req.user.merchantName || 'Merchant';
    } else if (req.user?.type === 'admin') {
      userData.role = 'admin';
    } else {
      userData.role = 'user';
    }

    const contact = await intercomService.createOrUpdateContact(userData);

    if (!contact) {
      return res.status(500).json({
        success: false,
        error: 'Failed to register user with Intercom'
      });
    }

    return res.json({
      success: true,
      contact: contact
    });
  } catch (error) {
    logger.error('Error registering user with Intercom', {
      category: 'api',
      source: 'intercom',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to register user with Intercom'
    });
  }
});

/**
 * POST /api/intercom/create-conversation
 * Creates a new conversation with Intercom
 */
router.post('/create-conversation', isAuthenticated, async (req, res) => {
  try {
    if (!intercomService.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Intercom service is not properly configured'
      });
    }

    const { contactId, message } = req.body;

    if (!contactId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Contact ID and message are required'
      });
    }

    const conversation = await intercomService.createConversation(contactId, message);

    if (!conversation) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create conversation'
      });
    }

    return res.json({
      success: true,
      conversation: conversation
    });
  } catch (error) {
    logger.error('Error creating Intercom conversation', {
      category: 'api',
      source: 'intercom',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create conversation'
    });
  }
});

/**
 * GET /api/intercom/conversations/:contactId
 * Retrieves conversations for a specific contact
 */
router.get('/conversations/:contactId', isAuthenticated, async (req, res) => {
  try {
    if (!intercomService.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Intercom service is not properly configured'
      });
    }

    const { contactId } = req.params;

    if (!contactId) {
      return res.status(400).json({
        success: false,
        error: 'Contact ID is required'
      });
    }

    const conversations = await intercomService.getConversations(contactId);

    return res.json({
      success: true,
      conversations: conversations || []
    });
  } catch (error) {
    logger.error('Error fetching Intercom conversations', {
      category: 'api',
      source: 'intercom',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        contactId: req.params.contactId
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
});

/**
 * POST /api/intercom/assign
 * Assigns a conversation to a team member (admin only)
 */
router.post('/assign', isAuthenticated, async (req, res) => {
  try {
    // Check if user is an admin
    if (req.user?.type !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can assign conversations'
      });
    }

    if (!intercomService.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Intercom service is not properly configured'
      });
    }

    const { conversationId, assigneeId } = req.body;

    if (!conversationId || !assigneeId) {
      return res.status(400).json({
        success: false,
        error: 'Conversation ID and assignee ID are required'
      });
    }

    const result = await intercomService.assignConversation(conversationId, assigneeId);

    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to assign conversation'
      });
    }

    return res.json({
      success: true,
      result: result
    });
  } catch (error) {
    logger.error('Error assigning Intercom conversation', {
      category: 'api',
      source: 'intercom',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        conversationId: req.body.conversationId,
        assigneeId: req.body.assigneeId
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to assign conversation'
    });
  }
});

/**
 * GET /api/intercom/team-members
 * Gets all team members (admin only)
 */
router.get('/team-members', isAuthenticated, async (req, res) => {
  try {
    // Check if user is an admin
    if (req.user?.type !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can view team members'
      });
    }

    if (!intercomService.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Intercom service is not properly configured'
      });
    }

    const teamMembers = await intercomService.getTeamMembers();

    return res.json({
      success: true,
      teamMembers: teamMembers || []
    });
  } catch (error) {
    logger.error('Error fetching Intercom team members', {
      category: 'api',
      source: 'intercom',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch team members'
    });
  }
});

/**
 * POST /api/intercom/close-conversation
 * Closes a conversation (admin only)
 */
router.post('/close-conversation', isAuthenticated, async (req, res) => {
  try {
    // Check if user is an admin
    if (req.user?.type !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can close conversations'
      });
    }

    if (!intercomService.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Intercom service is not properly configured'
      });
    }

    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Conversation ID is required'
      });
    }

    const result = await intercomService.closeConversation(conversationId);

    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to close conversation'
      });
    }

    return res.json({
      success: true,
      result: result
    });
  } catch (error) {
    logger.error('Error closing Intercom conversation', {
      category: 'api',
      source: 'intercom',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        conversationId: req.body.conversationId
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to close conversation'
    });
  }
});

/**
 * POST /api/intercom/add-note
 * Adds a note to a conversation (admin only)
 */
router.post('/add-note', isAuthenticated, async (req, res) => {
  try {
    // Check if user is an admin
    if (req.user?.type !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can add notes'
      });
    }

    if (!intercomService.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Intercom service is not properly configured'
      });
    }

    const { conversationId, adminId, note } = req.body;

    if (!conversationId || !adminId || !note) {
      return res.status(400).json({
        success: false,
        error: 'Conversation ID, admin ID, and note are required'
      });
    }

    const result = await intercomService.addNoteToConversation(conversationId, adminId, note);

    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to add note'
      });
    }

    return res.json({
      success: true,
      result: result
    });
  } catch (error) {
    logger.error('Error adding note to Intercom conversation', {
      category: 'api',
      source: 'intercom',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        conversationId: req.body.conversationId,
        adminId: req.body.adminId
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to add note'
    });
  }
});

export default router;