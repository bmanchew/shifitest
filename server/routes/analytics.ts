import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../services/logger';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Get ticket analytics data
 */
router.get("/tickets", async (req: Request, res: Response) => {
  try {
    const { merchantId, startDate, endDate, groupBy } = req.query;
    
    // Validate query parameters
    const parsedMerchantId = merchantId ? parseInt(merchantId as string) : undefined;
    const parsedStartDate = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    const parsedEndDate = endDate ? new Date(endDate as string) : new Date();
    const parsedGroupBy = (groupBy as string) || 'day'; // Default to daily grouping
    
    // Get all tickets within date range
    let tickets = await storage.getAllSupportTickets();
    
    // Filter by date range
    tickets = tickets.filter(ticket => {
      const ticketDate = new Date(ticket.createdAt);
      return ticketDate >= parsedStartDate && ticketDate <= parsedEndDate;
    });
    
    // Filter by merchant if specified
    if (parsedMerchantId) {
      tickets = tickets.filter(ticket => ticket.merchantId === parsedMerchantId);
    }
    
    // Calculate analytics data
    const analytics = {
      totalTickets: tickets.length,
      ticketsByStatus: calculateTicketsByStatus(tickets),
      ticketsByCategory: calculateTicketsByCategory(tickets),
      ticketsByPriority: calculateTicketsByPriority(tickets),
      responseTimeAverage: calculateAverageResponseTime(tickets),
      resolutionTimeAverage: calculateAverageResolutionTime(tickets),
      ticketsOverTime: groupTicketsOverTime(tickets, parsedGroupBy),
    };
    
    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving ticket analytics: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "analytics",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve ticket analytics"
    });
  }
});

/**
 * Get agent performance analytics data
 */
router.get("/agents", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Validate query parameters
    const parsedStartDate = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    const parsedEndDate = endDate ? new Date(endDate as string) : new Date();
    
    // Get all support agents
    const agents = await storage.getAllSupportAgents();
    if (!agents || agents.length === 0) {
      return res.json({
        success: true,
        analytics: {
          agents: [],
          totalAgents: 0,
          averageTicketsResolved: 0,
          averageResponseTime: 0,
          averageResolutionTime: 0
        }
      });
    }
    
    // Get all tickets within date range
    let tickets = await storage.getAllSupportTickets();
    tickets = tickets.filter(ticket => {
      const ticketDate = new Date(ticket.createdAt);
      return ticketDate >= parsedStartDate && ticketDate <= parsedEndDate;
    });
    
    // Calculate agent performance metrics
    const agentPerformance = agents.map(agent => {
      const agentTickets = tickets.filter(ticket => ticket.assignedTo === agent.id);
      const resolvedTickets = agentTickets.filter(ticket => 
        ticket.status === 'resolved' || ticket.status === 'closed'
      );
      
      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        ticketsAssigned: agentTickets.length,
        ticketsResolved: resolvedTickets.length,
        averageResponseTime: calculateAgentAverageResponseTime(agentTickets),
        averageResolutionTime: calculateAgentAverageResolutionTime(resolvedTickets),
        slaCompliance: calculateAgentSlaCompliance(agentTickets)
      };
    });
    
    // Calculate overall metrics
    const totalTicketsResolved = agentPerformance.reduce((sum, agent) => sum + agent.ticketsResolved, 0);
    const totalAgents = agents.length;
    const averageTicketsResolved = totalAgents > 0 ? totalTicketsResolved / totalAgents : 0;
    
    // Response time average across all agents
    const allResponseTimes = agentPerformance
      .map(agent => agent.averageResponseTime)
      .filter(time => time !== null && time !== undefined) as number[];
    const averageResponseTime = allResponseTimes.length > 0 
      ? allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length 
      : 0;
    
    // Resolution time average across all agents
    const allResolutionTimes = agentPerformance
      .map(agent => agent.averageResolutionTime)
      .filter(time => time !== null && time !== undefined) as number[];
    const averageResolutionTime = allResolutionTimes.length > 0 
      ? allResolutionTimes.reduce((sum, time) => sum + time, 0) / allResolutionTimes.length 
      : 0;
    
    res.json({
      success: true,
      analytics: {
        agents: agentPerformance,
        totalAgents,
        averageTicketsResolved,
        averageResponseTime,
        averageResolutionTime
      }
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving agent analytics: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "analytics",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve agent analytics"
    });
  }
});

