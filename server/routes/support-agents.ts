import { Router } from 'express';
import { z } from 'zod';
import { isAuthenticated, isAdmin } from '../middleware/auth';
import { storage } from '../storage';
import { insertSupportAgentSchema } from '@shared/schema';
import { logger } from '../services/logger';

export const supportAgentsRouter = Router();

// Get all support agents (admin only)
supportAgentsRouter.get(
  '/',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const agents = await storage.getAllSupportAgents();
      return res.json({ success: true, data: agents });
    } catch (error) {
      logger.error('Error fetching support agents:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch support agents' 
      });
    }
  }
);

// Get active support agents (admin only)
supportAgentsRouter.get(
  '/active',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const agents = await storage.getActiveSupportAgents();
      return res.json({ success: true, data: agents });
    } catch (error) {
      logger.error('Error fetching active support agents:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch active support agents' 
      });
    }
  }
);

// Get support agents by specialty (admin only)
supportAgentsRouter.get(
  '/specialty/:specialty',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { specialty } = req.params;
      if (!specialty) {
        return res.status(400).json({ 
          success: false, 
          error: 'Specialty parameter is required' 
        });
      }

      const agents = await storage.getSupportAgentsBySpecialty(specialty);
      return res.json({ success: true, data: agents });
    } catch (error) {
      logger.error('Error fetching support agents by specialty:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch support agents by specialty' 
      });
    }
  }
);

// Get a specific support agent (admin only)
supportAgentsRouter.get(
  '/:id',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid agent ID' 
        });
      }

      const agent = await storage.getSupportAgent(id);
      if (!agent) {
        return res.status(404).json({ 
          success: false, 
          error: 'Support agent not found' 
        });
      }

      return res.json({ success: true, data: agent });
    } catch (error) {
      logger.error('Error fetching support agent:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch support agent' 
      });
    }
  }
);

// Create a new support agent (admin only)
supportAgentsRouter.post(
  '/',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      // Validate request body
      const validatedData = insertSupportAgentSchema.parse(req.body);
      
      // Check if user exists
      const user = await storage.getUser(validatedData.userId);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }

      // Create support agent
      const agent = await storage.createSupportAgent(validatedData);
      return res.status(201).json({ success: true, data: agent });
    } catch (error) {
      logger.error('Error creating support agent:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid agent data', 
          details: error.errors 
        });
      }
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create support agent' 
      });
    }
  }
);

// Update a support agent (admin only)
supportAgentsRouter.patch(
  '/:id',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid agent ID' 
        });
      }

      // Check if agent exists
      const existingAgent = await storage.getSupportAgent(id);
      if (!existingAgent) {
        return res.status(404).json({ 
          success: false, 
          error: 'Support agent not found' 
        });
      }

      // Update agent
      const updatedAgent = await storage.updateSupportAgent(id, req.body);
      return res.json({ success: true, data: updatedAgent });
    } catch (error) {
      logger.error('Error updating support agent:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update support agent' 
      });
    }
  }
);

// Get performance metrics for a support agent (admin only)
supportAgentsRouter.get(
  '/:id/performance',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid agent ID' 
        });
      }

      // Check if agent exists
      const agent = await storage.getSupportAgent(id);
      if (!agent) {
        return res.status(404).json({ 
          success: false, 
          error: 'Support agent not found' 
        });
      }

      // Get performance metrics
      const performance = await storage.getSupportAgentPerformanceByAgentId(id);
      return res.json({ success: true, data: performance });
    } catch (error) {
      logger.error('Error fetching agent performance:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch agent performance metrics' 
      });
    }
  }
);

// Get performance metrics for a support agent within a date range (admin only)
supportAgentsRouter.get(
  '/:id/performance/range',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid agent ID' 
        });
      }

      // Parse date range from query parameters
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          error: 'Valid startDate and endDate are required' 
        });
      }

      // Check if agent exists
      const agent = await storage.getSupportAgent(id);
      if (!agent) {
        return res.status(404).json({ 
          success: false, 
          error: 'Support agent not found' 
        });
      }

      // Get performance metrics for date range
      const performance = await storage.getPerformanceByDateRange(id, startDate, endDate);
      return res.json({ success: true, data: performance });
    } catch (error) {
      logger.error('Error fetching agent performance by date range:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch agent performance metrics for date range' 
      });
    }
  }
);

// Update agent workload settings (admin only)
supportAgentsRouter.patch(
  '/:id/workload',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid agent ID' 
        });
      }

      // Validate request data
      const workloadSchema = z.object({
        maxWorkload: z.number().min(1).optional(),
        isAvailable: z.boolean().optional()
      });
      
      const validatedData = workloadSchema.parse(req.body);

      // Check if agent exists
      const agent = await storage.getSupportAgent(id);
      if (!agent) {
        return res.status(404).json({ 
          success: false, 
          error: 'Support agent not found' 
        });
      }

      // Update workload settings
      const updatedAgent = await storage.updateSupportAgent(id, validatedData);
      return res.json({ success: true, data: updatedAgent });
    } catch (error) {
      logger.error('Error updating agent workload:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid workload data', 
          details: error.errors 
        });
      }
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update agent workload settings' 
      });
    }
  }
);

// Get current agent assignments and workload (admin only)
supportAgentsRouter.get(
  '/:id/assignments',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid agent ID' 
        });
      }

      // Check if agent exists
      const agent = await storage.getSupportAgent(id);
      if (!agent) {
        return res.status(404).json({ 
          success: false, 
          error: 'Support agent not found' 
        });
      }

      // Get current assignments
      const tickets = await storage.getTicketsByAgentId(id);
      return res.json({ 
        success: true, 
        data: {
          agent,
          currentWorkload: agent.currentWorkload,
          maxWorkload: agent.maxWorkload,
          isAvailable: agent.isAvailable,
          assignments: tickets
        }
      });
    } catch (error) {
      logger.error('Error fetching agent assignments:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch agent assignments' 
      });
    }
  }
);