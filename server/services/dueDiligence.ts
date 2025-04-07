import OpenAI from 'openai';
import { logger } from './logger';

/**
 * Service for generating AI-based due diligence reports
 * 
 * This service uses OpenAI's GPT-4.5 to analyze merchant data and generate
 * comprehensive due diligence reports for investment and compliance purposes.
 */
class DueDiligenceService {
  private openai: OpenAI | null = null;
  private initialized: boolean = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.warn({
        message: 'DueDiligence service failed to initialize: Missing OpenAI API key',
        category: 'system',
        source: 'internal'
      });
      return;
    }

    this.openai = new OpenAI({
      apiKey: apiKey
    });
    this.initialized = true;
    
    logger.info({
      message: 'DueDiligence service initialized successfully',
      category: 'system',
      source: 'internal'
    });
  }

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.openai !== null;
  }

  /**
   * Generate a due diligence report for a merchant
   * @param merchantData Complete merchant profile data
   * @returns Generated due diligence report or error message
   */
  async generateDueDiligenceReport(merchantData: any): Promise<{ 
    success: boolean; 
    report?: string; 
    error?: string;
    generatedAt?: Date;
  }> {
    if (!this.isInitialized()) {
      return { 
        success: false, 
        error: 'Due diligence service not properly initialized. Missing OpenAI API key.' 
      };
    }

    try {
      // Extract relevant information for the report
      const merchantInfo = this.extractMerchantInfo(merchantData);
      
      // Create the prompt for GPT-4.5
      const prompt = this.createDueDiligencePrompt(merchantInfo);
      
      logger.info({
        message: 'Generating due diligence report',
        category: 'api',
        source: 'internal',
        metadata: {
          merchantId: merchantData.id,
          merchantName: merchantData.name
        }
      });

      // Get response from OpenAI
      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o",  // Using latest GPT-4o model for comprehensive analysis
        messages: [
          {
            role: "system",
            content: "You are an expert financial analyst at a bank specializing in merchant risk assessment for coaching businesses. Your task is to provide a thorough due diligence report that evaluates the merchant's suitability for a partnership where the bank would provide loans to the merchant's clients. Focus on the coaching business model, program details, customer outcomes, refund policies, and sales agreements. Pay special attention to customer feedback, marketing practices, and clear disclosure of terms."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });

      // Extract the generated report from response
      const generatedReport = response.choices[0]?.message?.content || 'Failed to generate report content.';
      
      logger.info({
        message: 'Successfully generated due diligence report',
        category: 'api',
        source: 'internal',
        metadata: {
          merchantId: merchantData.id,
          reportLength: generatedReport.length
        }
      });

      return {
        success: true,
        report: generatedReport,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error({
        message: `Failed to generate due diligence report: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'internal',
        metadata: {
          merchantId: merchantData.id,
          merchantName: merchantData.name,
          error: error instanceof Error ? error.stack : String(error)
        }
      });

      return {
        success: false,
        error: `Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract necessary merchant information for the report
   * @param merchantData Complete merchant data
   * @returns Simplified merchant info for report generation
   */
  private extractMerchantInfo(merchantData: any): any {
    // Extract only the necessary fields to avoid overwhelming the AI model
    return {
      id: merchantData.id,
      name: merchantData.name,
      contactName: merchantData.contactName,
      email: merchantData.email,
      phone: merchantData.phone,
      address: merchantData.address,
      website: merchantData.website || 'Not provided',
      industry: merchantData.industry || 'Not specified',
      description: merchantData.description || 'No description available',
      
      // Business details
      businessType: merchantData.businessType || 'Not specified',
      yearFounded: merchantData.yearFounded || 'Not specified',
      employeeCount: merchantData.employeeCount || 'Not specified',
      annualRevenue: merchantData.annualRevenue || 'Not specified',
      
      // Financial information
      financialData: merchantData.financialData || {},
      
      // Verification status
      verificationStatus: merchantData.verificationStatus || 'unverified',
      
      // Contract information (summary only)
      activeContractsCount: merchantData.activeContractsCount || 0,
      
      // Risk factors
      pastDue: merchantData.pastDue || false,
      riskScore: merchantData.riskScore || 'Not assessed',
      
      // Additional metadata
      createdAt: merchantData.createdAt || new Date().toISOString(),
      active: merchantData.active || true
    };
  }

  /**
   * Create the prompt for the due diligence report
   * @param merchantInfo Extracted merchant information
   * @returns Formatted prompt for OpenAI
   */
  private createDueDiligencePrompt(merchantInfo: any): string {
    return `
Act as a bank doing due diligence on a Merchant who wants your bank to provide loans for the clients of their coaching business. You want to make sure that they have a good reputation, are not a scam, positive customer feedback, check their bank statements to make sure they are in revenue and don't show any suspicious activity, no signs of refunds, checks sales agreement to make sure it covers everything needed, and everything in between. This is make it or break it for your bank, so this has to be very detailed and in depth.

Important questions that need answered are:
- What is coaching for?
- How long is the program?
- What is the cost of the program?
- Is there material?
- Is it one on one?
- What do customers get from the program?
- Are there assurances for guaranteed wealth?
- Do they get ongoing access to coaches and material online?
- What is marketing effort of the company?

Here is the merchant information:
- Company Name: ${merchantInfo.name}
- Contact Person: ${merchantInfo.contactName}
- Industry: ${merchantInfo.industry}
- Website: ${merchantInfo.website}
- Business Type: ${merchantInfo.businessType}
- Year Founded: ${merchantInfo.yearFounded}
- Employee Count: ${merchantInfo.employeeCount}
- Annual Revenue Range: ${merchantInfo.annualRevenue}
- Verification Status: ${merchantInfo.verificationStatus}
- Active Contracts: ${merchantInfo.activeContractsCount}
- Risk Score: ${merchantInfo.riskScore}

${merchantInfo.description ? `Business Description: ${merchantInfo.description}` : ''}

Based on the available information, please provide a comprehensive due diligence report that includes:

1. Executive Summary
   - Brief overview of the merchant
   - Credit worthiness assessment for financing their customers
   - Overall risk rating (Low, Medium, High)

2. Business Legitimacy Analysis
   - Business model viability
   - Market reputation assessment
   - Customer feedback analysis
   - Online presence and reputation
   - Industry standing

3. Financial Health Assessment
   - Revenue patterns and stability
   - Cash flow analysis
   - Indicators of financial strength or weakness
   - Financial red flags assessment

4. Loan Risk Analysis
   - Default risk assessment
   - Client base quality evaluation
   - Collection process evaluation
   - Historical performance with similar financing arrangements

5. Regulatory Compliance Evaluation
   - KYC/AML compliance status
   - Industry regulations adherence
   - Consumer protection compliance
   - Lending practice compliance

6. Contract & Documentation Assessment
   - Sales agreement completeness
   - Loan term fairness
   - Disclosure adequacy
   - Consumer protection provisions

7. Component Rating
   Rate each of these components on a 1-5 scale where 1 is worst and 5 is best:

   A. Privacy Policy
      - 5 points: Fully detailed, complies with privacy laws, clear on user rights and data retention.
      - 4 points: Clear, but missing some security details or data retention policies.
      - 3 points: Adequate but lacks important elements like data security or retention clarity.
      - 2 points: Minimal clarity on data use and no clear user rights.
      - 1 point: No privacy policy or entirely non-compliant.

   B. Terms of Service (TOS)
      - 5 points: Up-to-date, detailed refund/cancellation policies, covers liability and dispute resolution.
      - 4 points: Clear terms but could use updates or is missing minor elements.
      - 3 points: Outdated or lacking some key elements (e.g., refund policies).
      - 2 points: Incomplete or confusing terms with little protection for users.
      - 1 point: No terms or legal protection for the business.

   C. Marketing and Advertising Compliance
      - 5 points: Fully transparent, truthful claims, and clear disclosures.
      - 4 points: Mostly compliant but minor disclosure or transparency improvements needed.
      - 3 points: Some misleading claims or unclear disclosures, but no major violations.
      - 2 points: Deceptive advertising practices or frequent misleading claims.
      - 1 point: Widespread false claims, leading to customer distrust.

   D. Business Transparency and Reviews
      - 5 points: Fully transparent, frequent reviews, active engagement on trusted platforms.
      - 4 points: Transparent with regular reviews, but updates needed.
      - 3 points: Some transparency, but reviews are outdated and minimal engagement.
      - 2 points: Little transparency or few outdated reviews with no engagement.
      - 1 point: No transparency or reviews, leading to customer trust issues.

8. Recommendation
   - Partnership viability (Approve/Conditional Approval/Decline)
   - Risk mitigation requirements if approved
   - Suggested monitoring protocols
   - Recommended loan terms and conditions

Please format the report in a professional, structured manner similar to a formal banking due diligence report with clear headings and concise analysis.
`;
  }
}

export const dueDiligenceService = new DueDiligenceService();