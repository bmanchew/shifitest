
import { db } from "../db";
import { merchants, contracts, merchantPerformance, customerSatisfactionSurveys } from "@shared/schema";
import { eq, and, count, avg, sum, sql, isNotNull, desc } from "drizzle-orm";
import { aiAnalyticsService } from "./aiAnalytics";

interface MerchantPerformanceMetrics {
  merchantId: number;
  defaultRate: number;
  latePaymentRate: number;
  avgContractValue: number;
  totalContracts: number;
  activeContracts: number;
  completedContracts: number;
  cancelledContracts: number;
  riskAdjustedReturn: number;
  customerSatisfactionScore: number;
}

class MerchantAnalyticsService {
  
  // Convert numerical score to letter grade
  private scoreToGrade(score: number): string {
    if (score >= 97) return "A+";
    if (score >= 93) return "A";
    if (score >= 90) return "A-";
    if (score >= 87) return "B+";
    if (score >= 83) return "B";
    if (score >= 80) return "B-";
    if (score >= 77) return "C+";
    if (score >= 73) return "C";
    if (score >= 70) return "C-";
    if (score >= 67) return "D+";
    if (score >= 63) return "D";
    if (score >= 60) return "D-";
    return "F";
  }
  
  // Calculate merchant performance metrics
  async calculateMerchantMetrics(merchantId: number): Promise<MerchantPerformanceMetrics> {
    try {
      // Get all contracts for merchant
      const merchantContracts = await db.select({
        id: contracts.id,
        status: contracts.status,
        amount: contracts.amount,
        financedAmount: contracts.financedAmount,
      }).from(contracts)
        .where(eq(contracts.merchantId, merchantId));
      
      // Calculate metrics
      const totalContracts = merchantContracts.length;
      const activeContracts = merchantContracts.filter(c => c.status === 'active').length;
      const completedContracts = merchantContracts.filter(c => c.status === 'completed').length;
      const cancelledContracts = merchantContracts.filter(c => c.status === 'cancelled').length;
      
      // Placeholder for metrics that would come from payment history in a real system
      // In a production system, these would be calculated from actual payment data
      const defaultRate = Math.random() * 0.1; // Simulated default rate (0-10%)
      const latePaymentRate = Math.random() * 0.2; // Simulated late payment rate (0-20%)
      
      // Calculate average contract value
      const totalValue = merchantContracts.reduce((sum, contract) => sum + contract.amount, 0);
      const avgContractValue = totalContracts > 0 ? totalValue / totalContracts : 0;
      
      // Risk-adjusted return (simplified calculation)
      const riskAdjustedReturn = (completedContracts / (totalContracts || 1)) * (1 - defaultRate) * 100;
      
      // Get customer satisfaction scores from surveys for this merchant's contracts
      let customerSatisfactionScore = 0;
      
      // Get all contract IDs for this merchant
      const contractIds = merchantContracts.map(contract => contract.id);
      
      if (contractIds.length > 0) {
        // Get all surveys with valid ratings for these contracts
        const surveysResult = await db.select({
          rating: customerSatisfactionSurveys.rating
        })
        .from(customerSatisfactionSurveys)
        .where(
          and(
            sql`${customerSatisfactionSurveys.contractId} IN (${contractIds.join(',')})`,
            isNotNull(customerSatisfactionSurveys.rating)
          )
        );
        
        // Calculate average satisfaction score
        if (surveysResult.length > 0) {
          // Calculate the sum of all ratings
          const ratingSum = surveysResult.reduce((sum, survey) => {
            // Convert rating to a 0-100 scale (ratings are 1-10)
            const normalizedRating = survey.rating ? (survey.rating * 10) : 0; 
            return sum + normalizedRating;
          }, 0);
          
          // Calculate average score on 0-100 scale
          customerSatisfactionScore = ratingSum / surveysResult.length;
        } else {
          // Default score if no surveys found (neutral score)
          customerSatisfactionScore = 75;
        }
      } else {
        // Default score if no contracts (neutral score)
        customerSatisfactionScore = 75;
      }
      
      return {
        merchantId,
        defaultRate,
        latePaymentRate,
        avgContractValue,
        totalContracts,
        activeContracts,
        completedContracts,
        cancelledContracts,
        riskAdjustedReturn,
        customerSatisfactionScore
      };
    } catch (error) {
      console.error("Error calculating merchant metrics:", error);
      // Return default values on error
      return {
        merchantId,
        defaultRate: 0.05,
        latePaymentRate: 0.1,
        avgContractValue: 0,
        totalContracts: 0,
        activeContracts: 0,
        completedContracts: 0,
        cancelledContracts: 0,
        riskAdjustedReturn: 0,
        customerSatisfactionScore: 75
      };
    }
  }
  
