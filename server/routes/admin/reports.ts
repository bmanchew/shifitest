import { Router } from 'express';
import { storage } from '../../storage';
import { logger } from '../../services/logger';
import { cfpbService } from '../../services/cfpbService';
import { AIAnalyticsService } from '../../services/aiAnalytics';

export const reportsRouter = Router();
const aiAnalyticsService = new AIAnalyticsService();

reportsRouter.get('/portfolio-health', async (req, res) => {
  // In a real application, this would fetch data from a database or other service
  res.json({
    totalContracts: 142,
    totalValue: 3427500,
    avgAPR: 12.8,
    delinquencyRate: 2.4,
    monthlyTrend: [
      { month: 'Jan', rate: 2.1 },
      { month: 'Feb', rate: 2.3 },
      { month: 'Mar', rate: 2.0 },
      { month: 'Apr', rate: 2.2 },
      { month: 'May', rate: 2.3 },
      { month: 'Jun', rate: 2.4 },
    ],
    byProduct: [
      { product: 'Term Loans', contracts: 78, value: 1950000, delinquencyRate: 1.9 },
      { product: 'Lines of Credit', contracts: 42, value: 1050000, delinquencyRate: 2.8 },
      { product: 'Equipment Financing', contracts: 22, value: 427500, delinquencyRate: 3.1 },
    ],
    byRiskCategory: [
      { category: 'Low Risk', contracts: 62, value: 1550000, delinquencyRate: 0.8 },
      { category: 'Medium Risk', contracts: 58, value: 1450000, delinquencyRate: 2.5 },
      { category: 'High Risk', contracts: 22, value: 427500, delinquencyRate: 6.2 },
    ]
  });
});

reportsRouter.get('/complaint-trends', async (req, res) => {
  try {
    logger.info({
      message: 'Fetching complaint trends data',
      category: 'api',
      source: 'reports',
    });

    // Use the AI analytics service to get complaint trends
    const trends = await aiAnalyticsService.analyzeComplaintTrends();

    // Return the results
    res.json(trends);
  } catch (error) {
    logger.error({
      message: `Error fetching complaint trends: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'reports',
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });

    res.status(500).json({ 
      error: 'Failed to fetch complaint trends',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});