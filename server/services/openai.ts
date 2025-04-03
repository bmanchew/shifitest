import OpenAI from "openai";
import { logger } from './logger';

/**
 * Service to generate AI-powered financial insights and suggestions using OpenAI's GPT models
 */
export class OpenAIService {
  private client: OpenAI | null = null;
  private initialized = false;
  private model = "gpt-3.5-turbo";  // Default model
  private gpt4oModel = "gpt-4o";    // GPT-4o model for code analysis

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the OpenAI client with API key from environment variables
   */
  private initialize() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        logger.warn({
          message: 'OpenAI API key not found in environment variables',
          category: 'system',
          source: 'internal'
        });
        return;
      }

      this.client = new OpenAI({
        apiKey: apiKey
      });

      this.initialized = true;

      logger.info({
        message: 'OpenAI service initialized successfully',
        category: 'system',
        source: 'internal'
      });
    } catch (error) {
      logger.error({
        message: `Failed to initialize OpenAI service: ${error instanceof Error ? error.message : String(error)}`,
        category: 'system',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
    }
  }

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }
  
  /**
   * Get the OpenAI client instance
   */
  getClient(): OpenAI | null {
    return this.client;
  }
  
  /**
   * Get the model being used
   */
  getModel(): string {
    return this.model;
  }
  
  /**
   * Analyze code using GPT-4o
   * @param code The code to analyze
   * @param instructions Specific instructions for the analysis
   * @returns Analysis results as string
   */
  async analyzeCode(code: string, instructions: string = "Review this code and provide feedback"): Promise<string> {
    if (!this.isInitialized()) {
      logger.warn({
        message: 'Cannot analyze code: OpenAI service not initialized',
        category: 'api',
        source: 'internal'
      });
      return "Error: OpenAI service not initialized";
    }

    try {
      const prompt = `${instructions}\n\n\`\`\`\n${code}\n\`\`\``;
      
      logger.info({
        message: 'Analyzing code with GPT-4o',
        category: 'api',
        source: 'openai'
      });
      
      const response = await this.client!.chat.completions.create({
        model: this.gpt4oModel,
        messages: [
          {
            role: "system", 
            content: "You are a senior software engineer specializing in code review and analysis. Provide clear, concise, and actionable feedback."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more focused analysis
        max_tokens: 2000
      });
      
      return response.choices[0].message.content || "No analysis returned";
    } catch (error) {
      logger.error({
        message: `Error analyzing code with GPT-4o: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'openai',
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
      return `Error analyzing code: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Generate personalized financial insights based on customer data
   * @param customerData Object containing relevant customer financial data
   * @returns Array of personalized financial insights
   */
  /**
   * Analyze a file using GPT-4o
   * @param filePath Path to the file
   * @param instructions Specific instructions for the analysis
   * @returns Analysis results as string
   */
  async analyzeFile(filePath: string, instructions: string = "Review this file and provide feedback"): Promise<string> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Safety check for path
      const normalizedPath = path.normalize(filePath);
      
      // Check if file exists
      if (!fs.existsSync(normalizedPath)) {
        return `Error: File not found at ${normalizedPath}`;
      }
      
      // Read file content
      const fileContent = fs.readFileSync(normalizedPath, 'utf8');
      const fileExtension = path.extname(normalizedPath);
      
      // Get file name for context
      const fileName = path.basename(normalizedPath);
      
      // Add file metadata to instructions
      const enhancedInstructions = `${instructions}\n\nFile: ${fileName}\nExtension: ${fileExtension}`;
      
      // Use the analyzeCode method
      return await this.analyzeCode(fileContent, enhancedInstructions);
    } catch (error) {
      logger.error({
        message: `Error analyzing file with GPT-4o: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'openai',
        metadata: {
          filePath,
          error: error instanceof Error ? error.stack : null
        }
      });
      return `Error analyzing file: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async generateFinancialInsights(customerData: any): Promise<any[]> {
    if (!this.isInitialized()) {
      logger.warn({
        message: 'Cannot generate insights: OpenAI service not initialized',
        category: 'api',
        source: 'internal'
      });
      return [];
    }

    try {
      // Create a prompt that describes the task and includes relevant customer data
      const prompt = this.createFinancialInsightsPrompt(customerData);

      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are a financial advisor specializing in personal finance management, debt reduction, and wealth building. Provide actionable, personalized insights based on real financial data.",
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0].message.content;
      
      if (!response) {
        throw new Error('Empty response from OpenAI API');
      }

      // Parse the JSON response
      const parsedResponse = JSON.parse(response);
      
      logger.info({
        message: 'Successfully generated AI financial insights',
        category: 'api',
        source: 'internal',
        metadata: {
          insightsCount: parsedResponse.insights ? parsedResponse.insights.length : 0
        }
      });

      return parsedResponse.insights || [];
    } catch (error) {
      logger.error({
        message: `Failed to generate financial insights: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
      return [];
    }
  }

  /**
   * Generate personalized financial suggestions based on customer data
   * @param customerData Object containing relevant customer financial data
   * @returns Array of personalized financial suggestions
   */
  async generateFinancialSuggestions(customerData: any): Promise<any[]> {
    if (!this.isInitialized()) {
      logger.warn({
        message: 'Cannot generate suggestions: OpenAI service not initialized',
        category: 'api',
        source: 'internal'
      });
      return [];
    }

    try {
      // Create a prompt that describes the task and includes relevant customer data
      const prompt = this.createFinancialSuggestionsPrompt(customerData);

      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are a financial advisor specializing in personal finance management, debt reduction, and wealth building. Provide actionable, personalized suggestions based on real financial data.",
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0].message.content;
      
      if (!response) {
        throw new Error('Empty response from OpenAI API');
      }

      // Parse the JSON response
      const parsedResponse = JSON.parse(response);
      
      logger.info({
        message: 'Successfully generated AI financial suggestions',
        category: 'api',
        source: 'internal',
        metadata: {
          suggestionsCount: parsedResponse.suggestions ? parsedResponse.suggestions.length : 0
        }
      });

      return parsedResponse.suggestions || [];
    } catch (error) {
      logger.error({
        message: `Failed to generate financial suggestions: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
      return [];
    }
  }

  /**
   * Create a prompt for generating financial insights
   * @param customerData Object containing customer financial data
   * @returns String prompt for the AI model
   */
  private createFinancialInsightsPrompt(customerData: any): string {
    // Extract relevant data for the prompt
    const {
      contracts = [],
      accounts = [],
      cashFlow = {},
      upcomingBills = [],
      recentTransactions = []
    } = customerData;

    // Active contracts summary
    const activeContracts = contracts.filter((c: any) => c.status === 'active');
    const contractsSummary = activeContracts.map((c: any) => {
      return {
        amount: c.financedAmount,
        monthlyPayment: c.monthlyPayment,
        remainingMonths: c.termMonths - Math.floor(
          (Date.now() - new Date(c.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000)
        ),
        interestRate: c.interestRate
      };
    });

    // Account balances summary
    const accountSummary = accounts.map((a: any) => {
      return {
        type: a.type,
        balance: a.balances.available || a.balances.current
      };
    });

    // Cash flow data
    const cashFlowData = {
      monthlyIncome: cashFlow.monthlyIncome || 0,
      monthlyExpenses: cashFlow.monthlyExpenses || 0,
      netCashFlow: cashFlow.netCashFlow || 0
    };

    // Format the prompt with this data
    return `
Analyze the following financial data and generate 3-5 insightful observations (not suggestions) about this customer's financial situation. 
Focus on patterns, potential issues, opportunities for improvement, and notable financial behaviors.

Return your response as a JSON object with an "insights" array where each item has "title" and "description" fields.

CUSTOMER FINANCIAL DATA:
Contracts: ${JSON.stringify(contractsSummary)}
Account Balances: ${JSON.stringify(accountSummary)}
Cash Flow: ${JSON.stringify(cashFlowData)}
Upcoming Bills Count: ${upcomingBills.length}
Recent Transactions Count: ${recentTransactions.length}
`;
  }

  /**
   * Create a prompt for generating financial suggestions
   * @param customerData Object containing customer financial data
   * @returns String prompt for the AI model
   */
  private createFinancialSuggestionsPrompt(customerData: any): string {
    // Extract relevant data for the prompt
    const {
      contracts = [],
      accounts = [],
      cashFlow = {},
      upcomingBills = [],
      recentTransactions = []
    } = customerData;

    // Active contracts summary
    const activeContracts = contracts.filter((c: any) => c.status === 'active');
    const contractsSummary = activeContracts.map((c: any) => {
      return {
        amount: c.financedAmount,
        monthlyPayment: c.monthlyPayment,
        remainingMonths: c.termMonths - Math.floor(
          (Date.now() - new Date(c.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000)
        ),
        interestRate: c.interestRate
      };
    });

    // Account balances summary
    const accountSummary = accounts.map((a: any) => {
      return {
        type: a.type,
        balance: a.balances.available || a.balances.current
      };
    });

    // Cash flow data
    const cashFlowData = {
      monthlyIncome: cashFlow.monthlyIncome || 0,
      monthlyExpenses: cashFlow.monthlyExpenses || 0,
      netCashFlow: cashFlow.netCashFlow || 0,
      topSpendingCategories: cashFlow.categories || []
    };

    // Format the prompt with this data
    return `
Based on the following financial data, generate 3-5 actionable, personalized suggestions to help improve this customer's financial situation.
Focus on practical advice for managing debt, improving cash flow, optimizing savings, and building financial stability.

Return your response as a JSON object with a "suggestions" array where each item has "title", "description", and optionally "actionText" fields.

CUSTOMER FINANCIAL DATA:
Contracts: ${JSON.stringify(contractsSummary)}
Account Balances: ${JSON.stringify(accountSummary)}
Cash Flow: ${JSON.stringify(cashFlowData)}
Upcoming Bills Count: ${upcomingBills.length}
Recent Transactions Count: ${recentTransactions.length}
`;
  }
}

export const openaiService = new OpenAIService();