  // Calculate overall performance score based on metrics
  calculatePerformanceScore(metrics: MerchantPerformanceMetrics): number {
    // Weight factors for each metric
    const weights = {
      defaultRate: -30, // Negative impact
      latePaymentRate: -15, // Negative impact
      completionRate: 20,
      avgContractValue: 10,
      riskAdjustedReturn: 15,
      customerSatisfaction: 10
    };
    
    // Calculate completion rate
    const completionRate = metrics.totalContracts > 0 
      ? (metrics.completedContracts / metrics.totalContracts) 
      : 0;
    
    // Calculate score components
    const defaultScore = (1 - metrics.defaultRate) * weights.defaultRate;
    const latePaymentScore = (1 - metrics.latePaymentRate) * weights.latePaymentRate;
    const completionScore = completionRate * weights.completionRate;
    
    // Normalize avg contract value (assuming $5000 is a good benchmark)
    const normalizedContractValue = Math.min(metrics.avgContractValue / 5000, 1.5);
    const contractValueScore = normalizedContractValue * weights.avgContractValue;
    
    // Risk-adjusted return score (normalized to 0-1)
    const riskReturnScore = (metrics.riskAdjustedReturn / 100) * weights.riskAdjustedReturn;
    
    // Customer satisfaction score (normalized to 0-1)
    const satisfactionScore = (metrics.customerSatisfactionScore / 100) * weights.customerSatisfaction;
    
    // Calculate total score (base of 70 with adjustments)
    const rawScore = 70 + defaultScore + latePaymentScore + completionScore + 
                    contractValueScore + riskReturnScore + satisfactionScore;
    
    // Clamp score between 0-100
    return Math.max(0, Math.min(100, rawScore));
  }
  
  // Generate AI recommendations for underwriting based on merchant performance
  async generateUnderwritingRecommendations(merchantId: number, metrics: MerchantPerformanceMetrics, score: number): Promise<string> {
    // In a production environment, this would call the AI model with real data
    // For now, we'll generate recommendations based on the metrics
    
    const recommendations = [];
    
    if (metrics.defaultRate > 0.05) {
      recommendations.push("Consider tightening credit score requirements for this merchant's customers due to higher than average default rate.");
    }
    
    if (metrics.latePaymentRate > 0.15) {
      recommendations.push("Increase down payment requirements to mitigate risk of late payments.");
    }
    
    if (score < 75) {
      recommendations.push("Review merchant relationship and potentially adjust interest rates to account for higher risk profile.");
    }
    
    if (metrics.riskAdjustedReturn < 85) {
      recommendations.push("Decrease maximum loan amount to reduce exposure to this merchant segment.");
    }
    
    if (score > 90) {
      recommendations.push("Consider offering preferential terms to this high-performing merchant to increase volume.");
    }
    
    // If we have an AI analytics service, use it for more sophisticated recommendations
    try {
      const aiRecommendations = await aiAnalyticsService.getUnderwritingRecommendations(
        merchantId, 
        JSON.stringify(metrics),
        score
      );
      
      if (aiRecommendations && aiRecommendations.length > 0) {
        return aiRecommendations;
      }
    } catch (error) {
      console.error("Error getting AI recommendations:", error);
    }
    
    return JSON.stringify(recommendations);
  }
  
