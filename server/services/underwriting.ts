import { logger } from '../logger';
import { 
  CreditProfile, 
  InsertUnderwriting, 
  creditTierEnum, 
  underwritingStatusEnum 
} from '@shared/schema';

/**
 * Interface representing the data needed for underwriting calculation
 */
interface UnderwritingData {
  creditScore: number | null;
  annualIncome: number | null;
  employmentYears?: number | null;
  employmentType?: string | null;
  dtiRatio?: number | null;
  housingPayments?: boolean | null; // true = on-time payments, false = missing payments
  delinquencyHistory?: {
    lastMajorDelinquency?: Date | null;
    recentLates?: number | null;
    bankruptcyDate?: Date | null;
  };
}

/**
 * Service to handle customer underwriting and scoring
 */
class UnderwritingService {
  /**
   * Determine annual income score based on income
   */
  getAnnualIncomePoints(annualIncome: number | null): number {
    if (annualIncome === null) return 0;
    
    if (annualIncome >= 100000) return 5;
    if (annualIncome >= 75000) return 4;
    if (annualIncome >= 50000) return 3;
    if (annualIncome >= 40000) return 2;
    if (annualIncome >= 35000) return 1;
    
    // If annual income is below $35k, this is a disqualification factor
    return 0;
  }

  /**
   * Determine employment history score based on years and type
   */
  getEmploymentHistoryPoints(years: number | null, type: string | null): number {
    if (years === null && type === null) return 0;
    
    if (type === 'self_employed') return 3;
    if (type === 'retired') return 2;
    if (type === 'short_term') return 1;
    
    if (years !== null) {
      if (years >= 4) return 5;
      if (years >= 1) return 4;
    }
    
    return 0;
  }

  /**
   * Determine credit score points
   */
  getCreditScorePoints(creditScore: number | null): number {
    if (creditScore === null) return 0;
    
    if (creditScore >= 800) return 5;
    if (creditScore >= 720) return 4;
    if (creditScore >= 650) return 3;
    if (creditScore >= 600) return 2;
    
    return 1;
  }

  /**
   * Determine DTI ratio points
   */
  getDtiRatioPoints(dtiRatio: number | null): number {
    if (dtiRatio === null) return 0;
    
    if (dtiRatio < 15) return 5;
    if (dtiRatio < 20) return 4;
    if (dtiRatio < 35) return 3;
    if (dtiRatio < 45) return 2;
    
    return 1;
  }

  /**
   * Determine housing status points
   */
  getHousingStatusPoints(onTimePayments: boolean | null): number {
    if (onTimePayments === null) return 0;
    
    // 5 points for on-time payments, 1 point for missing payments
    return onTimePayments ? 5 : 1;
  }

  /**
   * Determine delinquency/adverse history points
   */
  getDelinquencyHistoryPoints(delinquencyData: UnderwritingData['delinquencyHistory'] | undefined): number {
    if (!delinquencyData) return 0;
    
    // Check for recent bankruptcy (less than 1 year) - automatic disqualification
    if (delinquencyData.bankruptcyDate) {
      const bankruptcyDate = new Date(delinquencyData.bankruptcyDate);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      if (bankruptcyDate > oneYearAgo) {
        return 0; // Immediate disqualification
      }
    }
    
    // No delinquencies in 5+ years
    if (!delinquencyData.lastMajorDelinquency && !delinquencyData.recentLates) {
      return 5;
    }
    
    // Check for major delinquencies
    if (delinquencyData.lastMajorDelinquency) {
      const delinquencyDate = new Date(delinquencyData.lastMajorDelinquency);
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const fourYearsAgo = new Date();
      fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
      
      // Recent major issues (<12 months) or older bankruptcy
      if (delinquencyDate > twoYearsAgo) {
        return delinquencyData.recentLates && delinquencyData.recentLates > 2 ? 1 : 2;
      }
      
      // No major delinquencies in 2-4 years
      if (delinquencyDate < twoYearsAgo && delinquencyDate > fourYearsAgo) {
        return 4;
      }
    }
    
    // Minor or 1-2 lates in last 2 years (all resolved)
    if (delinquencyData.recentLates && delinquencyData.recentLates <= 2) {
      return 3;
    }
    
    return 0;
  }

  /**
   * Calculate total points and determine credit tier
   */
  calculateCreditTier(totalPoints: number): typeof creditTierEnum.enumValues[number] {
    if (totalPoints >= 22) return 'tier1';
    if (totalPoints >= 15) return 'tier2';
    if (totalPoints >= 6) return 'tier3';
    return 'disqualified';
  }

