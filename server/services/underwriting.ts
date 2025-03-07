
import { logger } from './logger';
import { preFiService } from './prefi';
import { plaidClient } from './plaid';
import { UnderwritingData, users } from '../../shared/schema';
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
    // In a real implementation, this would use Plaid data
    // For now, we'll return mock data
    return {
      income: Math.floor(Math.random() * (120000 - 30000) + 30000),
      employmentMonths: Math.floor(Math.random() * (72 - 6) + 6),
      dtiRatio: Math.random() * 0.6,
      housingStatus: ['own', 'mortgage', 'rent'][Math.floor(Math.random() * 3)],
      housingPaymentHistoryMonths: Math.floor(Math.random() * (36 - 1) + 1),
      // Other financial data...
    };
  }
  
  private async saveUnderwritingData(data: any) {
    // Save the underwriting data to the database
    try {
      // Check if there's an existing record
      const result = await db.insert(underwritingData).values({
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
