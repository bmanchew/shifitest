/**
 * Sales Rep Analytics Service
 * 
 * This service handles the calculation and management of sales rep analytics,
 * including commission calculations, performance tracking, and reporting.
 */

import { db } from "../db";
import { storage } from "../storage";
import { logger } from "./logger";
import { InsertSalesRepAnalytics, InsertCommission } from "../../shared/schema";

/**
 * Service for managing sales rep analytics and commissions
 */
export class SalesRepAnalyticsService {
  /**
   * Calculate and update the current period analytics for a given sales rep
   */
  async updateAnalyticsForSalesRep(salesRepId: number): Promise<void> {
    try {
      // Get the sales rep record
      const salesRep = await storage.getSalesRep(salesRepId);
      if (!salesRep) {
        logger.error({
          message: `Could not find sales rep with ID ${salesRepId}`,
          category: "api",
          source: "analytics",
          metadata: { salesRepId }
        });
        return;
      }

      // Get contracts associated with this sales rep
      const contracts = await storage.getContractsBySalesRepId(salesRepId);
      
      // Get commissions for this sales rep
      const commissions = await storage.getCommissionsBySalesRepId(salesRepId);
      
      // Calculate metrics
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // Filter for current month's contracts
      const currentMonthContracts = contracts.filter(
        contract => contract.createdAt && new Date(contract.createdAt) >= firstDayOfMonth && 
                    new Date(contract.createdAt) <= lastDayOfMonth
      );
      
      // Calculate contract values
      const contractsCount = currentMonthContracts.length;
      const contractsValue = currentMonthContracts.reduce(
        (sum, contract) => sum + (contract.amount || 0), 
        0
      );
      
      // Calculate commissions
      const currentMonthCommissions = commissions.filter(
        commission => commission.createdAt && new Date(commission.createdAt) >= firstDayOfMonth && 
                    new Date(commission.createdAt) <= lastDayOfMonth
      );
      
      const commissionEarned = currentMonthCommissions.reduce(
        (sum, commission) => sum + (commission.amount || 0), 
        0
      );
      
      const commissionPaid = currentMonthCommissions
        .filter(commission => commission.status === 'paid')
        .reduce((sum, commission) => sum + (commission.amount || 0), 0);
      
      // Calculate target achievement
      let targetAchievement = 0;
      if (salesRep.target && salesRep.target > 0) {
        targetAchievement = (contractsValue / salesRep.target) * 100;
      }
      
      // Calculate average contract value
      const averageContractValue = contractsCount > 0 
        ? contractsValue / contractsCount 
        : 0;
      
      // Calculate performance score (simple algorithm based on target achievement)
      const performanceScore = Math.min(Math.round(targetAchievement), 100);
      
      // Create analytics record
      const analyticsData: InsertSalesRepAnalytics = {
        salesRepId,
        period: 'monthly',
        periodStartDate: firstDayOfMonth,
        periodEndDate: lastDayOfMonth,
        contractsCount,
        contractsValue,
        commissionEarned,
        commissionPaid,
        targetAchievementPercentage: parseFloat(targetAchievement.toFixed(2)),
        averageContractValue: parseFloat(averageContractValue.toFixed(2)),
        performanceScore
      };
      
      // Check if we already have an analytics record for this period
      const existingAnalytics = await storage.getSalesRepAnalyticsByPeriod(
        salesRepId,
        'monthly',
        firstDayOfMonth
      );
      
      if (existingAnalytics) {
        // Update existing record
        await storage.updateSalesRepAnalytics(existingAnalytics.id, analyticsData);
        
        logger.info({
          message: `Updated analytics for sales rep ${salesRepId} for period ${firstDayOfMonth.toISOString().slice(0, 10)}`,
          category: "api",
          source: "analytics",
          metadata: { salesRepId, period: 'monthly' }
        });
      } else {
        // Create new record
        await storage.createSalesRepAnalytics(analyticsData);
        
        logger.info({
          message: `Created new analytics for sales rep ${salesRepId} for period ${firstDayOfMonth.toISOString().slice(0, 10)}`,
          category: "api",
          source: "analytics",
          metadata: { salesRepId, period: 'monthly' }
        });
      }
      
    } catch (error) {
      logger.error({
        message: `Error updating sales rep analytics: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "analytics",
        metadata: {
          salesRepId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
    }
  }
  
  /**
   * Calculate and create commission for a contract
   */
  async calculateCommissionForContract(contractId: number, salesRepId: number): Promise<any> {
    try {
      // Get the contract
      const contract = await storage.getContract(contractId);
      if (!contract) {
        logger.error({
          message: `Could not find contract with ID ${contractId}`,
          category: "api",
          source: "commission",
          metadata: { contractId, salesRepId }
        });
        return null;
      }
      
      // Get the sales rep
      const salesRep = await storage.getSalesRep(salesRepId);
      if (!salesRep) {
        logger.error({
          message: `Could not find sales rep with ID ${salesRepId}`,
          category: "api",
          source: "commission",
          metadata: { contractId, salesRepId }
        });
        return null;
      }
      
      // Calculate commission amount based on sales rep's commission rate and type
      let commissionAmount = 0;
      const commissionRate = salesRep.commissionRate || 0;
      const commissionRateType = salesRep.commissionRateType || 'percentage';
      
      if (commissionRateType === 'percentage') {
        commissionAmount = (contract.amount * commissionRate) / 100;
      } else {
        commissionAmount = commissionRate;
      }
      
      // Create commission record
      const commissionData: InsertCommission = {
        salesRepId,
        contractId,
        amount: commissionAmount,
        rate: commissionRate,
        rateType: commissionRateType,
        status: 'pending'
      };
      
      const commission = await storage.createCommission(commissionData);
      
      logger.info({
        message: `Created commission of $${commissionAmount} for sales rep ${salesRepId} on contract ${contractId}`,
        category: "api",
        source: "commission",
        metadata: {
          contractId,
          salesRepId,
          amount: commissionAmount,
          rateType: commissionRateType,
          rate: commissionRate
        }
      });
      
      // Update sales rep analytics
      await this.updateAnalyticsForSalesRep(salesRepId);
      
      return commission;
      
    } catch (error) {
      logger.error({
        message: `Error calculating commission: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "commission",
        metadata: {
          contractId,
          salesRepId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      return null;
    }
  }
  
  /**
   * Generate performance report for a sales rep
   */
  async generatePerformanceReport(salesRepId: number): Promise<any> {
    try {
      // Get the sales rep
      const salesRep = await storage.getSalesRep(salesRepId);
      if (!salesRep) {
        logger.error({
          message: `Could not find sales rep with ID ${salesRepId}`,
          category: "api",
          source: "analytics",
          metadata: { salesRepId }
        });
        return null;
      }
      
      // Get analytics for this sales rep (past 6 months)
      const analytics = await storage.getSalesRepAnalyticsBySalesRepId(salesRepId);
      const recentAnalytics = analytics.slice(0, 6); // Most recent 6 months
      
      // Get all contracts for this sales rep
      const contracts = await storage.getContractsBySalesRepId(salesRepId);
      
      // Get all commissions for this sales rep
      const commissions = await storage.getCommissionsBySalesRepId(salesRepId);
      
      // Calculate overall metrics
      const totalContractsCount = contracts.length;
      const totalContractsValue = contracts.reduce((sum, contract) => sum + (contract.amount || 0), 0);
      const totalCommissionEarned = commissions.reduce((sum, commission) => sum + (commission.amount || 0), 0);
      const totalCommissionPaid = commissions
        .filter(commission => commission.status === 'paid')
        .reduce((sum, commission) => sum + (commission.amount || 0), 0);
      
      const averageContractValue = totalContractsCount > 0 
        ? totalContractsValue / totalContractsCount 
        : 0;
      
      // Calculate trends
      const contractCountTrend = recentAnalytics
        .map(a => ({ period: a.periodStartDate, count: a.contractsCount }))
        .reverse(); // Oldest to newest
        
      const contractValueTrend = recentAnalytics
        .map(a => ({ period: a.periodStartDate, value: a.contractsValue }))
        .reverse();
        
      const commissionTrend = recentAnalytics
        .map(a => ({ period: a.periodStartDate, earned: a.commissionEarned, paid: a.commissionPaid }))
        .reverse();
        
      const performanceTrend = recentAnalytics
        .map(a => ({ period: a.periodStartDate, score: a.performanceScore }))
        .reverse();
      
      // Generate performance report
      const report = {
        salesRep: {
          id: salesRep.id,
          name: `${salesRep.title || 'Sales Rep'}`,
          active: salesRep.active,
          commissionRate: salesRep.commissionRate,
          commissionRateType: salesRep.commissionRateType,
          target: salesRep.target
        },
        summary: {
          totalContractsCount,
          totalContractsValue,
          totalCommissionEarned,
          totalCommissionPaid,
          averageContractValue,
          pendingCommission: totalCommissionEarned - totalCommissionPaid
        },
        trends: {
          contractCount: contractCountTrend,
          contractValue: contractValueTrend,
          commission: commissionTrend,
          performance: performanceTrend
        },
        currentMonthPerformance: recentAnalytics[0] || null
      };
      
      return report;
      
    } catch (error) {
      logger.error({
        message: `Error generating performance report: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "analytics",
        metadata: {
          salesRepId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      return null;
    }
  }
}

export const salesRepAnalyticsService = new SalesRepAnalyticsService();