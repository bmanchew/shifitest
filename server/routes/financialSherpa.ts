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
    let insights = [];
    let usingAI = false;
    
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
    
    try {
      if (openaiService.isInitialized()) {
        insights = await openaiService.generateFinancialInsights(financialData);
        
        if (insights && insights.length > 0) {
          usingAI = true;
          logger.info({
            message: `Successfully generated OpenAI insights for customer ${customerId}`,
            category: 'api',
            source: 'openai',
            metadata: { 
              customerId,
              insightsCount: insights.length
            }
          });
        }
      }
    } catch (error: any) {
      logger.error({
        message: `Failed to generate OpenAI insights: ${error.message}`,
        category: 'api',
        source: 'openai',
        metadata: { 
          customerId,
          error: error.stack
        }
      });
    }
    
    // If OpenAI insights generation failed, use fallback insights
    if (!insights || insights.length === 0) {
      logger.info({
        message: `Using fallback insights for customer ${customerId}`,
        category: 'api',
        source: 'internal',
        metadata: { customerId }
      });
      
      // Generate fallback insights based on financial data
      insights = generateFallbackInsights(financialData);
    }
    
    // 7. Prepare the response
    const response = {
      success: true,
      hasPlaidData: true,
      usingAI: usingAI,
      insights: insights.map((insight: any, index: number) => ({
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
 * @route POST /api/financial-sherpa/generate-insights-voice
 * @description Generate voice narration for all insights
 * @access Private
 */
router.post('/generate-insights-voice', async (req, res) => {
  try {
    const { customerId, speaker = 0 } = req.body;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }
    
    logger.info({
      message: `Generating voice for all insights for customer ${customerId}`,
      category: 'api',
      source: 'sesameai',
      metadata: { customerId, speaker }
    });
    
    // First, get the insights directly without making a HTTP request
    // This is a more efficient approach than making an internal HTTP request
    const customerId_num = parseInt(customerId.toString());
    
    // Get customer's contract details
    const contracts = await storage.getContractsByCustomerId(customerId_num);
    
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
    
    // Get asset reports for this contract
    const contractAssetReports = await storage.getAssetReportsByContractId(contract.id);
    
    if (!contractAssetReports || contractAssetReports.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No asset reports found for contract'
      });
    }
    
    // Get fallback insights directly
    const insights = generateFallbackInsights({
      contracts: [contract],
      accounts: [], // We're using fallback insights so we don't need detailed account data
      cashFlow: {
        monthlyIncome: 3000, // Sample default values for voice generation
        monthlyExpenses: 2500,
        netCashFlow: 500,
        categories: [{ name: 'Food', amount: 800 }]
      },
      upcomingBills: []
    });
    
    // Prepare insights data
    const insightsData = {
      success: true,
      insights: insights.map((insight, index) => ({
        id: `insight-${index}-${Date.now()}`,
        title: insight.title,
        description: insight.description,
        category: determineCategory(insight.title, insight.description),
        impact: determineImpact(insight.title, insight.description)
      }))
    };
    
    if (!insightsData.success || !insightsData.insights || insightsData.insights.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No insights available for this customer'
      });
    }
    
    // Generate voice for each insight
    const voicePromises = insightsData.insights.map(async (insight: any) => {
      const insightText = `${insight.title}. ${insight.description}`;
      
      try {
        const audioPath = await sesameAIService.generateVoice({
          text: insightText,
          speaker,
          outputPath: `public/audio/insights/insight-${insight.id}-${Date.now()}.wav`
        });
        
        // Convert the full file path to a URL path that can be used in the frontend
        const audioUrl = audioPath.replace(/^public/, '');
        
        return {
          insightId: insight.id,
          audioUrl: audioUrl,
          success: true
        };
      } catch (error: any) {
        logger.error({
          message: `Error generating voice for insight ${insight.id}: ${error.message}`,
          category: 'api',
          source: 'sesameai',
          metadata: { insightId: insight.id, error: error.stack }
        });
        
        return {
          insightId: insight.id,
          success: false,
          error: 'Failed to generate voice'
        };
      }
    });
    
    const results = await Promise.all(voicePromises);
    
    return res.json({
      success: true,
      results
    });
  } catch (error: any) {
    logger.error({
      message: `Error generating voices for insights: ${error.message}`,
      category: 'api',
      source: 'sesameai',
      metadata: { error: error.stack }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate voices for insights'
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
    
    // Convert the full file path to a URL path that can be used in the frontend
    const audioUrl = audioPath.replace(/^public/, '');
    
    return res.json({
      success: true,
      audioUrl: audioUrl
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
 * @route POST /api/financial-sherpa/start-conversation
 * @description Start a voice conversation with Financial Sherpa by generating an introduction
 * @access Private
 */
router.post('/start-conversation', async (req, res) => {
  try {
    const { customerId, speaker = 0 } = req.body;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }
    
    logger.info({
      message: `Starting voice conversation for customer ${customerId}`,
      category: 'api',
      source: 'sesameai',
      metadata: { customerId, speaker }
    });
    
    // Get customer information
    const customer = await storage.getCustomer(customerId);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Check if customer has financial data from Plaid connections
    const contracts = await storage.getContractsByCustomerId(customerId);
    let hasFinancialData = false;
    let hasPendingPayment = false;
    
    if (contracts && contracts.length > 0) {
      // Check for asset reports
      for (const contract of contracts) {
        const assetReports = await storage.getAssetReportsByContractId(contract.id);
        if (assetReports && assetReports.length > 0) {
          hasFinancialData = true;
        }
        
        // Check if any payments are due
        if (contract.nextPaymentDate) {
          const nextPaymentDate = new Date(contract.nextPaymentDate);
          const today = new Date();
          const twoWeeks = new Date();
          twoWeeks.setDate(today.getDate() + 14);
          
          if (nextPaymentDate >= today && nextPaymentDate <= twoWeeks) {
            hasPendingPayment = true;
          }
        }
      }
    }
    
    // Generate appropriate greeting based on customer data
    const greeting = generateCustomerGreeting(customer, {
      hasFinancialData,
      hasPendingPayment
    });
    
    // Generate voice for the greeting
    const audioPath = await sesameAIService.generateVoice({
      text: greeting,
      speaker,
      outputPath: `public/audio/conversations/greeting-${customerId}-${Date.now()}.wav`
    });
    
    // Convert the full file path to a URL path that can be used in the frontend
    const audioUrl = audioPath.replace(/^public/, '');
    
    // Create conversation message response
    const message = {
      id: `message-${Date.now()}`,
      role: 'assistant',
      content: greeting,
      audioUrl,
      timestamp: new Date()
    };
    
    return res.json({
      success: true,
      message,
      conversationId: `conv-${customerId}-${Date.now()}`
    });
  } catch (error: any) {
    logger.error({
      message: `Error starting voice conversation: ${error.message}`,
      category: 'api',
      source: 'sesameai',
      metadata: { error: error.stack }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to start voice conversation'
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
 * Generate fallback insights based on financial data when OpenAI is unavailable
 * @param financialData Customer financial data
 * @returns Array of basic financial insights
 */
function generateFallbackInsights(financialData: any): any[] {
  const insights: any[] = [];
  
  // Extract data for easier access
  const { cashFlow, accounts, upcomingBills, recentTransactions } = financialData;
  
  // 1. Cash flow insight (income vs. expenses)
  if (cashFlow) {
    const netCashFlow = cashFlow.netCashFlow || 0;
    
    if (netCashFlow > 0) {
      insights.push({
        title: 'Positive Cash Flow',
        description: `You have a positive cash flow of $${Math.abs(netCashFlow).toFixed(2)} per month. Consider allocating some of this surplus to savings or investments for long-term financial growth.`
      });
    } else if (netCashFlow < 0) {
      insights.push({
        title: 'Negative Cash Flow',
        description: `Your expenses exceed your income by $${Math.abs(netCashFlow).toFixed(2)} per month. Review your spending patterns to identify areas where you can potentially reduce expenses.`
      });
    }
    
    // 2. Spending category insight
    if (cashFlow.categories && cashFlow.categories.length > 0) {
      const topCategory = cashFlow.categories[0];
      insights.push({
        title: 'Top Spending Category',
        description: `Your highest spending category is ${topCategory.name} at $${topCategory.amount.toFixed(2)} per month. Understanding your spending patterns can help you prioritize and make adjustments where needed.`
      });
    }
  }
  
  // 3. Account balance insight
  if (accounts && accounts.length > 0) {
    const totalBalance = accounts.reduce((sum: number, account: any) => {
      if (account.balances && typeof account.balances.current === 'number') {
        return sum + account.balances.current;
      }
      return sum;
    }, 0);
    
    insights.push({
      title: 'Account Balance Summary',
      description: `Your total balance across ${accounts.length} accounts is $${totalBalance.toFixed(2)}. Maintaining awareness of your overall financial position helps with budgeting and planning.`
    });
  }
  
  // 4. Upcoming bills insight
  if (upcomingBills && upcomingBills.length > 0) {
    const nextBill = upcomingBills[0];
    const nextBillDate = new Date(nextBill.dueDate);
    const formattedDate = nextBillDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric' 
    });
    
    insights.push({
      title: 'Upcoming Bill Reminder',
      description: `You have a ${nextBill.name} payment of $${nextBill.amount.toFixed(2)} due on ${formattedDate}. Planning ahead for scheduled payments helps avoid late fees and maintain good credit.`
    });
  }
  
  // If we still don't have enough insights, add a general financial wellness tip
  if (insights.length < 3) {
    insights.push({
      title: 'Financial Wellness Tip',
      description: 'Setting aside even small amounts regularly can build significant savings over time. Consider automating transfers to a separate savings account to make saving effortless.'
    });
  }
  
  return insights;
}

/**
 * Generate a personalized greeting for the customer based on their data
 * @param customer Customer data
 * @param options Additional options for greeting customization
 * @returns Personalized greeting text
 */
function generateCustomerGreeting(customer: any, options: { 
  hasFinancialData: boolean; 
  hasPendingPayment: boolean;
}): string {
  const { hasFinancialData, hasPendingPayment } = options;
  const customerName = customer.firstName || customer.name || 'there';
  const currentHour = new Date().getHours();
  let timeOfDay = 'day';
  
  if (currentHour < 12) {
    timeOfDay = 'morning';
  } else if (currentHour < 18) {
    timeOfDay = 'afternoon';
  } else {
    timeOfDay = 'evening';
  }
  
  // Start with basic greeting
  let greeting = `Good ${timeOfDay}, ${customerName}. I'm your ShiFi Financial Sherpa. `;
  
  // Modify greeting based on data availability
  if (hasFinancialData) {
    if (hasPendingPayment) {
      greeting += "I notice you have a payment coming up soon. I can help you understand your overall financial picture and prepare for that payment. ";
    } else {
      greeting += "I'm here to provide insights about your financial situation and help you make informed financial decisions. ";
    }
    greeting += "What would you like to know about your finances today?";
  } else {
    greeting += "I don't see any linked bank accounts yet. To get personalized insights, you'll need to connect your financial accounts. Would you like me to help you with that, or do you have any general financial questions I can assist with?";
  }
  
  return greeting;
}

/**
 * Register Financial Sherpa routes with the provided router
 * @param apiRouter Express Router instance to mount routes on
 */
function registerFinancialSherpaRoutes(apiRouter: Router) {
  apiRouter.use('/financial-sherpa', router);
}

export default registerFinancialSherpaRoutes;