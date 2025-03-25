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

// Define performance metrics interface
interface MerchantPerformanceMetrics {
  totalContracts: number;
  activeContracts: number;
  completedContracts: number;
  cancelledContracts: number;
  defaultRate: number;
  latePaymentRate: number;
  avgContractValue: number;
  riskAdjustedReturn: number;
  customerSatisfactionScore: number;
}

export class MerchantAnalyticsService {

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

      // Calculate default rate
      const defaultedContracts = merchantContracts.filter(c => c.status === 'defaulted').length;
      const defaultRate = totalContracts > 0 ? (defaultedContracts / totalContracts) * 100 : 0;

      // Placeholder for metrics that would come from payment history in a real system
      // For demo purposes, we're generating placeholder values
      const latePaymentRate = Math.random() * 10; // Random value between 0-10%

      // Calculate average contract value
      const avgContractValue = totalContracts > 0 
        ? merchantContracts.reduce((sum, c) => sum + Number(c.amount), 0) / totalContracts 
        : 0;

      // Risk-adjusted return - simplified calculation
      // In a real system, this would be based on actual payment data
      const riskAdjustedReturn = 100 - (defaultRate * 5) - (latePaymentRate * 2);

      // Generate a random customer satisfaction score for demo
      const customerSatisfactionScore = 70 + Math.random() * 30; // Random value between 70-100