// Helper functions for analytics calculations
function calculateTicketsByStatus(tickets: any[]) {
  const statusCounts: Record<string, number> = {};
  tickets.forEach(ticket => {
    statusCounts[ticket.status] = (statusCounts[ticket.status] || 0) + 1;
  });
  return statusCounts;
}

function calculateTicketsByCategory(tickets: any[]) {
  const categoryCounts: Record<string, number> = {};
  tickets.forEach(ticket => {
    categoryCounts[ticket.category] = (categoryCounts[ticket.category] || 0) + 1;
  });
  return categoryCounts;
}

function calculateTicketsByPriority(tickets: any[]) {
  const priorityCounts: Record<string, number> = {};
  tickets.forEach(ticket => {
    priorityCounts[ticket.priority] = (priorityCounts[ticket.priority] || 0) + 1;
  });
  return priorityCounts;
}

function calculateAverageResponseTime(tickets: any[]) {
  // Calculate average time between ticket creation and first response
  const ticketsWithResponses = tickets.filter(ticket => ticket.firstResponseAt);
  if (ticketsWithResponses.length === 0) return null;
  
  const totalResponseTime = ticketsWithResponses.reduce((sum, ticket) => {
    const createdAt = new Date(ticket.createdAt).getTime();
    const firstResponseAt = new Date(ticket.firstResponseAt).getTime();
    return sum + (firstResponseAt - createdAt);
  }, 0);
  
  return totalResponseTime / ticketsWithResponses.length / (60 * 60 * 1000); // Convert to hours
}

function calculateAverageResolutionTime(tickets: any[]) {
  // Calculate average time between ticket creation and resolution
  const resolvedTickets = tickets.filter(ticket => 
    ticket.status === 'resolved' || ticket.status === 'closed'
  );
  if (resolvedTickets.length === 0) return null;
  
  const totalResolutionTime = resolvedTickets.reduce((sum, ticket) => {
    const createdAt = new Date(ticket.createdAt).getTime();
    const resolvedAt = ticket.resolvedAt 
      ? new Date(ticket.resolvedAt).getTime() 
      : new Date(ticket.updatedAt).getTime();
    return sum + (resolvedAt - createdAt);
  }, 0);
  
  return totalResolutionTime / resolvedTickets.length / (60 * 60 * 1000); // Convert to hours
}

function groupTicketsOverTime(tickets: any[], groupBy: string) {
  const timeGroups: Record<string, number> = {};
  
  tickets.forEach(ticket => {
    const date = new Date(ticket.createdAt);
    let groupKey;
    
    switch(groupBy) {
      case 'hour':
        groupKey = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:00`;
        break;
      case 'day':
        groupKey = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
        break;
      case 'week':
        // Get the first day of the week (Sunday)
        const firstDay = new Date(date);
        const day = date.getDay();
        const diff = date.getDate() - day;
        firstDay.setDate(diff);
        groupKey = `Week of ${firstDay.getFullYear()}-${firstDay.getMonth()+1}-${firstDay.getDate()}`;
        break;
      case 'month':
        groupKey = `${date.getFullYear()}-${date.getMonth()+1}`;
        break;
      default:
        groupKey = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
    }
    
    timeGroups[groupKey] = (timeGroups[groupKey] || 0) + 1;
  });
  
  // Convert to array format for charting
  return Object.entries(timeGroups).map(([label, count]) => ({
    label,
    count
  })).sort((a, b) => a.label.localeCompare(b.label));
}

function calculateAgentAverageResponseTime(tickets: any[]) {
  return calculateAverageResponseTime(tickets);
}

function calculateAgentAverageResolutionTime(tickets: any[]) {
  return calculateAverageResolutionTime(tickets);
}

function calculateAgentSlaCompliance(tickets: any[]) {
  if (tickets.length === 0) return 100; // If no tickets, compliance is 100%
  
  // Count tickets that met SLA
  const ticketsMetSla = tickets.filter(ticket => {
    // For simplicity, we'll check if the ticket was responded to within SLA
    if (!ticket.firstResponseAt || !ticket.slaResponseTime) return false;
    
    const createdAt = new Date(ticket.createdAt).getTime();
    const firstResponseAt = new Date(ticket.firstResponseAt).getTime();
    const responseTimeMs = firstResponseAt - createdAt;
    const slaResponseTimeMs = ticket.slaResponseTime * 60 * 60 * 1000; // Convert hours to ms
    
    return responseTimeMs <= slaResponseTimeMs;
  });
  
  return (ticketsMetSla.length / tickets.length) * 100;
}

export default router;