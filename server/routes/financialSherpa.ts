/**
 * AI Financial Sherpa API Routes
 * 
 * Integrates Plaid financial data, OpenAI analysis, and SesameAI voice generation
 * to provide comprehensive financial guidance for customers.
 */

import { Router } from 'express';
import { plaidService } from '../services/plaid';
import { openaiService } from '../services/openai';
import { sesameAIService } from '../services/sesameai';
import { logger } from '../services/logger';
import { storage } from '../storage';

// Type definitions for the financial sherpa functionality
interface Category {
  name: string;
  amount: number;
}

interface CashFlow {
  monthlyIncome: number;
  monthlyExpenses: number;
  netCashFlow: number;
  categories: Category[];
}

interface UpcomingBill {
  name: string;
  amount: number;
  dueDate: string;
  category: string;
}

const router = Router();

/**
 * @route GET /api/financial-sherpa/insights/:customerId
 * @description Get AI-powered financial insights with voice narration capabilities
 * @access Private
 */
router.get('/insights/:customerId', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }
    
    logger.info({
      message: `Getting AI Financial Sherpa insights for customer ${customerId}`,
      category: 'api',
      source: 'internal',
      metadata: { customerId }
    });
    
    // 1. Get customer's contract details
    const contracts = await storage.getContractsByCustomerId(customerId);
    
    if (!contracts || contracts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No contracts found for customer'
      });
    }
    
    // Use the most recent active contract
    const activeContracts = contracts.filter(c => c.status === 'active' || c.status === 'pending');
    
    if (activeContracts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active contracts found for customer'
      });
    }
    
    const contract = activeContracts[0];
    
    // 2. Check if customer has Plaid data available
    const contractAssetReports = await storage.getAssetReportsByContractId(contract.id);
    
    // If no asset reports, return early with status
    if (!contractAssetReports || contractAssetReports.length === 0) {
      return res.json({
        success: true,
        hasPlaidData: false,
        insights: [],
        message: 'Bank connection required for AI Financial Sherpa'
      });
    }
    
    // Get most recent asset report with analysis data
    const latestReport = contractAssetReports
      .filter(report => report.analysisData)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
    
    if (!latestReport || !latestReport.analysisData) {
      return res.json({
        success: true,
        hasPlaidData: false,
        insights: [],
        message: 'Plaid data analysis not available yet'
      });
    }
    
    // Parse analysis data
    const analysisData = typeof latestReport.analysisData === 'string' 
      ? JSON.parse(latestReport.analysisData) 
      : latestReport.analysisData;
    
    // 3. Prepare the financial data for AI analysis
    const accounts: any[] = [];
    const transactions: any[] = [];
    let cashFlow: CashFlow = {
      monthlyIncome: 0,
      monthlyExpenses: 0,
      netCashFlow: 0,
      categories: []
    };
    
    const upcomingBills: UpcomingBill[] = [];
    
    // Process each item (institution)
    if (analysisData.items && analysisData.items.length > 0) {
      for (const item of analysisData.items) {
        // Process accounts in this item
        if (item.accounts && item.accounts.length > 0) {
          accounts.push(...item.accounts);
          
          // Extract transactions from each account
          for (const account of item.accounts) {
            if (account.transactions && account.transactions.length > 0) {
              transactions.push(...account.transactions);
            }
          }
        }
        
        // Extract income streams for cash flow analysis
        if (item.income_streams && item.income_streams.length > 0) {
          // Sum up all income streams with good confidence
          const confidentStreams = item.income_streams.filter(
            (stream: any) => stream.confidence > 0.5
          );
          
          cashFlow.monthlyIncome = confidentStreams.reduce(
            (sum: number, stream: any) => sum + (stream.monthly_income || 0),
            0
          );
        }
      }
    }
    
    // Calculate basic expense metrics from transactions
    if (transactions.length > 0) {
      // Group transactions by category and sum amounts
      const categorySums: Record<string, number> = {};
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentTransactions = transactions.filter(
        (t: any) => new Date(t.date) >= thirtyDaysAgo && t.amount > 0
      );
      
      for (const transaction of recentTransactions) {
        if (transaction.category && transaction.category.length > 0) {
          const mainCategory = transaction.category[0];
          categorySums[mainCategory] = (categorySums[mainCategory] || 0) + transaction.amount;
        }
      }
      
      // Convert to array of categories
      const categoryArray: Category[] = Object.entries(categorySums).map(([name, amount]) => ({
        name,
        amount: amount as number
      }));
      
      // Sort by amount spent
      categoryArray.sort((a, b) => b.amount - a.amount);
      
      // Set expense metrics
      cashFlow.categories = categoryArray;
      cashFlow.monthlyExpenses = categoryArray.reduce(
        (sum: number, category: Category) => sum + (category.amount || 0),
        0
      );
      cashFlow.netCashFlow = cashFlow.monthlyIncome - cashFlow.monthlyExpenses;
    }
    
    // 4. Get upcoming bills from recurring transactions
    if (analysisData.items) {
      for (const item of analysisData.items) {
        if (item.recurring_transactions) {
          for (const recurring of item.recurring_transactions) {
            if (recurring.next_payment_date) {
              upcomingBills.push({
                name: recurring.merchant_name || recurring.description || 'Recurring Payment',
                amount: recurring.amount,
                dueDate: recurring.next_payment_date,
                category: recurring.category ? recurring.category[0] : 'Other'
              });
            }
          }
        }
      }
    }
    
    // Sort bills by due date
    upcomingBills.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    
    // 5. Prepare complete financial data for OpenAI analysis
    const financialData = {
      contracts: [contract],
      accounts,
      cashFlow,
      upcomingBills,
      recentTransactions: transactions.slice(0, 30) // Use most recent 30 transactions
    };
    
    // 6. Generate insights using OpenAI
    logger.info({
      message: `Generating OpenAI insights for customer ${customerId}`,
      category: 'api',
      source: 'openai',
      metadata: { 
        customerId,
        accountsCount: accounts.length,
        transactionsCount: transactions.length
      }
    });
    
    const insights = await openaiService.generateFinancialInsights(financialData);
    
    if (!insights || insights.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate insights from financial data'
      });
    }
    
    // 7. Prepare the response
    const response = {
      success: true,
      hasPlaidData: true,
      usingAI: true,
      insights: insights.map((insight, index) => ({
        id: `insight-${index}-${Date.now()}`,
        title: insight.title,
        description: insight.description,
        category: determineCategory(insight.title, insight.description),
        impact: determineImpact(insight.title, insight.description)
      })),
      financialSummary: {
        cashFlow,
        accountsCount: accounts.length,
        upcomingBillsCount: upcomingBills.length
      }
    };
    
    return res.json(response);
  } catch (error: any) {
    logger.error({
      message: `Error generating AI Financial Sherpa insights: ${error.message}`,
      category: 'api',
      source: 'internal',
      metadata: { error: error.stack }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate financial insights'
    });
  }
});