  // Update or create merchant performance record
  async updateMerchantPerformance(merchantId: number): Promise<void> {
    try {
      // Calculate metrics
      const metrics = await this.calculateMerchantMetrics(merchantId);
      
      // Calculate performance score
      const performanceScore = this.calculatePerformanceScore(metrics);
      
      // Determine grade based on score
      const grade = this.scoreToGrade(performanceScore);
      
      // Generate underwriting recommendations
      const recommendations = await this.generateUnderwritingRecommendations(
        merchantId, 
        metrics, 
        performanceScore
      );
      
      // Check if record exists
      const existingRecord = await db.select()
        .from(merchantPerformance)
        .where(eq(merchantPerformance.merchantId, merchantId))
        .limit(1);
      
      if (existingRecord.length > 0) {
        // Update existing record
        await db.update(merchantPerformance)
          .set({
            performanceScore,
            grade,
            defaultRate: metrics.defaultRate,
            latePaymentRate: metrics.latePaymentRate,
            avgContractValue: metrics.avgContractValue,
            totalContracts: metrics.totalContracts,
            activeContracts: metrics.activeContracts,
            completedContracts: metrics.completedContracts,
            cancelledContracts: metrics.cancelledContracts,
            riskAdjustedReturn: metrics.riskAdjustedReturn,
            customerSatisfactionScore: metrics.customerSatisfactionScore,
            underwritingRecommendations: recommendations,
            lastUpdated: new Date()
          })
          .where(eq(merchantPerformance.merchantId, merchantId));
      } else {
        // Create new record
        await db.insert(merchantPerformance).values({
          merchantId,
          performanceScore,
          grade,
          defaultRate: metrics.defaultRate,
          latePaymentRate: metrics.latePaymentRate,
          avgContractValue: metrics.avgContractValue,
          totalContracts: metrics.totalContracts,
          activeContracts: metrics.activeContracts,
          completedContracts: metrics.completedContracts,
          cancelledContracts: metrics.cancelledContracts,
          riskAdjustedReturn: metrics.riskAdjustedReturn,
          customerSatisfactionScore: metrics.customerSatisfactionScore,
          underwritingRecommendations: recommendations
        });
      }
    } catch (error) {
      console.error("Error updating merchant performance:", error);
      throw error;
    }
  }
  
  // Get merchant performance data
  async getMerchantPerformance(merchantId: number) {
    try {
      const performance = await db.select()
        .from(merchantPerformance)
        .where(eq(merchantPerformance.merchantId, merchantId))
        .limit(1);
      
      if (performance.length === 0) {
        // Calculate performance if not exists
        await this.updateMerchantPerformance(merchantId);
        return this.getMerchantPerformance(merchantId);
      }
      
      return performance[0];
    } catch (error) {
      console.error("Error getting merchant performance:", error);
      throw error;
    }
  }
  
  // Get all merchant performances for admin dashboard
  async getAllMerchantPerformances() {
    try {
      const performances = await db.select({
        id: merchantPerformance.id,
        merchantId: merchantPerformance.merchantId,
        merchantName: merchants.name,
        performanceScore: merchantPerformance.performanceScore,
        grade: merchantPerformance.grade,
        defaultRate: merchantPerformance.defaultRate,
        totalContracts: merchantPerformance.totalContracts,
        activeContracts: merchantPerformance.activeContracts,
        riskAdjustedReturn: merchantPerformance.riskAdjustedReturn,
        lastUpdated: merchantPerformance.lastUpdated
      })
      .from(merchantPerformance)
      .innerJoin(merchants, eq(merchantPerformance.merchantId, merchants.id))
      .orderBy(merchantPerformance.performanceScore);
      
      return performances;
    } catch (error) {
      console.error("Error getting all merchant performances:", error);
      throw error;
    }
  }
  
  // Update all merchant performances (for scheduled job)
  async updateAllMerchantPerformances() {
    try {
      const allMerchants = await db.select().from(merchants);
      
      for (const merchant of allMerchants) {
        await this.updateMerchantPerformance(merchant.id);
      }
      
      return { success: true, count: allMerchants.length };
    } catch (error) {
      console.error("Error updating all merchant performances:", error);
      throw error;
    }
  }
}

export const merchantAnalyticsService = new MerchantAnalyticsService();
import { db } from "../db";
import { 
  eq, 
  and, 
  or, 
  not, 
  count, 
  sum, 
  avg, 
  sql 
} from "drizzle-orm";
import { contracts, merchantPerformance, merchants } from "@shared/schema";
import { logger } from "./logger";

