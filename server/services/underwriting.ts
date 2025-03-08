
import { logger } from './logger';
import { preFiService } from './prefi';
import { plaidService } from './plaid';
import { UnderwritingData, users, underwritingData as underwritingTable } from '../../shared/schema';
import { db } from '../db';

// Define the underwriting service
export class UnderwritingService {
  async processUnderwriting(userId: number, contractId?: number): Promise<UnderwritingData | null> {
    try {
      logger.info({
        message: `Starting underwriting process for user ${userId}`,
        category: 'system',
        userId,
        contractId,
      });
      
      // 1. Get user data
      const userData = await this.getUserData(userId);
      if (!userData) {
        throw new Error(`User data not found for user ID ${userId}`);
      }
      
      // 2. Get credit data from Pre-Fi
      // This would use KYC data that would already be stored
      // For this example, we'll use a mock credit report
      const creditData = await this.getCreditData(userId);
      
      // 3. Get income and debt data from Plaid
      const plaidData = await this.getPlaidData(userId);
      
      // 4. Calculate scores and points
      const annualIncomePoints = preFiService.calculateAnnualIncomePoints(plaidData.income);
      const employmentHistoryPoints = preFiService.calculateEmploymentHistoryPoints(plaidData.employmentMonths);
      const creditScorePoints = preFiService.calculateCreditScorePoints(creditData.creditScore);
      const dtiRatioPoints = preFiService.calculateDtiRatioPoints(plaidData.dtiRatio);
      const housingStatusPoints = preFiService.calculateHousingStatusPoints(
        plaidData.housingStatus, 
        plaidData.housingPaymentHistoryMonths
      );
      const delinquencyPoints = preFiService.calculateDelinquencyPoints(creditData.delinquencyHistory);
      
      // 5. Calculate total points
      const totalPoints = annualIncomePoints + employmentHistoryPoints + creditScorePoints + 
                          dtiRatioPoints + housingStatusPoints + delinquencyPoints;
      
      // 6. Determine credit tier
      const creditTier = preFiService.calculateCreditTier(creditData.creditScore, totalPoints);
      
      // 7. Save underwriting data
      const underwritingData = await this.saveUnderwritingData({
        userId,
        contractId,
        creditTier,
        creditScore: creditData.creditScore,
        annualIncome: plaidData.income,
        annualIncomePoints,
        employmentHistoryMonths: plaidData.employmentMonths,
        employmentHistoryPoints,
        creditScorePoints,
        dtiRatio: plaidData.dtiRatio,
        dtiRatioPoints,
        housingStatus: plaidData.housingStatus,
        housingPaymentHistory: plaidData.housingPaymentHistoryMonths,
        housingStatusPoints,
        delinquencyHistory: JSON.stringify(creditData.delinquencyHistory),
        delinquencyPoints,
        totalPoints,
        rawPreFiData: JSON.stringify(creditData),
        rawPlaidData: JSON.stringify(plaidData),
      });
      
      logger.info({
        message: `Completed underwriting process for user ${userId}`,
        category: 'system',
        userId,
        contractId,
        creditTier,
        totalPoints,
      });
      
      return underwritingData;
    } catch (error) {
      logger.error({
        message: `Error in underwriting process for user ${userId}`,
        category: 'system',
        userId,
        contractId,
        error,
      });
      throw error;
    }
  }
  
  private async getUserData(userId: number) {
    // Fetch user data from the database
    const userResults = await db.select().from(users).where({ id: userId });
    return userResults[0] || null;
  }
  
  private async getCreditData(userId: number) {
    // In a real implementation, this would call Pre-Fi API
    // For now, we'll return mock data
    return {
      creditScore: Math.floor(Math.random() * (800 - 600) + 600),
      delinquencyHistory: {
        late30: Math.floor(Math.random() * 2),
        late60: Math.floor(Math.random() * 2),
        late90: 0,
      },
      // Other credit data...
    };
  }
  
  private async getPlaidData(userId: number) {
    try {
      logger.info({
        message: `Getting Plaid data for underwriting user ${userId}`,
        category: 'underwriting',
        userId,
      });

      // Look up access tokens associated with this user
      // In a real implementation, you'd retrieve this from your database
      // For this example, we'll check if we have any stored in the database
      const accessTokensData = await db.query.plaidTokens.findMany({
        where: (tokens, { eq }) => eq(tokens.userId, userId),
      });

      if (!accessTokensData || accessTokensData.length === 0) {
        logger.warn({
          message: `No Plaid access tokens found for user ${userId}, using default metrics`,
          category: 'underwriting',
          userId,
        });
        
        // If no access tokens found, return default metrics
        // In production, you might want to fail the underwriting process
        // or request the user to connect their accounts
        return {
          income: 0,
          employmentMonths: 0,
          dtiRatio: 0,
          housingStatus: 'unknown',
          housingPaymentHistoryMonths: 0,
        };
      }

      // Use the most recently added access token
      const latestToken = accessTokensData[0];
      const accessToken = latestToken.accessToken;

      // Create an asset report - this may take a few seconds to generate
      const assetReportResponse = await plaidService.createAssetReport({
        accessToken: accessToken,
        daysRequested: 90, // 3 months of data
        clientReportId: `underwriting-${userId}-${Date.now()}`,
        user: {
          clientUserId: userId.toString(),
        }
      });

      // Wait for the asset report to be ready (this might take a few seconds)
      // In a production environment, you might want to implement a webhook or polling
      logger.info({
        message: `Created Plaid asset report, waiting for processing`,
        category: 'underwriting',
        userId,
        assetReportToken: assetReportResponse.assetReportToken,
      });

      // Add a small delay to ensure the report is processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Analyze the asset report for underwriting
      const analysis = await plaidService.analyzeAssetReportForUnderwriting(
        assetReportResponse.assetReportToken
      );

      logger.info({
        message: `Analyzed Plaid asset report for underwriting`,
        category: 'underwriting',
        userId,
        analysis,
      });

      // Return the analyzed data in the format expected by the underwriting process
      return {
        income: analysis.income.annualIncome || 0,
        employmentMonths: analysis.employment.employmentMonths || 0,
        dtiRatio: analysis.debt.dtiRatio || 0,
        housingStatus: analysis.housing.housingStatus || 'unknown',
        housingPaymentHistoryMonths: analysis.housing.paymentHistoryMonths || 0,
        // Include the full analysis in case we need to extract more data
        fullAnalysis: analysis,
      };
    } catch (error) {
      logger.error({
        message: `Error getting Plaid data for underwriting: ${error instanceof Error ? error.message : String(error)}`,
        category: 'underwriting',
        userId,
        error: error instanceof Error ? error.stack : null,
      });
      
      // Return default values in case of error
      // In production, you might want to fail the underwriting process
      return {
        income: 0,
        employmentMonths: 0,
        dtiRatio: 0,
        housingStatus: 'unknown',
        housingPaymentHistoryMonths: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  private async saveUnderwritingData(data: any) {
    // Save the underwriting data to the database
    try {
      // Check if there's an existing record
      const result = await db.insert(underwritingTable).values({
        ...data,
        updatedAt: new Date(),
      }).returning();
      
      return result[0] || null;
    } catch (error) {
      logger.error({
        message: 'Error saving underwriting data',
        category: 'system',
        userId: data.userId,
        error,
      });
      throw error;
    }
  }
}

export const underwritingService = new UnderwritingService();