/**
 * @route POST /api/financial-sherpa/voice-insight
 * @description Generate voice narration for a specific insight
 * @access Private
 */
router.post('/voice-insight', async (req, res) => {
  try {
    const { insightId, text, speaker = 0 } = req.body;
    
    if (!insightId || !text) {
      return res.status(400).json({
        success: false,
        error: 'Insight ID and text are required'
      });
    }
    
    logger.info({
      message: `Generating voice for financial insight: ${insightId}`,
      category: 'api',
      source: 'sesameai',
      metadata: { insightId, textLength: text.length }
    });
    
    // Generate voice using SesameAI
    const audioPath = await sesameAIService.generateVoice({
      text,
      speaker,
      outputPath: `public/audio/insights/insight-${insightId}-${Date.now()}.wav`
    });
    
    return res.json({
      success: true,
      audioUrl: audioPath
    });
  } catch (error: any) {
    logger.error({
      message: `Error generating voice for insight: ${error.message}`,
      category: 'api',
      source: 'sesameai',
      metadata: { error: error.stack }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate voice for insight'
    });
  }
});

/**
 * Determine the appropriate category for an insight based on its content
 */
function determineCategory(title: string, description: string): 'spending' | 'saving' | 'investment' | 'debt' {
  const combined = (title + ' ' + description).toLowerCase();
  
  if (combined.includes('debt') || combined.includes('loan') || combined.includes('payment') || 
      combined.includes('interest') || combined.includes('credit')) {
    return 'debt';
  } else if (combined.includes('invest') || combined.includes('portfolio') || combined.includes('market')) {
    return 'investment';
  } else if (combined.includes('save') || combined.includes('saving') || combined.includes('emergency fund')) {
    return 'saving';
  } else {
    return 'spending';
  }
}

/**
 * Determine the impact level of an insight based on its content
 */
function determineImpact(title: string, description: string): 'high' | 'medium' | 'low' {
  const combined = (title + ' ' + description).toLowerCase();
  
  // High impact keywords
  if (combined.includes('urgent') || combined.includes('critical') || 
      combined.includes('immediately') || combined.includes('significant')) {
    return 'high';
  }
  
  // Medium impact keywords
  if (combined.includes('recommend') || combined.includes('consider') || 
      combined.includes('opportunity') || combined.includes('potential')) {
    return 'medium';
  }
  
  // Default to low impact
  return 'low';
}

/**
 * Register Financial Sherpa routes with the provided router
 * @param apiRouter Express Router instance to mount routes on
 */
function registerFinancialSherpaRoutes(apiRouter: Router) {
  apiRouter.use('/financial-sherpa', router);
}

export default registerFinancialSherpaRoutes;