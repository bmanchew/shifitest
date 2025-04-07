import { storage } from '../storage';
import { logger } from './logger';
import { SupportAgent, SupportTicket } from '@shared/schema';

/**
 * Automatically assign a ticket to the most appropriate support agent
 */
export async function assignTicket(ticketId: number): Promise<number | null> {
  try {
    // Get ticket details
    const ticket = await storage.getSupportTicket(ticketId);
    if (!ticket) {
      logger.error({
        message: `Cannot assign ticket: Ticket ${ticketId} not found`,
        category: 'ticket-assignment',
        source: 'internal',
      });
      return null;
    }
    
    // Get all available support agents
    const agents = await storage.getActiveSupportAgents();
    if (!agents || agents.length === 0) {
      logger.warn({
        message: 'No support agents available for assignment',
        category: 'ticket-assignment',
        source: 'internal',
      });
      return null;
    }
    
    // Filter out unavailable agents
    const availableAgents = agents.filter(agent => agent.isAvailable);
    if (availableAgents.length === 0) {
      logger.warn({
        message: 'No available support agents for assignment',
        category: 'ticket-assignment',
        source: 'internal',
      });
      return null;
    }
    
    // Find agents with matching specialties for the ticket category
    let matchingAgents = availableAgents.filter(agent => 
      agent.specialties && agent.specialties.includes(ticket.category)
    );
    
    // If no agents match the specialty, fall back to all available agents
    if (matchingAgents.length === 0) {
      logger.info({
        message: `No agents with specialty '${ticket.category}' available, using all available agents.`,
        category: 'ticket-assignment',
        source: 'internal',
      });
      matchingAgents = availableAgents;
    }
    
    // Sort agents by workload (ascending)
    const sortedAgents = matchingAgents.sort(
      (a, b) => (a.currentWorkload || 0) - (b.currentWorkload || 0)
    );
    
    // Assign to the agent with the lowest workload
    const selectedAgent = sortedAgents[0];
    
    // Update the ticket with the agent assignment
    await storage.updateSupportTicket(ticketId, { 
      assignedTo: selectedAgent.id,
      assignedAt: new Date(),
      status: ticket.status === 'new' ? 'in_progress' : ticket.status
    });
    
    // Update the agent's workload
    await storage.updateSupportAgent(selectedAgent.id, {
      currentWorkload: (selectedAgent.currentWorkload || 0) + 1,
      lastAssignedAt: new Date()
    });
    
    // Log the assignment
    logger.info({
      message: `Ticket #${ticketId} assigned to agent ${selectedAgent.name} (ID: ${selectedAgent.id})`,
      category: 'ticket-assignment',
      source: 'internal',
      metadata: {
        ticketId,
        agentId: selectedAgent.id,
        category: ticket.category,
        priority: ticket.priority
      }
    });
    
    // Create activity log entry for the ticket
    await storage.createTicketActivityLog({
      ticketId: ticketId,
      activityType: 'assignment',
      description: `Ticket assigned to ${selectedAgent.name}`,
      performedBy: 0, // 0 for system actions
      metadata: {
        agentId: selectedAgent.id,
        agentName: selectedAgent.name,
        assignmentMethod: 'automatic'
      }
    });
    
    return selectedAgent.id;
  } catch (error) {
    logger.error({
      message: `Error assigning ticket ${ticketId}: ${error instanceof Error ? error.message : String(error)}`,
      category: 'ticket-assignment',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        ticketId
      }
    });
    return null;
  }
}

/**
 * Find the best agent for a ticket based on expertise and workload
 */
