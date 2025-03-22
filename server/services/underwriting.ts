import { logger } from './logger';
import { preFiService } from './prefi';
import { plaidService } from './plaid';
import { UnderwritingData, users, underwritingData as underwritingTable } from '../../shared/schema';
import { db } from '../db';
import { storage } from '../storage';
import { eq } from 'drizzle-orm';

class UnderwritingService {

  /**
   * Process underwriting for a customer
   */
  async processUnderwriting(userId: number, contractId: number): Promise<UnderwritingData | null> {
    try {
      logger.info({
        message: `Starting underwriting process for user ${userId} and contract ${contractId}`,
        category: 'underwriting',
        metadata: { userId, contractId }
      });

      // First fetch user data to get essential user information
      const user = await storage.getUser(userId);
      if (!user) {
        logger.error({
          message: `User not found for underwriting`,
          category: 'underwriting',
          metadata: { userId }
        });
        return null;
      }

      // Try to get Plaid data first for assets
      let plaidData = null;
      try {
        // Get plaid accounts and transactions for the user
        plaidData = await plaidService.getUserFinancialProfile(userId);
        logger.info({
          message: `Retrieved Plaid data for user ${userId}`,
          category: 'underwriting',
          metadata: { 
            userId,
            hasPlaidData: !!plaidData 
          }
        });
      } catch (error) {
        logger.warn({
          message: `Failed to retrieve Plaid data for user ${userId}`,
          category: 'underwriting',
          metadata: { 
            userId,
            error: error instanceof Error ? error.stack : String(error)
          }
        });
      }

      // Get only credit score from PreFi
      let preFiData = null;
      let creditScore = 0;
      try {
        // Get credit report data from PreFi
        if (user.ssn && user.firstName && user.lastName && user.dateOfBirth && user.address) {
          preFiData = await preFiService.getCreditReport(
            user.ssn,
            user.firstName,
            user.lastName,
            user.dateOfBirth,
            user.address
          );

          // Extract only the credit score from PreFi data
          if (preFiData && preFiData.creditScore) {
            creditScore = preFiData.creditScore;
            logger.info({
              message: `Retrieved credit score from PreFi for user ${userId}`,
              category: 'underwriting',
              metadata: { 
                userId,
                hasCreditScore: true
              }
            });
          }
        } else {
          logger.warn({
            message: `Missing required user data for PreFi credit check`,
            category: 'underwriting',
            metadata: { 
              userId,
              hasSSN: !!user.ssn,
              hasName: !!(user.firstName && user.lastName),
              hasDOB: !!user.dateOfBirth,
              hasAddress: !!user.address
            }
          });
        }
      } catch (error) {
        logger.error({
          message: `Failed to retrieve PreFi data for user ${userId}`,
          category: 'underwriting',
          metadata: { 
            userId,
            error: error instanceof Error ? error.stack : String(error)
          }
        });
      }

      // Calculate underwriting score based on available data
      // Priority: Use Plaid assets data first, then credit score from PreFi
      const underwritingResult = this.calculateUnderwritingScore(plaidData, creditScore);

      // Store underwriting results in database
      const newUnderwritingData = await db.insert(underwritingTable).values({
        userId,
        contractId,
        creditScore,
        creditTier: underwritingResult.creditTier,
        totalPoints: underwritingResult.totalPoints,
        annualIncome: underwritingResult.annualIncome,
        annualIncomePoints: underwritingResult.annualIncomePoints,
        employmentHistoryMonths: underwritingResult.employmentHistoryMonths,
        employmentHistoryPoints: underwritingResult.employmentHistoryPoints,
        creditScorePoints: underwritingResult.creditScorePoints,
        dtiRatio: underwritingResult.dtiRatio,
        dtiRatioPoints: underwritingResult.dtiRatioPoints,
        housingStatus: underwritingResult.housingStatus,
        housingPaymentHistory: underwritingResult.housingPaymentHistory,
        housingStatusPoints: underwritingResult.housingStatusPoints,
        delinquencyHistory: underwritingResult.delinquencyHistory,
        delinquencyPoints: underwritingResult.delinquencyPoints,
        rawPreFiData: preFiData ? JSON.stringify(preFiData) : null,
        rawPlaidData: plaidData ? JSON.stringify(plaidData) : null
      }).returning();

      logger.info({
        message: `Completed underwriting process for user ${userId}`,
        category: 'underwriting',
        metadata: { 
          userId,
          contractId,
          creditTier: underwritingResult.creditTier,
          totalPoints: underwritingResult.totalPoints 
        }
      });

      return newUnderwritingData[0];
    } catch (error) {
      logger.error({
        message: `Error in underwriting process: ${error instanceof Error ? error.message : String(error)}`,
        category: 'underwriting',
        metadata: { 
          userId,
          contractId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      return null;
    }
  }

  /**
   * Calculate underwriting score based on available data
   */
  private calculateUnderwritingScore(plaidData: any, creditScore: number) {
    // Initialize result with default values
    const result = {
      creditTier: 'D',
      totalPoints: 0,
      annualIncome: 0,
      annualIncomePoints: 0,
      employmentHistoryMonths: 0,
      employmentHistoryPoints: 0,
      creditScorePoints: 0,
      dtiRatio: 0,
      dtiRatioPoints: 0,
      housingStatus: '',
      housingPaymentHistory: null,
      housingStatusPoints: 0,
      delinquencyHistory: null,
      delinquencyPoints: 0
    };

    // Calculate points based on Plaid assets data
    if (plaidData) {
      // Income analysis
      if (plaidData.income && plaidData.income.annualIncome) {
        result.annualIncome = plaidData.income.annualIncome;
        if (result.annualIncome > 100000) {
          result.annualIncomePoints = 30;
        } else if (result.annualIncome > 75000) {
          result.annualIncomePoints = 25;
        } else if (result.annualIncome > 50000) {
          result.annualIncomePoints = 20;
        } else if (result.annualIncome > 30000) {
          result.annualIncomePoints = 15;
        } else {
          result.annualIncomePoints = 10;
        }
      }

      // Employment history
      if (plaidData.employment && plaidData.employment.length > 0) {
        // Calculate total months of employment history
        // This is a simplified calculation
        result.employmentHistoryMonths = plaidData.employment.reduce(
          (total: number, job: any) => total + (job.monthsEmployed || 0), 
          0
        );

        if (result.employmentHistoryMonths > 60) {
          result.employmentHistoryPoints = 20;
        } else if (result.employmentHistoryMonths > 36) {
          result.employmentHistoryPoints = 15;
        } else if (result.employmentHistoryMonths > 24) {
          result.employmentHistoryPoints = 10;
        } else if (result.employmentHistoryMonths > 12) {
          result.employmentHistoryPoints = 5;
        } else {
          result.employmentHistoryPoints = 0;
        }
      }

      // Housing status and payment history
      if (plaidData.housing) {
        result.housingStatus = plaidData.housing.status;
        result.housingPaymentHistory = plaidData.housing.paymentHistory;

        // Points for housing status
        if (result.housingStatus === 'own') {
          result.housingStatusPoints = 15;
        } else if (result.housingStatus === 'mortgage') {
          result.housingStatusPoints = 10;
        } else if (result.housingStatus === 'rent') {
          result.housingStatusPoints = 5;
        }

        // Add more points for good payment history
        if (result.housingPaymentHistory && result.housingPaymentHistory.onTimePayments > 0.9) {
          result.housingStatusPoints += 10;
        }
      }

      // DTI Ratio calculation
      if (plaidData.income && plaidData.income.annualIncome && plaidData.liabilities) {
        const monthlyIncome = plaidData.income.annualIncome / 12;
        const monthlyDebt = plaidData.liabilities.totalMonthlyPayments || 0;

        result.dtiRatio = monthlyIncome > 0 ? (monthlyDebt / monthlyIncome) : 0;

        if (result.dtiRatio < 0.2) {
          result.dtiRatioPoints = 20;
        } else if (result.dtiRatio < 0.3) {
          result.dtiRatioPoints = 15;
        } else if (result.dtiRatio < 0.4) {
          result.dtiRatioPoints = 10;
        } else if (result.dtiRatio < 0.5) {
          result.dtiRatioPoints = 5;
        } else {
          result.dtiRatioPoints = 0;
        }
      }

      // Delinquency history
      if (plaidData.liabilities && plaidData.liabilities.delinquencies) {
        result.delinquencyHistory = plaidData.liabilities.delinquencies;

        const totalDelinquencies = result.delinquencyHistory.total || 0;

        if (totalDelinquencies === 0) {
          result.delinquencyPoints = 20;
        } else if (totalDelinquencies <= 1) {
          result.delinquencyPoints = 15;
        } else if (totalDelinquencies <= 3) {
          result.delinquencyPoints = 10;
        } else if (totalDelinquencies <= 5) {
          result.delinquencyPoints = 5;
        } else {
          result.delinquencyPoints = 0;
        }
      }
    }

    // Add credit score points from PreFi data
    if (creditScore > 0) {
      if (creditScore >= 750) {
        result.creditScorePoints = 30;
      } else if (creditScore >= 700) {
        result.creditScorePoints = 25;
      } else if (creditScore >= 650) {
        result.creditScorePoints = 20;
      } else if (creditScore >= 600) {
        result.creditScorePoints = 15;
      } else if (creditScore >= 550) {
        result.creditScorePoints = 10;
      } else {
        result.creditScorePoints = 5;
      }
    }

    // Calculate total points
    result.totalPoints = 
      result.annualIncomePoints + 
      result.employmentHistoryPoints + 
      result.creditScorePoints + 
      result.dtiRatioPoints + 
      result.housingStatusPoints + 
      result.delinquencyPoints;

    // Determine credit tier based on total points
    if (result.totalPoints >= 90) {
      result.creditTier = 'A+';
    } else if (result.totalPoints >= 80) {
      result.creditTier = 'A';
    } else if (result.totalPoints >= 70) {
      result.creditTier = 'B+';
    } else if (result.totalPoints >= 60) {
      result.creditTier = 'B';
    } else if (result.totalPoints >= 50) {
      result.creditTier = 'C+';
    } else if (result.totalPoints >= 40) {
      result.creditTier = 'C';
    } else if (result.totalPoints >= 30) {
      result.creditTier = 'D+';
    } else {
      result.creditTier = 'D';
    }

    return result;
  }

  /**
   * Get underwriting data for a user
   */
  async getUnderwritingDataForUser(userId: number): Promise<UnderwritingData[]> {
    try {
      return await db.select().from(underwritingTable).where(eq(underwritingTable.userId, userId));
    } catch (error) {
      logger.error({
        message: `Error fetching underwriting data for user: ${error instanceof Error ? error.message : String(error)}`,
        category: 'underwriting',
        metadata: { 
          userId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      return [];
    }
  }
}

export const underwritingService = new UnderwritingService();