      return {
        totalContracts,
        activeContracts,
        completedContracts,
        cancelledContracts,
        defaultRate,
        latePaymentRate,
        avgContractValue,
        riskAdjustedReturn,
        customerSatisfactionScore
      };
    } catch (error) {
      logger.error({
        message: "Error calculating merchant metrics",
        error,
        category: "service",
        source: "analytics",
        metadata: { merchantId }
      });

      // Return zero values for metrics on error
      return {
        totalContracts: 0,
        activeContracts: 0,
        completedContracts: 0,
        cancelledContracts: 0,
        defaultRate: 0,
        latePaymentRate: 0,
        avgContractValue: 0,
        riskAdjustedReturn: 0,
        customerSatisfactionScore: 0
      };
    }
  }

  // Calculate performance score based on metrics
  async calculatePerformanceScore(merchantId: number, metrics: MerchantPerformanceMetrics): Promise<number> {
    // Weight factors for different metrics
    const weights = {
      defaultRate: -2.5,       // Higher default rates reduce score significantly
      latePaymentRate: -1.5,   // Late payments reduce score
      avgContractValue: 0.1,   // Higher contract values slightly increase score
      riskAdjustedReturn: 0.7, // Higher risk-adjusted returns increase score
      customerSatisfaction: 0.5 // Customer satisfaction increases score
    };

    // Calculate weighted score components

    // Default rate score (inverse relationship - lower default rate is better)
    // 0% default rate = 100 points, 10%+ default rate = 0 points
    const defaultRateScore = Math.max(0, 100 - (metrics.defaultRate * 10)) * weights.defaultRate;

    // Late payment rate score (inverse relationship - lower late payment rate is better)
    // 0% late payment rate = 100 points, 20%+ late payment rate = 0 points
    const latePaymentScore = Math.max(0, 100 - (metrics.latePaymentRate * 5)) * weights.latePaymentRate;

    // Contract value score 
    // Scale based on average contract value - this would be calibrated based on business
    // For demo, we'll say $5000 = 50 points
    const contractValueScore = Math.min(100, (metrics.avgContractValue / 100)) * weights.avgContractValue;

    // Risk-adjusted return score
    // Direct relationship - higher risk-adjusted return is better
    const riskReturnScore = metrics.riskAdjustedReturn * weights.riskAdjustedReturn;

    // Customer satisfaction score
    // Direct relationship - higher satisfaction is better
    const satisfactionScore = metrics.customerSatisfactionScore * weights.customerSatisfaction;

    // Calculate raw score by summing components
    // Base score starts at 50 points
    const rawScore = 50 + defaultRateScore + latePaymentScore + 
      contractValueScore + riskReturnScore + satisfactionScore;

    // Clamp score between 0-100
    return Math.max(0, Math.min(100, rawScore));
  }

  // Generate AI recommendations for underwriting based on merchant performance
  async generateUnderwritingRecommendations(merchantId: number, metrics: MerchantPerformanceMetrics, score: number): Promise<string> {
    // In a production environment, this would call the AI model with real data
    // For now, we'll generate recommendations based on the metrics

    const recommendations = [];

    if (metrics.defaultRate > 5) {
      recommendations.push("Consider tightening credit score requirements for this merchant's customers due to higher than average default rate.");
    }

    if (metrics.latePaymentRate > 15) {
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

    // If no specific recommendations, provide a general one
    if (recommendations.length === 0) {
      recommendations.push("Maintain current underwriting standards for this merchant. Performance is within acceptable parameters.");
    }

    return recommendations.join("\n\n");
  }

  // Create or update a merchant's performance record
  async updateMerchantPerformance(merchantId: number): Promise<any> {
    try {
      logger.info({
        message: "Updating merchant performance analysis",
        category: "service",
        source: "analytics",
        metadata: { merchantId }
      });

      // Calculate metrics
      const metrics = await this.calculateMerchantMetrics(merchantId);

      // Calculate score
      const score = await this.calculatePerformanceScore(merchantId, metrics);

      // Generate grade
      const grade = this.scoreToGrade(score);

      // Generate recommendations
      const recommendations = await this.generateUnderwritingRecommendations(
        merchantId, 
        metrics, 
        score
      );

      // Create or update performance record
      const result = await db
        .insert(merchantPerformance)
        .values({
          merchantId,
          performanceScore: score,
          performanceGrade: grade,
          defaultRate: metrics.defaultRate,
          latePaymentRate: metrics.latePaymentRate,
          avgContractValue: metrics.avgContractValue,
          riskAdjustedReturn: metrics.riskAdjustedReturn,
          customerSatisfactionScore: metrics.customerSatisfactionScore,
          recommendations,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: merchantPerformance.merchantId,
          set: {
            performanceScore: score,
            performanceGrade: grade,
            defaultRate: metrics.defaultRate,
            latePaymentRate: metrics.latePaymentRate,
            avgContractValue: metrics.avgContractValue,
            riskAdjustedReturn: metrics.riskAdjustedReturn,
            customerSatisfactionScore: metrics.customerSatisfactionScore,
            recommendations,
            updatedAt: new Date(),
          }
        })
        .returning();

      return result[0];
    } catch (error) {
      logger.error({
        message: "Failed to update merchant performance",
        error,
        category: "service",
        source: "analytics",
        metadata: { merchantId }
      });

      throw error;
    }
  }

  // Get merchant performance for a specific merchant
  async getMerchantPerformance(merchantId: number) {
    try {
      const result = await db
        .select()
        .from(merchantPerformance)
        .where(eq(merchantPerformance.merchantId, merchantId));

      return result[0] || null;
    } catch (error) {
      logger.error({
        message: "Error retrieving merchant performance",
        error,
        category: "service",
        source: "analytics",
        metadata: { merchantId }
      });

      throw error;
    }
  }

  // Get contract summary for a merchant
  async getContractSummary(merchantId: number) {
    try {
      // Get contracts by status
      const contractsByStatus = await db
        .select({
          status: contracts.status,
          count: count(),
          totalAmount: sum(contracts.amount),
          avgAmount: avg(contracts.amount)
        })
        .from(contracts)
        .where(eq(contracts.merchantId, merchantId))
        .groupBy(contracts.status);

      // Generate summary object
      const summary = {
        total: {
          count: 0,
          amount: 0,
          avgAmount: 0
        },
        active: {
          count: 0,
          amount: 0,
          avgAmount: 0
        },
        completed: {
          count: 0,
          amount: 0,
          avgAmount: 0
        },
        cancelled: {
          count: 0,
          amount: 0,
          avgAmount: 0
        },
        defaulted: {
          count: 0,
          amount: 0,
          avgAmount: 0
        }
      };

      // Process contract data
      contractsByStatus.forEach(status => {
        // Add to total
        summary.total.count += Number(status.count);
        summary.total.amount += Number(status.totalAmount || 0);

        // Add to specific status
        if (status.status && summary[status.status]) {
          summary[status.status].count = Number(status.count);
          summary[status.status].amount = Number(status.totalAmount || 0);
          summary[status.status].avgAmount = Number(status.avgAmount || 0);
        }
      });

      // Calculate total average
      if (summary.total.count > 0) {
        summary.total.avgAmount = summary.total.amount / summary.total.count;
      }

      return summary;
    } catch (error) {
      logger.error({
        message: "Error getting contract summary",
        error,
        category: "service",
        source: "analytics",
        metadata: { merchantId }
      });

      throw error;
    }
  }

  // Get merchants sorted by performance
  async getMerchantsByPerformance(limit = 10) {
    try {
      // Join merchant performance with merchant data
      const topMerchants = await db
        .select({
          merchantId: merchantPerformance.merchantId,
          businessName: merchants.businessName,
          performanceScore: merchantPerformance.performanceScore,
          performanceGrade: merchantPerformance.performanceGrade,
          defaultRate: merchantPerformance.defaultRate,
          avgContractValue: merchantPerformance.avgContractValue,
        })
        .from(merchantPerformance)
        .innerJoin(merchants, eq(merchantPerformance.merchantId, merchants.id))
        .orderBy(sql`${merchantPerformance.performanceScore} DESC`)
        .limit(limit);

      return topMerchants;
    } catch (error) {
      logger.error({
        message: "Error retrieving top performing merchants",
        error,
        category: "service",
        source: "analytics"
      });

      throw error;
    }
  }
}

// Create and export service instance
export const merchantAnalyticsService = new MerchantAnalyticsService();