export async function findBestAgentForTicket(ticket: SupportTicket): Promise<SupportAgent | null> {
  try {
    // Get all active and available agents
    const agents = await storage.getActiveSupportAgents();
    if (!agents || agents.length === 0) return null;
    
    // Filter for available agents
    const availableAgents = agents.filter(agent => agent.isAvailable);
    if (availableAgents.length === 0) return null;
    
    // Score each agent based on match criteria
    const scoredAgents = availableAgents.map(agent => {
      let score = 0;
      
      // Higher score for matching specialty
      if (agent.specialties && agent.specialties.includes(ticket.category)) {
        score += 5;
      }
      
      // Higher score for agents with lower workload (inverse relationship)
      const workloadScore = 10 - Math.min(10, agent.currentWorkload || 0);
      score += workloadScore;
      
      // Consider recency of last assignment (prefer those who haven't been assigned recently)
      if (agent.lastAssignedAt) {
        const hoursSinceLastAssignment = 
          (Date.now() - new Date(agent.lastAssignedAt).getTime()) / (1000 * 60 * 60);
        // Add up to 3 points for agents who haven't been assigned in a while
        score += Math.min(3, hoursSinceLastAssignment / 8);
      } else {
        // Agents who have never been assigned get a bonus
        score += 3;
      }
      
      return { agent, score };
    });
    
    // Sort by score (descending)
    scoredAgents.sort((a, b) => b.score - a.score);
    
    // Return the highest-scoring agent
    return scoredAgents.length > 0 ? scoredAgents[0].agent : null;
  } catch (error) {
    logger.error({
      message: `Error finding best agent: ${error instanceof Error ? error.message : String(error)}`,
      category: 'ticket-assignment',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        ticketCategory: ticket.category,
        ticketPriority: ticket.priority
      }
    });
    return null;
  }
}

/**
 * Reassign tickets when an agent becomes unavailable
 */
export async function reassignAgentTickets(agentId: number): Promise<number> {
  try {
    // Get all open tickets assigned to this agent
    const tickets = await storage.getActiveTicketsByAgentId(agentId);
    if (!tickets || tickets.length === 0) return 0;
    
    let reassignedCount = 0;
    
    // Reassign each ticket
    for (const ticket of tickets) {
      const success = await assignTicket(ticket.id);
      if (success) reassignedCount++;
    }
    
    logger.info({
      message: `Reassigned ${reassignedCount} tickets from agent ${agentId}`,
      category: 'ticket-assignment',
      source: 'internal',
      metadata: {
        agentId,
        totalTickets: tickets.length,
        reassignedTickets: reassignedCount
      }
    });
    
    return reassignedCount;
  } catch (error) {
    logger.error({
      message: `Error reassigning tickets for agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`,
      category: 'ticket-assignment',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        agentId
      }
    });
    return 0;
  }
}

/**
 * Update agent performance metrics based on closed/resolved tickets
 */
export async function updateAgentPerformanceMetrics(agentId: number): Promise<boolean> {
  try {
    // Get all resolved tickets assigned to this agent
    const resolvedTickets = await storage.getResolvedTicketsByAgentId(agentId);
    if (!resolvedTickets || resolvedTickets.length === 0) return false;
    
    // Calculate average resolution time
    let totalResolutionTimeHours = 0;
    let ticketsWithResolutionTime = 0;
    
    resolvedTickets.forEach(ticket => {
      if (ticket.createdAt && ticket.resolvedAt) {
        const createdTime = new Date(ticket.createdAt).getTime();
        const resolvedTime = new Date(ticket.resolvedAt).getTime();
        const resolutionTimeHours = (resolvedTime - createdTime) / (1000 * 60 * 60);
        totalResolutionTimeHours += resolutionTimeHours;
        ticketsWithResolutionTime++;
      }
    });
    
    const averageResolutionTimeHours = 
      ticketsWithResolutionTime > 0 ? totalResolutionTimeHours / ticketsWithResolutionTime : 0;
    
    // Get customer satisfaction ratings
    const ticketsWithFeedback = resolvedTickets.filter(ticket => ticket.customerSatisfactionRating);
    let avgSatisfactionScore = 0;
    
    if (ticketsWithFeedback.length > 0) {
      const totalScore = ticketsWithFeedback.reduce(
        (sum, ticket) => sum + (ticket.customerSatisfactionRating || 0), 0
      );
      avgSatisfactionScore = totalScore / ticketsWithFeedback.length;
    }
    
    // Update agent performance metrics
    const performance = await storage.getSupportAgentPerformanceByAgentId(agentId);
    
    if (performance) {
      // Update existing performance record
      await storage.updateSupportAgentPerformance(performance.id, {
        ticketsResolved: resolvedTickets.length,
        averageResolutionTimeHours,
        customerSatisfactionScore: avgSatisfactionScore,
        updatedAt: new Date()
      });
    } else {
      // Create new performance record
      await storage.createSupportAgentPerformance({
        agentId,
        ticketsAssigned: resolvedTickets.length,
        ticketsResolved: resolvedTickets.length,
        averageResolutionTimeHours,
        customerSatisfactionScore: avgSatisfactionScore
      });
    }
    
    return true;
  } catch (error) {
    logger.error({
      message: `Error updating performance metrics for agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`,
      category: 'agent-performance',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        agentId
      }
    });
    return false;
  }
}

