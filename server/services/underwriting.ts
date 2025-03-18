
import { logger } from './logger';
import { preFiService } from './prefi';
import { plaidService } from './plaid';
import { UnderwritingData, users, underwritingData as underwritingTable } from '../../shared/schema';
import { db } from '../db';

class UnderwritingService {
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
    const userResults = await db.select().from(users).where({ id: userId });
    return userResults[0] || null;
  }
  
  private async getCreditData(userId: number) {
    try {
      const userData = await this.getUserData(userId);
      
      if (!userData || !userData.ssn || !userData.firstName || !userData.lastName || !userData.dob || !userData.address) {
        const missingFields = [];
        if (!userData) missingFields.push('userData');
        if (!userData?.ssn) missingFields.push('ssn');
        if (!userData?.firstName) missingFields.push('firstName');
        if (!userData?.lastName) missingFields.push('lastName');
        if (!userData?.dob) missingFields.push('dob');
        if (!userData?.address) missingFields.push('address');
        
        logger.error({
          message: `Missing required KYC data for user ${userId}`,
          category: 'underwriting',
          userId,
          missingFields
        });
        throw new Error(`Missing required KYC data for credit check: ${missingFields.join(', ')}`);
      }
      
      const creditReport = await preFiService.getCreditReport(
        userData.ssn,
        userData.firstName,
        userData.lastName,
        userData.dob,
        {
          street: userData.address.street,
          city: userData.address.city,
          state: userData.address.state,
          zip: userData.address.zip
        }
      );

      logger.info({
        message: 'Successfully retrieved PreFi credit report',
        category: 'underwriting',
        userId,
        hasData: !!creditReport,
        creditScore: creditReport?.creditScore
      });
      
      return {
        creditScore: creditReport.creditScore,
        delinquencyHistory: creditReport.delinquencyDetails || {
          late30: creditReport.late30Days || 0,
          late60: creditReport.late60Days || 0,
          late90: creditReport.late90Days || 0
        }
      };
    } catch (error) {
      logger.error({
        message: `Error getting credit data from Pre-Fi: ${error instanceof Error ? error.message : String(error)}`,
        category: 'underwriting',
        userId,
        error: error instanceof Error ? error.stack : null
      });
      throw error;
    }
  }
  
  private async getPlaidData(userId: number) {
    try {
      logger.info({
        message: `Getting Plaid data for underwriting user ${userId}`,
        category: 'underwriting',
        userId,
      });

      const accessTokensData = await db.query.plaidTokens.findMany({
        where: (tokens, { eq }) => eq(tokens.userId, userId),
      });

      if (!accessTokensData || accessTokensData.length === 0) {
        logger.warn({
          message: `No Plaid access tokens found for user ${userId}, using default metrics`,
          category: 'underwriting',
          userId,
        });
        
        return {
          income: 0,
          employmentMonths: 0,
          dtiRatio: 0,
          housingStatus: 'unknown',
          housingPaymentHistoryMonths: 0,
        };
      }

      const latestToken = accessTokensData[0];
      const accessToken = latestToken.accessToken;

      const assetReportResponse = await plaidService.createAssetReport({
        accessToken: accessToken,
        daysRequested: 90,
        clientReportId: `underwriting-${userId}-${Date.now()}`,
        user: {
          clientUserId: userId.toString(),
        }
      });

      logger.info({
        message: `Created Plaid asset report, waiting for processing`,
        category: 'underwriting',
        userId,
        assetReportToken: assetReportResponse.assetReportToken,
      });

      let retries = 0;
      let analysis = null;
      while (retries < 5) {
        try {
          analysis = await plaidService.analyzeAssetReportForUnderwriting(
            assetReportResponse.assetReportToken
          );
          if (analysis) break;
        } catch (error) {
          logger.warn({
            message: `Attempt ${retries + 1} to get asset report failed, retrying...`,
            category: 'underwriting',
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
          await new Promise(resolve => setTimeout(resolve, 5000));
          retries++;
        }
      }

      if (!analysis) {
        throw new Error('Failed to generate Plaid asset report after multiple retries');
      }

      logger.info({
        message: `Analyzed Plaid asset report for underwriting`,
        category: 'underwriting',
        userId,
        analysis,
      });

      return {
        income: analysis.income.annualIncome || 0,
        employmentMonths: analysis.employment.employmentMonths || 0,
        dtiRatio: analysis.debt.dtiRatio || 0,
        housingStatus: analysis.housing.housingStatus || 'unknown',
        housingPaymentHistoryMonths: analysis.housing.paymentHistoryMonths || 0,
        fullAnalysis: analysis,
      };
    } catch (error) {
      logger.error({
        message: `Error getting Plaid data for underwriting: ${error instanceof Error ? error.message : String(error)}`,
        category: 'underwriting',
        userId,
        error: error instanceof Error ? error.stack : null,
      });
      
      logger.error({
        message: `Critical error getting Plaid data for underwriting`,
        category: 'underwriting',
        userId,
        error: error instanceof Error ? error.stack : String(error),
      });
      throw new Error('Failed to retrieve required financial data from Plaid');
    }
  }
  
  private async saveUnderwritingData(data: any) {
    try {
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

  private async processMerchantUnderwriting(merchantId: number): Promise<UnderwritingData | null> {
    try {
      const plaidData = await this.getPlaidData(merchantId);
      
      const assetReport = await plaidService.createAssetReport({
        accessToken: plaidData.accessToken,
        daysRequested: 730,
        clientReportId: `merchant-verification-${merchantId}-${Date.now()}`
      });

      const analysis = await plaidService.analyzeAssetReportForUnderwriting(
        assetReport.assetReportToken
      );

      const monthlyRevenue = analysis?.income?.monthlyIncome || 0;
      const monthsOfHistory = analysis?.employment?.employmentMonths || 0;

      const qualifies = monthlyRevenue >= 100000 && monthsOfHistory >= 24;
      const creditTier = qualifies ? 'approved' : 'declined';

      return await this.saveUnderwritingData({
        userId: merchantId,
        creditTier,
        annualIncome: monthlyRevenue * 12,
        employmentHistoryMonths: monthsOfHistory,
        rawPlaidData: JSON.stringify(analysis),
        isMerchant: true
      });

    } catch (error) {
      logger.error({
        message: `Error in merchant underwriting process: ${error instanceof Error ? error.message : String(error)}`,
        category: 'underwriting',
        merchantId,
        error: error instanceof Error ? error.stack : null
      });
      throw error;
    }
  }
}

export const underwritingService = new UnderwritingService();
