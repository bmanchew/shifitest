import { OpenAIService } from './openai';
import { logger } from './logger';
import { ticketCategoryEnum, ticketPriorityEnum } from '../../shared/schema';

// Type for AI categorization response
export interface AICategorization {
  category: string | null;
  priority: string | null;
  confidence: {
    category: number;
    priority: number;
  };
  explanation: string | null;
  tags?: string[];
}

/**
 * Service to handle AI-powered ticket categorization
 */
export class TicketCategorizationService {
  private openaiService: OpenAIService;
  private validCategories: string[];
  private validPriorities: string[];

  constructor() {
    this.openaiService = new OpenAIService();
    // Extract enum values for validation
    this.validCategories = ticketCategoryEnum.enumValues;
    this.validPriorities = ticketPriorityEnum.enumValues;
  }

  /**
   * Categorize a ticket using AI
   * @param subject The ticket subject
   * @param description The ticket description
   * @returns AI categorization suggestion
   */
  async categorizeTicket(subject: string, description: string): Promise<AICategorization | null> {
    try {
      if (!this.openaiService.isInitialized()) {
        logger.warn({
          message: 'Cannot categorize ticket: OpenAI service not initialized',
          category: 'support',
          source: 'internal'
        });
        return null;
      }

      const client = this.openaiService.getClient();
      if (!client) {
        logger.warn({
          message: 'Cannot categorize ticket: OpenAI client unavailable',
          category: 'support',
          source: 'internal'
        });
        return null;
      }

      // Prepare system message with context about the ticket categories and priorities
      const systemMessage = `
        You are an AI assistant helping to categorize support tickets for a financial technology platform focused on merchant financing solutions.
        
        Here are the valid ticket categories:
        - accounting: Issues related to accounting, financial reporting, or payment reconciliation
        - customer_issue: Problems reported by a merchant's customers
        - technical_issue: Technical problems with the platform, APIs, or integrations
        - payment_processing: Issues with payment processing, transactions, or fund transfers
        - contract_management: Questions or issues related to contract terms, renewals, or modifications
        - funding: Issues related to financing, loans, or capital access
        - api_integration: Problems with API integration, developer tools, or documentation
        - security: Security concerns, login issues, or data protection questions
        - other: Miscellaneous issues that don't fit other categories
        
        Here are the valid ticket priorities:
        - low: Non-urgent issues that can be addressed when time permits
        - normal: Standard issues that should be addressed in the normal course of business
        - high: Important issues that require prompt attention
        - urgent: Critical issues that require immediate attention
        
        Based on the ticket subject and description, you must:
        1. Determine the most appropriate category from the valid options
        2. Determine the most appropriate priority from the valid options
        3. Provide a confidence score (0-100) for each determination
        4. Provide a brief explanation for your choices
        5. Suggest relevant tags that might help with ticket routing and analytics
        
        Return ONLY a valid category and priority from the options listed above.
      `;

      // Make completion request to OpenAI
      const response = await client.chat.completions.create({
        model: 'gpt-3.5-turbo', // Using 3.5 for cost efficiency, can be upgraded to 4 if needed
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: `Please categorize this ticket:\nSubject: ${subject}\nDescription: ${description}` }
        ],
        temperature: 0.3, // Lower temperature for more deterministic responses
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      // Parse the response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      try {
        const parsedResponse = JSON.parse(content);
        
        // Validate the response
        const category = this.validCategories.includes(parsedResponse.category) 
          ? parsedResponse.category 
          : null;
          
        const priority = this.validPriorities.includes(parsedResponse.priority) 
          ? parsedResponse.priority 
          : null;

        // Create normalized confidence scores (0-100)
        const categoryConfidence = Math.min(Math.max(parsedResponse.confidence?.category || 0, 0), 100);
        const priorityConfidence = Math.min(Math.max(parsedResponse.confidence?.priority || 0, 0), 100);

        return {
          category,
          priority,
          confidence: {
            category: categoryConfidence,
            priority: priorityConfidence
          },
          explanation: parsedResponse.explanation || null,
          tags: Array.isArray(parsedResponse.tags) ? parsedResponse.tags : []
        };
      } catch (parseError) {
        logger.error({
          message: `Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          category: 'support',
          source: 'internal',
          metadata: {
            subject,
            error: parseError instanceof Error ? parseError.stack : null,
            response: content
          }
        });
        return null;
      }
    } catch (error) {
      logger.error({
        message: `Failed to categorize ticket: ${error instanceof Error ? error.message : String(error)}`,
        category: 'support',
        source: 'internal',
        metadata: {
          subject,
          error: error instanceof Error ? error.stack : null
        }
      });
      return null;
    }
  }
}

// Export an instance of the service
export const ticketCategorizationService = new TicketCategorizationService();