export class MerchantAnalyticsService {
  // Calculate merchant performance metrics
  async calculateMerchantMetrics(merchantId: number) {
    try {
      // Get all contracts for this merchant
      const merchantContracts = await db.select()
        .from(contracts)
        .where(eq(contracts.merchantId, merchantId));
      
      // Total contracts
      const totalContracts = merchantContracts.length;
      
      // Active contracts
      const activeContracts = merchantContracts.filter(c => c.status === 'active').length;
      
      // Completed contracts
      const completedContracts = merchantContracts.filter(c => c.status === 'completed').length;
      
      // Cancelled contracts
      const cancelledContracts = merchantContracts.filter(c => c.status === 'cancelled').length;
      
      // Default rate (contracts marked as defaulted / total contracts)
      const defaultedContracts = merchantContracts.filter(c => c.status === 'defaulted').length;
      const defaultRate = totalContracts > 0 ? (defaultedContracts / totalContracts) * 100 : 0;
      
      // Late payment rate - this would require payment history
      // For now, we'll use a placeholder value
      const latePaymentRate = 0;
      
      // Average contract value
      const avgContractValue = totalContracts > 0 
        ? merchantContracts.reduce((sum, c) => sum + c.amount, 0) / totalContracts 
        : 0;
      
      // Risk-adjusted return - simple placeholder calculation
      // In a real system, this would be much more sophisticated
      const riskAdjustedReturn = (1 - (defaultRate / 100)) * 15; // Assuming 15% base return
      
      // Customer satisfaction score - would come from survey data
      // For now, use a placeholder value
      const customerSatisfactionScore = await this.getCustomerSatisfactionScore(merchantId);
      
      return {
        defaultRate,
        latePaymentRate,
        avgContractValue,
        totalContracts,
        activeContracts,
        completedContracts,
        cancelledContracts,
        riskAdjustedReturn,
        customerSatisfactionScore
      };
    } catch (error) {
      console.error("Error calculating merchant metrics:", error);
      throw error;
    }
  }
  
  // Calculate a merchant's performance score based on metrics
  calculatePerformanceScore(metrics: any) {
    // Score components:
    // - Default rate (lower is better)
    // - Average contract value (higher is better, to a point)
    // - Active contracts (more is better)
    // - Customer satisfaction (higher is better)
    
    try {
      // Default rate score (0-25 points)
      const defaultRateScore = Math.max(0, 25 - (metrics.defaultRate * 2.5));
      
      // Contract volume score (0-25 points)
      const volumeScore = Math.min(25, metrics.totalContracts / 2);
      
      // Average value score (0-25 points)
      const valueScore = Math.min(25, (metrics.avgContractValue / 1000) * 2.5);
      
      // Customer satisfaction score (0-25 points)
      const satisfactionScore = (metrics.customerSatisfactionScore / 10) * 25;
      
      // Final score (0-100)
      const score = Math.round(defaultRateScore + volumeScore + valueScore + satisfactionScore);
      
      return Math.min(100, Math.max(0, score));
    } catch (error) {
      console.error("Error calculating performance score:", error);
      return 0;
    }
  }
  
  // Convert numerical score to letter grade
  scoreToGrade(score: number) {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    if (score >= 45) return 'D+';
    if (score >= 40) return 'D';
    if (score >= 35) return 'D-';
    return 'F';
  }
  
  // Get customer satisfaction score for a merchant
  async getCustomerSatisfactionScore(merchantId: number) {
    try {
      // Query customer satisfaction survey data
      // This is just a placeholder implementation
      // In a real system, you would have a surveys table to query
      
      // For now, return a random score between 7 and 10
      return 7 + Math.random() * 3;
    } catch (error) {
      console.error("Error getting customer satisfaction score:", error);
      return 7.5; // Default middle score
    }
  }
  
  // Generate underwriting recommendations
  async generateUnderwritingRecommendations(merchantId: number, metrics: any, score: number) {
    const recommendations = [];
    
    // Add recommendations based on metrics
    if (metrics.defaultRate > 5) {
      recommendations.push({
        type: "risk",
        title: "High Default Rate",
        description: `The merchant has a default rate of ${metrics.defaultRate.toFixed(1)}%, which is above the recommended threshold of 5%.`,
        action: "Increase down payment requirements for this merchant's customers."
      });
    }
    
    if (metrics.totalContracts < 10) {
      recommendations.push({
        type: "volume",
        title: "Low Contract Volume",
        description: "The merchant has a low volume of contracts, making risk assessment less reliable.",
        action: "Monitor closely and gather more data before increasing financing limits."
      });
    }
    
    if (score < 60) {
      recommendations.push({
        type: "approval",
        title: "Below Average Performance",
        description: `The merchant's performance score of ${score} (${this.scoreToGrade(score)}) is below the recommended threshold for automatic approvals.`,
        action: "Require manual review for new financing applications from this merchant."
      });
    }
    
    // Try to get AI-powered recommendations
    try {
      // In a real implementation, this would use an AI service
      // For now, we'll just use our basic recommendations
    } catch (error) {
      console.error("Error getting AI recommendations:", error);
    }
    
    return JSON.stringify(recommendations);
  }
  