  /**
   * Determine if there are any automatic disqualification factors
   */
  hasDisqualificationFactors(data: UnderwritingData): boolean {
    // Annual income below threshold ($35k)
    if (data.annualIncome !== null && data.annualIncome < 35000) {
      return true;
    }
    
    // Recent bankruptcy
    if (data.delinquencyHistory?.bankruptcyDate) {
      const bankruptcyDate = new Date(data.delinquencyHistory.bankruptcyDate);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      if (bankruptcyDate > oneYearAgo) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate total score and underwriting result
   */
  calculateUnderwriting(data: UnderwritingData): InsertUnderwriting {
    // Calculate points for each category
    const annualIncomePoints = this.getAnnualIncomePoints(data.annualIncome);
    const employmentHistoryPoints = this.getEmploymentHistoryPoints(data.employmentYears, data.employmentType);
    const creditScorePoints = this.getCreditScorePoints(data.creditScore);
    const dtiRatioPoints = this.getDtiRatioPoints(data.dtiRatio);
    const housingStatusPoints = this.getHousingStatusPoints(data.housingPayments);
    const delinquencyHistoryPoints = this.getDelinquencyHistoryPoints(data.delinquencyHistory);
    
    // Calculate total score
    const totalScore = annualIncomePoints + employmentHistoryPoints + creditScorePoints + 
                        dtiRatioPoints + housingStatusPoints + delinquencyHistoryPoints;
    
    // Determine credit tier
    let creditTier = this.calculateCreditTier(totalScore);
    
    // Check for automatic disqualification factors
    if (this.hasDisqualificationFactors(data)) {
      creditTier = 'disqualified';
    }
    
    // Determine status based on credit tier
    let status: typeof underwritingStatusEnum.enumValues[number] = 'pending';
    let contingencies = '';
    
    switch (creditTier) {
      case 'tier1':
        status = 'approved';
        break;
      case 'tier2':
        status = 'approved';
        contingencies = 'Standard interest rate';
        break;
      case 'tier3':
        status = 'conditional';
        contingencies = 'Higher interest rate, Additional down payment may be required';
        break;
      case 'disqualified':
        status = 'declined';
        contingencies = 'Does not meet minimum requirements';
        break;
    }
    
    // Return the underwriting result
    return {
      creditProfileId: 0, // This will be set by the caller
      contractId: 0, // This will be set by the caller
      creditTier,
      status,
      totalScore,
      annualIncomePoints,
      employmentHistoryPoints,
      creditScorePoints,
      dtiRatioPoints,
      housingStatusPoints, 
      delinquencyHistoryPoints,
      annualIncome: data.annualIncome || undefined,
      dtiRatio: data.dtiRatio || undefined,
      contingencies,
      data: JSON.stringify({
        calculationDate: new Date().toISOString(),
        employmentYears: data.employmentYears,
        employmentType: data.employmentType,
        housingPayments: data.housingPayments,
        delinquencyHistory: data.delinquencyHistory,
      }),
    };
  }

  /**
   * Extract underwriting data from credit profile and other sources
   */
  extractUnderwritingData(creditProfile: CreditProfile, plaidData: any = null): UnderwritingData {
    const preFiData = creditProfile.preFiData ? JSON.parse(creditProfile.preFiData) : null;
    const plaidAssetsData = creditProfile.plaidAssetsData ? JSON.parse(creditProfile.plaidAssetsData) : null;
    
    logger.info({
      message: 'Extracting underwriting data from credit profile',
      category: 'contract',
      source: 'internal',
      metadata: {
        creditProfileId: creditProfile.id,
        hasPreFiData: !!preFiData,
        hasPlaidData: !!plaidAssetsData,
      },
    });
    
    // Extract available data
    const underwritingData: UnderwritingData = {
      creditScore: creditProfile.creditScore || (preFiData?.creditScore || null),
      annualIncome: preFiData?.annualIncome || null,
      dtiRatio: preFiData?.dtiRatio || null,
    };
    
    // Extract employment data if available
    if (preFiData?.employment) {
      underwritingData.employmentType = preFiData.employment.type;
      underwritingData.employmentYears = preFiData.employment.years;
    }
    
    // Extract housing payments data if available
    if (plaidAssetsData?.housingSummary) {
      underwritingData.housingPayments = plaidAssetsData.housingSummary.onTimePayments;
    }
    
    // Extract delinquency history if available
    if (preFiData?.delinquencyHistory) {
      underwritingData.delinquencyHistory = {
        lastMajorDelinquency: preFiData.delinquencyHistory.lastMajorDelinquency ? 
          new Date(preFiData.delinquencyHistory.lastMajorDelinquency) : null,
        recentLates: preFiData.delinquencyHistory.recentLates || null,
        bankruptcyDate: preFiData.delinquencyHistory.bankruptcyDate ? 
          new Date(preFiData.delinquencyHistory.bankruptcyDate) : null,
      };
    } else if (preFiData?.DataPerfection?.Bankruptcy && preFiData.DataPerfection.Bankruptcy.length > 0) {
      // If bankruptcy data is in the data perfection field
      underwritingData.delinquencyHistory = {
        bankruptcyDate: new Date(preFiData.DataPerfection.Bankruptcy[0])
      };
    }
    
    return underwritingData;
  }
}

// Create a singleton instance
export const underwritingService = new UnderwritingService();