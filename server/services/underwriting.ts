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

      // Process Plaid asset report data into a format suitable for our underwriting algorithm
      const processedPlaidData = plaidData ? this.processPlaidData(plaidData) : null;
      
      // Calculate underwriting score based on available data
      // Priority: Use Plaid assets data first, then credit score from PreFi
      const underwritingResult = this.calculateUnderwritingScore(processedPlaidData, creditScore);

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
      creditTier: 'declined',
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
    // Map the score to the schema's enum values: 'tier1', 'tier2', 'tier3', 'declined'
    if (result.totalPoints >= 80) {
      result.creditTier = 'tier1';  // High quality (A+, A)
    } else if (result.totalPoints >= 60) {
      result.creditTier = 'tier2';  // Medium quality (B+, B, C+)
    } else if (result.totalPoints >= 30) {
      result.creditTier = 'tier3';  // Lower quality but acceptable (C, D+)
    } else {
      result.creditTier = 'declined'; // Below threshold
    }

    return result;
  }

  /**
   * Process Plaid data into a format suitable for underwriting
   */
  private processPlaidData(plaidData: any): any {
    // Process raw Plaid data into a structured format for underwriting
    // This is a placeholder implementation and should be expanded based on actual Plaid data structure
    if (!plaidData) return null;
    
    const result: any = {
      income: { annualIncome: 0 },
      employment: [],
      housing: { status: '', paymentHistory: null },
      liabilities: { totalMonthlyPayments: 0, delinquencies: { total: 0 } }
    };
    
    // Extract income data if available
    if (plaidData.income) {
      result.income.annualIncome = plaidData.income.annual_income || 0;
    }
    
    // Extract employment data if available
    if (plaidData.employment && Array.isArray(plaidData.employment)) {
      result.employment = plaidData.employment.map((job: any) => ({
        employer: job.employer || '',
        monthsEmployed: job.months_employed || 0
      }));
    }
    
    // Extract housing data if available
    if (plaidData.accounts) {
      // Attempt to determine housing status from accounts
      const mortgageAccount = plaidData.accounts.find((acc: any) => 
        acc.subtype === 'mortgage' || acc.subtype === 'home loan'
      );
      
      if (mortgageAccount) {
        result.housing.status = 'mortgage';
      } else {
        // Default to rent if no mortgage is found
        // This is a simplification - in a real implementation you'd want more logic
        result.housing.status = 'rent';
      }
      
      // Payment history could be determined from transactions
      if (plaidData.transactions && plaidData.transactions.length > 0) {
        // This is a simplification - in reality you'd analyze transaction patterns
        result.housing.paymentHistory = { onTimePayments: 1.0 };
      }
    }
    
    // Extract liability data if available
    if (plaidData.liabilities) {
      let totalMonthlyPayments = 0;
      let totalDelinquencies = 0;
      
      // Calculate total monthly payments
      if (plaidData.liabilities.credit && Array.isArray(plaidData.liabilities.credit)) {
        plaidData.liabilities.credit.forEach((credit: any) => {
          if (credit.minimum_payment) {
            totalMonthlyPayments += credit.minimum_payment;
          }
          if (credit.is_overdue) {
            totalDelinquencies++;
          }
        });
      }
      
      // Add other liability types as needed
      result.liabilities.totalMonthlyPayments = totalMonthlyPayments;
      result.liabilities.delinquencies = { total: totalDelinquencies };
    }
    
    return result;
  }

  private calculateUnderwritingScore(plaidData: any, creditScore: number) {
    // Initialize result with default values
    const result = {
      creditTier: 'declined',
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
    // Map the score to the schema's enum values: 'tier1', 'tier2', 'tier3', 'declined'
    if (result.totalPoints >= 80) {
      result.creditTier = 'tier1';  // High quality (A+, A)
    } else if (result.totalPoints >= 60) {
      result.creditTier = 'tier2';  // Medium quality (B+, B, C+)
    } else if (result.totalPoints >= 30) {
      result.creditTier = 'tier3';  // Lower quality but acceptable (C, D+)
    } else {
      result.creditTier = 'declined'; // Below threshold
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

  /**
   * Process Plaid financial profile data for underwriting analysis
   * This standardizes the Plaid data structure for our underwriting algorithm
   */
  private processPlaidData(plaidData: any): any {
    // If data is already in expected format, return as is
    if (!plaidData) return null;
    
    try {
      // Create a standardized structure for our underwriting algorithm
      const processedData: any = {
        income: {
          annualIncome: 0,
          monthlyIncome: 0,
          confidence: 0
        },
        employment: [],
        housing: {
          status: 'unknown',
          paymentHistory: null
        },
        liabilities: {
          totalMonthlyPayments: 0,
          delinquencies: {
            total: 0
          }
        }
      };
      
      // Extract income data
      if (plaidData.income) {
        processedData.income = {
          annualIncome: plaidData.income.annualIncome || 0,
          monthlyIncome: plaidData.income.monthlyIncome || (plaidData.income.annualIncome ? plaidData.income.annualIncome / 12 : 0),
          confidence: plaidData.income.confidence || 0
        };
      }
      
      // Extract employment data
      if (plaidData.employment) {
        // Convert various employment data formats to a standardized format
        if (Array.isArray(plaidData.employment)) {
          processedData.employment = plaidData.employment.map((job: any) => ({
            name: job.name || 'Unknown Employer',
            monthsEmployed: job.monthsEmployed || job.months || 0
          }));
        } else if (plaidData.employment.employmentMonths) {
          // If we have the analyzed format from Plaid service
          processedData.employment = [{
            name: 'Primary Employer',
            monthsEmployed: plaidData.employment.employmentMonths
          }];
        }
      }
      
      // Extract housing information
      if (plaidData.housing) {
        processedData.housing = {
          status: plaidData.housing.housingStatus || plaidData.housing.status || 'unknown',
          paymentHistory: plaidData.housing.paymentHistory || { onTimePayments: 0 }
        };
      }
      
      // Extract liability information
      if (plaidData.debt) {
        processedData.liabilities = {
          totalMonthlyPayments: plaidData.debt.totalDebt / 12 || 0,
          delinquencies: {
            total: 0 // Default if no delinquency data
          }
        };
      } else if (plaidData.liabilities) {
        processedData.liabilities = plaidData.liabilities;
      }
      
      return processedData;
    } catch (error) {
      // If there's an error processing the data, log it and return null
      console.error('Error processing Plaid data for underwriting:', error);
      return null;
    }
  }