  // Get merchant performance data
  async getMerchantPerformance(merchantId: number) {
    try {
      const performance = await db.select()
        .from(merchantPerformance)
        .where(eq(merchantPerformance.merchantId, merchantId))
        .limit(1);
      
      if (performance.length === 0) {
        // Calculate performance if not exists
        await this.updateMerchantPerformance(merchantId);
        return this.getMerchantPerformance(merchantId);
      }
      
      return performance[0];
    } catch (error) {
      console.error("Error getting merchant performance:", error);
      throw error;
    }
  }
  
  // Get all merchant performances for admin dashboard
  async getAllMerchantPerformances() {
    try {
      const performances = await db.select({
        id: merchantPerformance.id,
        merchantId: merchantPerformance.merchantId,
        merchantName: merchants.name,
        performanceScore: merchantPerformance.performanceScore,
        grade: merchantPerformance.grade,
        defaultRate: merchantPerformance.defaultRate,
        totalContracts: merchantPerformance.totalContracts,
        activeContracts: merchantPerformance.activeContracts,
        riskAdjustedReturn: merchantPerformance.riskAdjustedReturn,
        lastUpdated: merchantPerformance.lastUpdated
      })
      .from(merchantPerformance)
      .innerJoin(merchants, eq(merchantPerformance.merchantId, merchants.id))
      .orderBy(merchantPerformance.performanceScore);
      
      return performances;
    } catch (error) {
      console.error("Error getting all merchant performances:", error);
      throw error;
    }
  }
  
  // Update or create merchant performance record
  async updateMerchantPerformance(merchantId: number): Promise<void> {
    try {
      // Calculate metrics
      const metrics = await this.calculateMerchantMetrics(merchantId);
      
      // Calculate performance score
      const performanceScore = this.calculatePerformanceScore(metrics);
      
      // Determine grade based on score
      const grade = this.scoreToGrade(performanceScore);
      
      // Generate underwriting recommendations
      const recommendations = await this.generateUnderwritingRecommendations(
        merchantId, 
        metrics, 
        performanceScore
      );
      
      // Check if record exists
      const existingRecord = await db.select()
        .from(merchantPerformance)
        .where(eq(merchantPerformance.merchantId, merchantId))
        .limit(1);
      
      if (existingRecord.length > 0) {
        // Update existing record
        await db.update(merchantPerformance)
          .set({
            performanceScore,
            grade,
            defaultRate: metrics.defaultRate,
            latePaymentRate: metrics.latePaymentRate,
            avgContractValue: metrics.avgContractValue,
            totalContracts: metrics.totalContracts,
            activeContracts: metrics.activeContracts,
            completedContracts: metrics.completedContracts,
            cancelledContracts: metrics.cancelledContracts,
            riskAdjustedReturn: metrics.riskAdjustedReturn,
            customerSatisfactionScore: metrics.customerSatisfactionScore,
            underwritingRecommendations: recommendations,
            lastUpdated: new Date()
          })
          .where(eq(merchantPerformance.id, existingRecord[0].id));
      } else {
        // Create new record
        await db.insert(merchantPerformance)
          .values({
            merchantId,
            performanceScore,
            grade,
            defaultRate: metrics.defaultRate,
            latePaymentRate: metrics.latePaymentRate,
            avgContractValue: metrics.avgContractValue,
            totalContracts: metrics.totalContracts,
            activeContracts: metrics.activeContracts,
            completedContracts: metrics.completedContracts,
            cancelledContracts: metrics.cancelledContracts,
            riskAdjustedReturn: metrics.riskAdjustedReturn,
            customerSatisfactionScore: metrics.customerSatisfactionScore,
            underwritingRecommendations: recommendations,
            lastUpdated: new Date()
          });
      }
      
      logger.info({
        message: `Updated merchant performance for merchant ${merchantId}`,
        category: "system",
        source: "analytics",
        metadata: {
          merchantId,
          performanceScore,
          grade
        }
      });
    } catch (error) {
      logger.error({
        message: `Failed to update merchant performance: ${error instanceof Error ? error.message : String(error)}`,
        category: "system",
        source: "analytics",
        metadata: {
          merchantId,
          error: error instanceof Error ? error.stack : null
        }
      });
      
      throw error;
    }
  }
}

// Create and export service instance
export const merchantAnalyticsService = new MerchantAnalyticsService();
