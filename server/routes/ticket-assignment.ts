import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { assignTicket, findBestAgentForTicket, reassignAgentTickets, updateTicketSlaStatus, updateAgentPerformanceMetrics } from '../services/ticketAssignment';
import { authenticateToken } from '@/server/middleware/auth';
import { logger } from '@/server/services/logger';

export const ticketAssignmentRouter = Router();

// Authenticate all routes
ticketAssignmentRouter.use(authenticateToken);

// Auto-assign a single ticket
ticketAssignmentRouter.post('/assign/:ticketId', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    if (isNaN(ticketId)) {
      return res.status(400).json({ success: false, error: 'Invalid ticket ID' });
    }

    const ticket = await storage.getSupportTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const assignedAgentId = await assignTicket(ticketId);
    if (assignedAgentId === null) {
      return res.status(500).json({ success: false, error: 'Failed to assign ticket to an agent' });
    }

    // Get the assigned agent details
    const agent = await storage.getSupportAgent(assignedAgentId);
    return res.json({ 
      success: true, 
      data: { 
        ticketId, 
        agentId: assignedAgentId,
        agentName: agent?.name || 'Unknown',
        message: `Ticket #${ticketId} successfully assigned to agent ${agent?.name || 'Unknown'}`
      } 
    });
  } catch (error) {
    logger.error({
      message: `Error in ticket assignment endpoint: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'routes',
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        path: req.path
      }
    });
    return res.status(500).json({ success: false, error: 'An error occurred while assigning the ticket' });
  }
});

// Auto-assign all unassigned tickets
ticketAssignmentRouter.post('/assign-all', async (req, res) => {
  try {
    const unassignedTickets = await storage.getSupportTicketsByStatus('new');
    
    if (!unassignedTickets || unassignedTickets.length === 0) {
      return res.json({ success: true, data: { message: 'No unassigned tickets found', assignedCount: 0 } });
    }

    let assignedCount = 0;
    const assignmentResults = [];

    // Assign each unassigned ticket
    for (const ticket of unassignedTickets) {
      const assignedAgentId = await assignTicket(ticket.id);
      if (assignedAgentId !== null) {
        assignedCount++;
        const agent = await storage.getSupportAgent(assignedAgentId);
        assignmentResults.push({
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          agentId: assignedAgentId,
          agentName: agent?.name || 'Unknown'
        });
      }
    }

    return res.json({ 
      success: true, 
      data: { 
        message: `${assignedCount} out of ${unassignedTickets.length} tickets were successfully assigned`,
        totalTickets: unassignedTickets.length,
        assignedCount,
        assignments: assignmentResults
      } 
    });
  } catch (error) {
    logger.error({
      message: `Error in bulk ticket assignment endpoint: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'routes',
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        path: req.path
      }
    });
    return res.status(500).json({ success: false, error: 'An error occurred while assigning tickets' });
  }
});

// Reassign tickets from a specific agent
ticketAssignmentRouter.post('/reassign/:agentId', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    if (isNaN(agentId)) {
      return res.status(400).json({ success: false, error: 'Invalid agent ID' });
    }

    const agent = await storage.getSupportAgent(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const reassignedCount = await reassignAgentTickets(agentId);
    return res.json({ 
      success: true, 
      data: { 
        agentId, 
        agentName: agent.name,
        reassignedCount,
        message: `${reassignedCount} tickets were reassigned from agent ${agent.name}`
      } 
    });
  } catch (error) {
    logger.error({
      message: `Error in reassign agent tickets endpoint: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'routes',
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        path: req.path,
        agentId: req.params.agentId
      }
    });
    return res.status(500).json({ success: false, error: 'An error occurred while reassigning tickets' });
  }
});

// Update SLA status for all tickets
ticketAssignmentRouter.post('/update-sla', async (req, res) => {
  try {
    const updatedCount = await updateTicketSlaStatus();
    return res.json({ 
      success: true, 
      data: { 
        updatedCount,
        message: `SLA status updated for ${updatedCount} tickets`
      } 
    });
  } catch (error) {
    logger.error({
      message: `Error in update SLA status endpoint: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'routes',
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        path: req.path
      }
    });
    return res.status(500).json({ success: false, error: 'An error occurred while updating SLA status' });
  }
});

// Update agent performance metrics
ticketAssignmentRouter.post('/update-agent-metrics/:agentId', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    if (isNaN(agentId)) {
      return res.status(400).json({ success: false, error: 'Invalid agent ID' });
    }

    const agent = await storage.getSupportAgent(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const updated = await updateAgentPerformanceMetrics(agentId);
    if (!updated) {
      return res.status(404).json({ 
        success: false, 
        error: 'No performance data available for this agent' 
      });
    }

    // Get updated performance metrics
    const performance = await storage.getSupportAgentPerformanceByAgentId(agentId);

    return res.json({ 
      success: true, 
      data: { 
        agentId,
        agentName: agent.name,
        performance,
        message: `Performance metrics updated for agent ${agent.name}`
      } 
    });
  } catch (error) {
    logger.error({
      message: `Error in update agent metrics endpoint: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'routes',
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        path: req.path,
        agentId: req.params.agentId
      }
    });
    return res.status(500).json({ success: false, error: 'An error occurred while updating agent metrics' });
  }
});

// Find best agent for specific ticket
ticketAssignmentRouter.get('/find-best-agent/:ticketId', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    if (isNaN(ticketId)) {
      return res.status(400).json({ success: false, error: 'Invalid ticket ID' });
    }

    const ticket = await storage.getSupportTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const bestAgent = await findBestAgentForTicket(ticket);
    if (!bestAgent) {
      return res.status(404).json({ 
        success: false, 
        error: 'No suitable agent found for this ticket' 
      });
    }

    return res.json({ 
      success: true, 
      data: { 
        ticketId,
        agent: {
          id: bestAgent.id,
          name: bestAgent.name,
          email: bestAgent.email,
          specialties: bestAgent.specialties,
          currentWorkload: bestAgent.currentWorkload
        },
        message: `Best agent found for ticket #${ticketId}: ${bestAgent.name}`
      } 
    });
  } catch (error) {
    logger.error({
      message: `Error in find best agent endpoint: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'routes',
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        path: req.path,
        ticketId: req.params.ticketId
      }
    });
    return res.status(500).json({ success: false, error: 'An error occurred while finding the best agent' });
  }
});