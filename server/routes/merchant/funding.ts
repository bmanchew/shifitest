import { Request, Response } from 'express';
import { storage } from '../../storage';
import { logger } from '../../services/logger';
import { PlaidTransfer } from '@shared/schema';

/**
 * Get merchant funding history 
 * Shows all funding transfers sent to the merchant
 */
export async function getMerchantFunding(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const merchantId = parseInt(id);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid merchant ID'
      });
    }

    // Get all plaid transfers for this merchant that are funding (credits)
    const fundingTransfers = await storage.getPlaidTransfers({
      merchantId,
      type: 'credit', // Only get credits/funding sent to merchant
    });

    // Group transfers by date to create funding batches
    const batchesByDate = fundingTransfers.reduce<Record<string, PlaidTransfer[]>>((acc, transfer) => {
      // Handle when createdAt is null by using current date as fallback
      const createdDate = transfer.createdAt || new Date();
      
      // Format date as YYYY-MM-DD
      const transferDate = createdDate.toISOString().split('T')[0];
      
      if (!acc[transferDate]) {
        acc[transferDate] = [];
      }
      
      acc[transferDate].push(transfer);
      return acc;
    }, {});
    
    // Convert to array and calculate batch totals
    const fundingBatches = Object.entries(batchesByDate).map(([date, transfers]) => {
      const totalAmount = transfers.reduce((sum, t) => sum + (t.amount || 0), 0);
      const transferCount = transfers.length;
      
      return {
        date,
        batchTotal: totalAmount,
        transferCount,
        transfers: transfers.map(t => ({
          id: t.id,
          transferId: t.transferId,
          amount: t.amount,
          description: t.description,
          status: t.status,
          createdAt: t.createdAt,
          contractId: t.contractId,
          metadata: t.metadata ? JSON.parse(t.metadata) : null
        }))
      };
    });
    
    // Sort batches by date, newest first
    fundingBatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Get total funding received
    const totalFunding = fundingTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    // Get count of successful transfers
    const successfulTransfers = fundingTransfers.filter(t => 
      t.status === 'posted' || t.status === 'settled'
    ).length;
    
    res.json({
      success: true,
      fundingBatches,
      metrics: {
        totalFunding,
        totalTransfers: fundingTransfers.length,
        successfulTransfers
      }
    });
    
  } catch (error) {
    logger.error({
      message: `Failed to get merchant funding: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      // Use appropriate source category
      source: 'plaid', 
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch merchant funding data'
    });
  }
}

/**
 * Get details for a specific funding transfer
 */
export async function getFundingTransferDetails(req: Request, res: Response) {
  try {
    const { merchantId, transferId } = req.params;
    
    if (!merchantId || !transferId) {
      return res.status(400).json({
        success: false,
        message: 'Merchant ID and transfer ID are required'
      });
    }
    
    // Get the transfer details
    const transfer = await storage.getPlaidTransferByExternalId(transferId);
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }
    
    // Security check - ensure the transfer belongs to this merchant
    if (transfer.merchantId !== parseInt(merchantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Transfer does not belong to this merchant'
      });
    }
    
    // Get associated contract if available
    let contract = null;
    if (transfer.contractId) {
      contract = await storage.getContract(transfer.contractId);
    }
    
    res.json({
      success: true,
      transfer: {
        ...transfer,
        metadata: transfer.metadata ? JSON.parse(transfer.metadata) : null
      },
      contract: contract ? {
        id: contract.id,
        contractNumber: contract.contractNumber,
        amount: contract.amount,
        financedAmount: contract.financedAmount,
        status: contract.status
      } : null
    });
    
  } catch (error) {
    logger.error({
      message: `Failed to get funding transfer details: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      // Use appropriate source category
      source: 'plaid',
      metadata: {
        merchantId: req.params.merchantId,
        transferId: req.params.transferId,
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfer details'
    });
  }
}