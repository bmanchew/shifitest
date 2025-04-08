/**
 * Zapier integration service for sending and receiving data from Zapier
 */
import axios from 'axios';
import { db } from '../db';
import { applicationProgress, contracts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger, LogSource } from '../utils/logger';

export interface ZapierApplicationData {
  contractId: number;
  contractNumber: string; 
  merchantId: number;
  merchantName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  financedAmount: number;
  downPayment: number;
  monthlyPayment: number;
  termMonths: number;
  interestRate: number;
  programName: string;
  applicationDate: string;
  status?: string;
  currentStep?: string;
  customFields?: Record<string, any>;
}

export interface ZapierContractStatusUpdate {
  contractNumber: string;
  contractId: number;
  status: string;
  applicationProgress?: {
    step?: string;
    completed?: boolean;
  };
  notes?: string;
  externalId?: string;
  approvedAmount?: number;
}

interface ZapierWebhookResponse {
  success: boolean;
  message?: string;
  status?: number;
  data?: any;
}

class ZapierService {
  /**
   * Send application data to a Zapier webhook
   * 
   * @param webhookUrl The webhook URL to send data to
   * @param data The application data to send
   */
  async sendApplicationToZapier(
    webhookUrl: string,
    data: ZapierApplicationData
  ): Promise<boolean> {
    try {
      if (!webhookUrl) {
        logger.error({
          message: 'No webhook URL provided for Zapier integration',
          category: 'integration',
          source: 'zapier' as LogSource,
          metadata: {
            contractId: data.contractId,
            contractNumber: data.contractNumber,
            merchantId: data.merchantId
          }
        });
        
        return false;
      }
      
      logger.info({
        message: `Sending application data to Zapier webhook: ${data.contractNumber}`,
        category: 'integration',
        source: 'zapier' as LogSource,
        metadata: {
          contractId: data.contractId,
          contractNumber: data.contractNumber,
          merchantId: data.merchantId,
          webhookUrl: '(URL redacted)'
        }
      });
      
      // Send the data to Zapier
      const response = await axios.post(webhookUrl, data, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ShiFi-API/1.0'
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.status >= 200 && response.status < 300) {
        logger.info({
          message: `Successfully sent application data to Zapier: ${data.contractNumber}`,
          category: 'integration',
          source: 'zapier',
          metadata: {
            contractId: data.contractId,
            contractNumber: data.contractNumber,
            merchantId: data.merchantId,
            status: response.status,
            responseData: response.data
          }
        });
        
        return true;
      } else {
        logger.error({
          message: `Failed to send application data to Zapier: ${data.contractNumber}`,
          category: 'integration',
          source: 'zapier',
          metadata: {
            contractId: data.contractId,
            contractNumber: data.contractNumber,
            merchantId: data.merchantId,
            status: response.status,
            responseData: response.data
          }
        });
        
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({
        message: `Error sending application data to Zapier: ${errorMessage}`,
        category: 'integration',
        source: 'zapier',
        metadata: {
          contractId: data.contractId,
          contractNumber: data.contractNumber,
          merchantId: data.merchantId,
          error: errorMessage
        }
      });
      
      return false;
    }
  }
  
  /**
   * Update contract status based on webhook data from Zapier
   * 
   * @param updateData The contract status update data
   */
  async updateContractStatus(updateData: ZapierContractStatusUpdate): Promise<boolean> {
    try {
      // Find the contract by ID
      const contract = await db.query.contracts.findFirst({
        where: eq(contracts.id, updateData.contractId)
      });
      
      if (!contract) {
        logger.error({
          message: `Contract not found for Zapier update: ${updateData.contractNumber}`,
          category: 'integration',
          source: 'zapier',
          metadata: {
            contractId: updateData.contractId,
            contractNumber: updateData.contractNumber
          }
        });
        
        return false;
      }
      
      // Verify contract number matches for security
      if (contract.contractNumber !== updateData.contractNumber) {
        logger.error({
          message: `Contract number mismatch in Zapier update: ${updateData.contractNumber}`,
          category: 'security',
          source: 'zapier',
          metadata: {
            contractId: updateData.contractId,
            providedContractNumber: updateData.contractNumber,
            actualContractNumber: contract.contractNumber
          }
        });
        
        return false;
      }
      
      const updates: Record<string, any> = {};
      
      // Update contract status if provided
      if (updateData.status) {
        // Validate status is a valid contract status
        // For simplicity, we're just assigning it directly here
        // In production, you'd want to validate this against valid statuses
        updates.status = updateData.status;
      }
      
      // Update approved amount if provided
      if (typeof updateData.approvedAmount === 'number' && updateData.approvedAmount > 0) {
        updates.amount = updateData.approvedAmount;
        updates.financedAmount = updateData.approvedAmount - contract.downPayment;
        
        // Recalculate monthly payment based on new amount (simple formula)
        if (contract.termMonths > 0) {
          const principal = updateData.approvedAmount - contract.downPayment;
          const monthlyInterestRate = contract.interestRate / 100 / 12;
          
          // If interest rate is zero, simple division
          if (monthlyInterestRate === 0) {
            updates.monthlyPayment = principal / contract.termMonths;
          } else {
            // Standard amortization formula
            const monthlyPayment = principal * 
              (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, contract.termMonths)) / 
              (Math.pow(1 + monthlyInterestRate, contract.termMonths) - 1);
            
            updates.monthlyPayment = parseFloat(monthlyPayment.toFixed(2));
          }
        }
      }
      
      // Update application progress if provided
      if (updateData.applicationProgress) {
        // If there's a step, validate and update the current step
        if (updateData.applicationProgress.step) {
          // Again, for simplicity, we're directly assigning the step
          // In production, validate against valid step names
          updates.currentStep = updateData.applicationProgress.step;
          
          // Also add a record to the application progress table
          if (updateData.applicationProgress.step) {
            try {
              // Check if entry already exists
              const existingProgress = await db.query.applicationProgress.findFirst({
                where: eq(applicationProgress.contractId, updateData.contractId),
                orderBy: (applicationProgress, { desc }) => [desc(applicationProgress.createdAt)]
              });
              
              // Only create new entry if the step is different
              if (!existingProgress || existingProgress.step !== updateData.applicationProgress.step) {
                await db.insert(applicationProgress).values({
                  contractId: updateData.contractId,
                  step: updateData.applicationProgress.step as any, // Casting needed due to enum type
                  completed: updateData.applicationProgress.completed || false,
                  data: JSON.stringify({
                    source: 'zapier',
                    timestamp: new Date().toISOString(),
                    notes: updateData.notes || 'Updated via Zapier webhook'
                  })
                });
              }
            } catch (innerError) {
              const errorMessage = innerError instanceof Error ? innerError.message : String(innerError);
              
              logger.error({
                message: `Failed to update application progress: ${errorMessage}`,
                category: 'integration',
                source: 'zapier',
                metadata: {
                  contractId: updateData.contractId,
                  step: updateData.applicationProgress.step,
                  error: errorMessage
                }
              });
            }
          }
        }
      }
      
      // Only update if we have changes to make
      if (Object.keys(updates).length > 0) {
        await db.update(contracts)
          .set(updates)
          .where(eq(contracts.id, updateData.contractId));
        
        logger.info({
          message: `Updated contract ${updateData.contractNumber} via Zapier webhook`,
          category: 'integration',
          source: 'zapier',
          metadata: {
            contractId: updateData.contractId,
            contractNumber: updateData.contractNumber,
            updates
          }
        });
        
        return true;
      }
      
      return true; // Return success even if no updates were made
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({
        message: `Error updating contract status from Zapier: ${errorMessage}`,
        category: 'integration',
        source: 'zapier',
        metadata: {
          contractId: updateData.contractId,
          contractNumber: updateData.contractNumber,
          error: errorMessage
        }
      });
      
      return false;
    }
  }
  
  /**
   * Validate a webhook URL to ensure it's properly formatted
   * 
   * @param url The webhook URL to validate
   */
  validateWebhookUrl(url: string | null): boolean {
    if (!url) return false;
    
    try {
      const parsed = new URL(url);
      // Basic validation that it's a Zapier webhook
      return parsed.hostname.includes('zapier.com') || 
        parsed.hostname.includes('hooks.zapier.com') ||
        parsed.hostname.includes('hooks.zap.site');
    } catch (e) {
      return false;
    }
  }
}

export const zapierService = new ZapierService();