/**
 * Update SLA status for tickets
 */
export async function updateTicketSlaStatus(): Promise<number> {
  try {
    // Get all active tickets
    const activeTickets = await storage.getActiveTickets();
    if (!activeTickets || activeTickets.length === 0) return 0;
    
    // Get SLA configuration
    const slaConfigs = await storage.getTicketSlaConfigs();
    if (!slaConfigs || slaConfigs.length === 0) return 0;
    
    // Create a map of SLA configs by priority
    const slaConfigMap = slaConfigs.reduce((map, config) => {
      map[config.priority] = config;
      return map;
    }, {} as Record<string, any>);
    
    let updatedCount = 0;
    
    // Check each ticket against SLA
    for (const ticket of activeTickets) {
      const slaConfig = slaConfigMap[ticket.priority] || slaConfigMap['normal']; // Default to normal priority
      if (!slaConfig) continue;
      
      const currentTime = Date.now();
      const createdTime = new Date(ticket.createdAt).getTime();
      const elapsedHours = (currentTime - createdTime) / (1000 * 60 * 60);
      
      let slaStatus = 'within_sla';
      
      // First response SLA check
      if (!ticket.firstResponseAt) {
        if (elapsedHours > slaConfig.responseTimeHours) {
          slaStatus = 'response_overdue';
        } else if (elapsedHours > (slaConfig.responseTimeHours * 0.75)) {
          slaStatus = 'response_at_risk';
        }
      } 
      // Resolution SLA check
      else if (!ticket.resolvedAt) {
        const resolutionDeadline = createdTime + (slaConfig.resolutionTimeHours * 60 * 60 * 1000);
        const timeToResolution = resolutionDeadline - currentTime;
        
        if (timeToResolution < 0) {
          slaStatus = 'resolution_overdue';
        } else if (timeToResolution < (slaConfig.resolutionTimeHours * 0.25 * 60 * 60 * 1000)) {
          slaStatus = 'resolution_at_risk';
        }
      }
      
      // Update ticket if SLA status has changed
      if (ticket.slaStatus !== slaStatus) {
        await storage.updateSupportTicket(ticket.id, { slaStatus });
        updatedCount++;
        
        // Log SLA status changes
        logger.info({
          message: `Ticket #${ticket.id} SLA status changed to ${slaStatus}`,
          category: 'ticket-sla',
          source: 'internal',
          metadata: {
            ticketId: ticket.id,
            previousStatus: ticket.slaStatus,
            newStatus: slaStatus,
            priority: ticket.priority,
            elapsedHours
          }
        });
        
        // Create activity log entry for the ticket
        await storage.createTicketActivityLog({
          ticketId: ticket.id,
          activityType: 'sla_update',
          description: `Ticket SLA status changed to ${slaStatus.replace('_', ' ')}`,
          performedBy: 0, // 0 for system actions
          metadata: {
            previousStatus: ticket.slaStatus,
            newStatus: slaStatus
          }
        });
      }
    }
    
    return updatedCount;
  } catch (error) {
    logger.error({
      message: `Error updating ticket SLA statuses: ${error instanceof Error ? error.message : String(error)}`,
      category: 'ticket-sla',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    return 0;
  }
}