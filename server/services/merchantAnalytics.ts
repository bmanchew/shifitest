
import { db } from "../db";
import { merchants, contracts, merchantPerformance } from "@shared/schema";
import { eq, and, count, avg, sum, sql } from "drizzle-orm";
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
    
    // Simulated customer satisfaction score (0-100)
    const customerSatisfactionScore = 85 + (Math.random() * 15);
    
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
