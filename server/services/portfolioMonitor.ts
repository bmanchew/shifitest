
import { plaidService } from './plaid';
import { logger } from './logger';
import { storage } from '../storage';
import { underwritingService } from './underwriting';

/**
 * Service to handle scheduled portfolio monitoring activities:
 * 1. Regular credit checks using Pre-Fi (every 6 months)
 * 2. Periodic Plaid asset verification
 * 3. Portfolio health assessment
 */
export class PortfolioMonitorService {
  /**
   * Schedule a credit check for all active contracts
   */
  async scheduleAllCreditChecks() {
    try {
      logger.info({
        message: 'Starting scheduled credit checks for all active contracts',
        category: 'system',
        source: 'portfolio',
      });

      // Get all active contracts
      const activeContracts = await storage.getContractsByStatus('active');
      
      logger.info({
        message: `Found ${activeContracts.length} active contracts for credit check`,
        category: 'system',
        source: 'portfolio',
      });

      const results = {
        total: activeContracts.length,
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
      };

      // Process each contract
      for (const contract of activeContracts) {
        try {
          // Check if the contract has a customer
          if (!contract.customerId) {
            logger.warn({
              message: `Contract ${contract.id} has no customer ID, skipping credit check`,
              category: 'system',
              source: 'portfolio',
              metadata: { contractId: contract.id }
            });
            results.skipped++;
            continue;
          }

          // Get the latest underwriting data
          const underwritingData = await storage.getUnderwritingDataByContractId(contract.id);
          
          // Check if it's time for a new credit check (> 6 months since last check)
          const shouldCheckCredit = this.shouldPerformCreditCheck(underwritingData);
          
          if (!shouldCheckCredit) {
            logger.info({
              message: `Credit check not needed yet for contract ${contract.id}`,
              category: 'system',
              source: 'portfolio',
              metadata: { 
                contractId: contract.id,
                customerId: contract.customerId,
                lastCheckDate: underwritingData?.[0]?.updatedAt || 'never'
              }
            });
            results.skipped++;
            continue;
          }
          
          // Perform credit check
          logger.info({
            message: `Performing credit check for contract ${contract.id}`,
            category: 'system',
            source: 'portfolio',
            metadata: { 
              contractId: contract.id,
              customerId: contract.customerId 
            }
          });
          
          await underwritingService.processUnderwriting(contract.customerId, contract.id);
          
          results.success++;
        } catch (error) {
          logger.error({
            message: `Failed to process credit check for contract ${contract.id}: ${error instanceof Error ? error.message : String(error)}`,
            category: 'system',
            source: 'portfolio',
            metadata: {
              error: error instanceof Error ? error.stack : null,
              contractId: contract.id
            }
          });
          results.failed++;
        } finally {
          results.processed++;
        }
      }

      logger.info({
        message: 'Completed scheduled credit checks',
        category: 'system',
        source: 'portfolio',
        metadata: results
      });

      return results;
    } catch (error) {
      logger.error({
        message: `Failed to schedule credit checks: ${error instanceof Error ? error.message : String(error)}`,
        category: 'system',
        source: 'portfolio',
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }

  /**
   * Schedule asset verification for all active contracts
   */
  async scheduleAllAssetVerifications() {
    try {
      logger.info({
        message: 'Starting scheduled asset verifications for all active contracts',
        category: 'system',
        source: 'portfolio',
      });

      // Get all active contracts
      const activeContracts = await storage.getContractsByStatus('active');
      
      logger.info({
        message: `Found ${activeContracts.length} active contracts for asset verification`,
        category: 'system',
        source: 'portfolio',
      });

      const results = {
        total: activeContracts.length,
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
      };

      // Process each contract
      for (const contract of activeContracts) {
        try {
          // Check if the contract has bank information
          const progress = await storage.getApplicationProgressByContractId(contract.id);
          const bankStep = progress.find(step => step.step === 'bank' && step.completed);
          
          if (!bankStep || !bankStep.data) {
            logger.warn({
              message: `Contract ${contract.id} has no bank information, skipping asset verification`,
              category: 'system',
              source: 'portfolio',
              metadata: { contractId: contract.id }
            });
            results.skipped++;
            continue;
          }

          // Parse bank data to get the access token
          const bankData = JSON.parse(bankStep.data);
          
          // In a real implementation, you would retrieve the access token from your database
          // For this example, we'll assume it's stored in the bankData
          const accessToken = bankData.accessToken || null;
          
          if (!accessToken) {
            logger.warn({
              message: `No Plaid access token found for contract ${contract.id}, skipping asset verification`,
              category: 'system',
              source: 'portfolio',
              metadata: { contractId: contract.id }
            });
            results.skipped++;
            continue;
          }
          
          // Check if it's time for a new asset report (> 3 months since last check)
          // This would require tracking when the last asset report was created
          const shouldCheckAssets = true; // Implement your own logic here
          
          if (!shouldCheckAssets) {
            logger.info({
              message: `Asset verification not needed yet for contract ${contract.id}`,
              category: 'system',
              source: 'portfolio',
              metadata: { contractId: contract.id }
            });
            results.skipped++;
            continue;
          }
          
          // Create an asset report using Plaid
          logger.info({
            message: `Creating asset report for contract ${contract.id}`,
            category: 'system',
            source: 'portfolio',
            metadata: { contractId: contract.id }
          });
          
          const assetReport = await plaidService.createAssetReport({
            accessToken: accessToken,
            daysRequested: 90,
            clientReportId: `portfolio-monitor-${contract.id}-${Date.now()}`
          });
          
          // Store the asset report token for later retrieval
          // You would implement this function in your storage
          await storage.storeAssetReportToken(contract.id, assetReport.assetReportToken);
          
          logger.info({
            message: `Successfully created asset report for contract ${contract.id}`,
            category: 'system',
            source: 'portfolio',
            metadata: { 
              contractId: contract.id,
              assetReportId: assetReport.assetReportId
            }
          });
          
          results.success++;
        } catch (error) {
          logger.error({
            message: `Failed to create asset report for contract ${contract.id}: ${error instanceof Error ? error.message : String(error)}`,
            category: 'system',
            source: 'portfolio',
            metadata: {
              error: error instanceof Error ? error.stack : null,
              contractId: contract.id
            }
          });
          results.failed++;
        } finally {
          results.processed++;
        }
      }

      logger.info({
        message: 'Completed scheduled asset verifications',
        category: 'system',
        source: 'portfolio',
        metadata: results
      });

      return results;
    } catch (error) {
      logger.error({
        message: `Failed to schedule asset verifications: ${error instanceof Error ? error.message : String(error)}`,
        category: 'system',
        source: 'portfolio',
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }

  /**
   * Get portfolio health metrics
   */
  async getPortfolioHealthMetrics() {
    try {
      // Get all contracts
      const allContracts = await storage.getAllContracts();
      
      // Get underwriting data
      const underwritingData = await storage.getAllUnderwritingData();
      
      // Calculate metrics
      const metrics = {
        totalContracts: allContracts.length,
        activeContracts: allContracts.filter(c => c.status === 'active').length,
        totalFinancedAmount: allContracts.reduce((sum, c) => sum + c.financedAmount, 0),
        creditTierDistribution: {
          tier1: 0,
          tier2: 0,
          tier3: 0,
          declined: 0,
        },
        averageCreditScore: 0,
        averageDTIRatio: 0,
        averageIncome: 0,
        riskScore: 0, // Calculated risk score for the portfolio
      };
      
      // Calculate credit tier distribution and other metrics
      if (underwritingData.length > 0) {
        // Credit tier distribution
        underwritingData.forEach(data => {
          metrics.creditTierDistribution[data.creditTier]++;
        });
        
        // Average credit score
        const validCreditScores = underwritingData.filter(d => d.creditScore).map(d => d.creditScore);
        metrics.averageCreditScore = validCreditScores.length > 0 
          ? validCreditScores.reduce((sum, score) => sum + score, 0) / validCreditScores.length 
          : 0;
        
        // Average DTI ratio
        const validDTIRatios = underwritingData.filter(d => d.dtiRatio).map(d => d.dtiRatio);
        metrics.averageDTIRatio = validDTIRatios.length > 0 
          ? validDTIRatios.reduce((sum, ratio) => sum + ratio, 0) / validDTIRatios.length 
          : 0;
        
        // Average income
        const validIncomes = underwritingData.filter(d => d.annualIncome).map(d => d.annualIncome);
        metrics.averageIncome = validIncomes.length > 0 
          ? validIncomes.reduce((sum, income) => sum + income, 0) / validIncomes.length 
          : 0;
        
        // Calculate a risk score for the portfolio (simple example)
        const tier1Percentage = metrics.creditTierDistribution.tier1 / underwritingData.length;
        const tier2Percentage = metrics.creditTierDistribution.tier2 / underwritingData.length;
        const tier3Percentage = metrics.creditTierDistribution.tier3 / underwritingData.length;
        
        // Lower score is better
        metrics.riskScore = tier1Percentage * 1 + tier2Percentage * 2 + tier3Percentage * 3;
      }
      
      return metrics;
    } catch (error) {
      logger.error({
        message: `Failed to get portfolio health metrics: ${error instanceof Error ? error.message : String(error)}`,
        category: 'system',
        source: 'portfolio',
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }

  /**
   * Check if a credit check should be performed based on the last check date
   * @param underwritingData Array of underwriting data sorted by date (newest first)
   * @returns boolean indicating if a credit check should be performed
   */
  private shouldPerformCreditCheck(underwritingData: any[]): boolean {
    if (!underwritingData || underwritingData.length === 0) {
      // No previous underwriting data, should check
      return true;
    }
    
    // Get the most recent underwriting data
    const mostRecent = underwritingData[0];
    
    // Check if the last update was more than 6 months ago
    const lastUpdate = new Date(mostRecent.updatedAt || mostRecent.createdAt);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return lastUpdate < sixMonthsAgo;
  }
}

export const portfolioMonitorService = new PortfolioMonitorService();
