import { logger, LogCategory, LogSource } from "../logger";
import { type CreditProfile } from "@shared/schema";

interface UnderwritingData {
  annualIncome: number | null;
  employmentHistory: number | null;
  creditScore: number | null;
  dtiRatio: number | null;
  housingStatus: boolean | null;
  delinquencyHistory: boolean | null;
}

interface UnderwritingResult {
  creditTier: "Tier1" | "Tier2" | "Tier3" | "Declined";
  status: "approved" | "pending" | "declined";
  annualIncomePoints: number;
  employmentHistoryPoints: number;
  creditScorePoints: number;
  dtiRatioPoints: number;
  housingStatusPoints: number;
  delinquencyHistoryPoints: number;
  totalPoints: number;
  decision: string;
  decisionDate: Date;
}

const TIER_THRESHOLDS = {
  TIER1: 22, // 22-30 points (720+ CS)
  TIER2: 15, // 15-21 points (660-719 CS)
  TIER3: 6,  // 6-14 points (620-659 CS)
};

const CREDIT_SCORE_TIERS = {
  TIER1: 720,
  TIER2: 660,
  TIER3: 620,
};

export const underwritingService = {
  extractUnderwritingData(creditProfile: CreditProfile): UnderwritingData {
    try {
      const preFiData = creditProfile.preFiData ? JSON.parse(creditProfile.preFiData) : null;

      // Log the extraction process
      logger.debug({
        message: "Extracting underwriting data from credit profile",
        category: LogCategory.Contract,
        source: LogSource.Internal,
        metadata: {
          creditProfileId: creditProfile.id,
          preFiData,
        },
      });

      return {
        annualIncome: preFiData?.annualIncome || null,
        employmentHistory: preFiData?.employmentMonths || null,
        creditScore: creditProfile.creditScore,
        dtiRatio: preFiData?.dtiRatio || null,
        housingStatus: preFiData?.ownHome || null,
        delinquencyHistory: preFiData?.hasDelinquencies || null,
      };
    } catch (error) {
      logger.error({
        message: `Error extracting underwriting data: ${error instanceof Error ? error.message : String(error)}`,
        category: LogCategory.Contract,
        source: LogSource.Internal,
        metadata: {
          creditProfileId: creditProfile.id,
          error: error instanceof Error ? error.stack : null,
        },
      });
      throw error;
    }
  },

  calculateUnderwriting(data: UnderwritingData): UnderwritingResult {
    try {
      // Calculate points for each category
      const annualIncomePoints = this.calculateAnnualIncomePoints(data.annualIncome);
      const employmentHistoryPoints = this.calculateEmploymentHistoryPoints(data.employmentHistory);
      const creditScorePoints = this.calculateCreditScorePoints(data.creditScore);
      const dtiRatioPoints = this.calculateDTIRatioPoints(data.dtiRatio);
      const housingStatusPoints = this.calculateHousingStatusPoints(data.housingStatus);
      const delinquencyHistoryPoints = this.calculateDelinquencyHistoryPoints(data.delinquencyHistory);

      // Calculate total points
      const totalPoints = 
        annualIncomePoints +
        employmentHistoryPoints +
        creditScorePoints +
        dtiRatioPoints +
        housingStatusPoints +
        delinquencyHistoryPoints;

      // Determine credit tier and status
      let creditTier: "Tier1" | "Tier2" | "Tier3" | "Declined";
      let status: "approved" | "pending" | "declined";
      let decision: string;

      if (totalPoints >= TIER_THRESHOLDS.TIER1 && (data.creditScore || 0) >= CREDIT_SCORE_TIERS.TIER1) {
        creditTier = "Tier1";
        status = "approved";
        decision = "Approved for Tier 1 financing";
      } else if (totalPoints >= TIER_THRESHOLDS.TIER2 && (data.creditScore || 0) >= CREDIT_SCORE_TIERS.TIER2) {
        creditTier = "Tier2";
        status = "approved";
        decision = "Approved for Tier 2 financing";
      } else if (totalPoints >= TIER_THRESHOLDS.TIER3 && (data.creditScore || 0) >= CREDIT_SCORE_TIERS.TIER3) {
        creditTier = "Tier3";
        status = "approved";
        decision = "Approved for Tier 3 financing";
      } else {
        creditTier = "Declined";
        status = "declined";
        decision = "Application declined due to not meeting minimum criteria";
      }

      logger.info({
        message: `Completed underwriting calculation`,
        category: LogCategory.Contract,
        source: LogSource.Internal,
        metadata: {
          totalPoints,
          creditTier,
          status,
          creditScore: data.creditScore,
        },
      });

      return {
        creditTier,
        status,
        annualIncomePoints,
        employmentHistoryPoints,
        creditScorePoints,
        dtiRatioPoints,
        housingStatusPoints,
        delinquencyHistoryPoints,
        totalPoints,
        decision,
        decisionDate: new Date(),
      };
    } catch (error) {
      logger.error({
        message: `Error calculating underwriting: ${error instanceof Error ? error.message : String(error)}`,
        category: LogCategory.Contract,
        source: LogSource.Internal,
        metadata: {
          error: error instanceof Error ? error.stack : null,
          underwritingData: data,
        },
      });
      throw error;
    }
  },

  calculateAnnualIncomePoints(annualIncome: number | null): number {
    if (!annualIncome) return 0;
    if (annualIncome >= 120000) return 5;
    if (annualIncome >= 80000) return 4;
    if (annualIncome >= 60000) return 3;
    if (annualIncome >= 40000) return 2;
    return 1;
  },

  calculateEmploymentHistoryPoints(employmentMonths: number | null): number {
    if (!employmentMonths) return 0;
    if (employmentMonths >= 60) return 5; // 5+ years
    if (employmentMonths >= 36) return 4; // 3+ years
    if (employmentMonths >= 24) return 3; // 2+ years
    if (employmentMonths >= 12) return 2; // 1+ year
    return 1;
  },

  calculateCreditScorePoints(creditScore: number | null): number {
    if (!creditScore) return 0;
    if (creditScore >= 720) return 5;
    if (creditScore >= 680) return 4;
    if (creditScore >= 640) return 3;
    if (creditScore >= 600) return 2;
    return 1;
  },

  calculateDTIRatioPoints(dtiRatio: number | null): number {
    if (!dtiRatio) return 0;
    if (dtiRatio <= 0.2) return 5;
    if (dtiRatio <= 0.3) return 4;
    if (dtiRatio <= 0.4) return 3;
    if (dtiRatio <= 0.5) return 2;
    return 1;
  },

  calculateHousingStatusPoints(ownsHome: boolean | null): number {
    return ownsHome ? 5 : 0;
  },

  calculateDelinquencyHistoryPoints(hasDelinquencies: boolean | null): number {
    return hasDelinquencies ? 0 : 5;
  },
};