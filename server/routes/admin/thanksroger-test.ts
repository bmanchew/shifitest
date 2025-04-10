import { Router } from 'express';
import { db } from '../../db';
import { contracts, applicationProgress } from '../../../shared/schema';
import { desc, and, eq, isNotNull } from 'drizzle-orm';
import fetch from 'node-fetch';
import { logger } from '../../services/logger';
import { authenticateToken, requireRole } from '../../middleware/auth';

const router = Router();

// Middleware to ensure only admins can access these endpoints
router.use(authenticateToken);
router.use(requireRole('admin'));

/**
 * Get all documents with Thanks Roger URLs
 */
router.get('/documents', async (req, res) => {
  try {
    // Find recently signed contracts
    const recentContracts = await db.select({
      id: contracts.id,
      contractNumber: contracts.contractNumber,
      status: contracts.status,
      signedAt: contracts.signedAt,
      merchantId: contracts.merchantId,
      customerId: contracts.customerId,
      externalDocumentId: contracts.externalDocumentId,
      externalSignatureId: contracts.externalSignatureId
    })
    .from(contracts)
    .where(
      and(
        contracts.status.in(['signed', 'active']),
        contracts.signedAt.isNotNull()
      )
    )
    .orderBy(desc(contracts.signedAt))
    .limit(50);

    const documentsWithUrls = [];

    // For each contract, try to find the document URL
    for (const contract of recentContracts) {
      // Try to find document URL in application progress
      const progressRecords = await db.select()
        .from(applicationProgress)
        .where(
          and(
            applicationProgress.contractId.eq(contract.id),
            applicationProgress.step.in(['signing', 'contract_signed', 'document_signed'])
          )
        )
        .limit(1);

      let documentUrl = null;
      
      // Extract document URL from metadata if available
      if (progressRecords.length > 0) {
        const progressRecord = progressRecords[0];
        
        try {
          if (progressRecord.data) {
            const metadata = typeof progressRecord.data === 'string' 
              ? JSON.parse(progressRecord.data) 
              : progressRecord.data;
              
            documentUrl = metadata.documentUrl;
          }
        } catch (error) {
          logger.error('Error parsing metadata:', {
            error: (error as Error).message,
            progressRecordId: progressRecord.id,
            contractId: contract.id
          });
        }
      }

      // If document URL found, add to the list
      if (documentUrl) {
        documentsWithUrls.push({
          id: contract.id,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          status: contract.status,
          signedAt: contract.signedAt,
          documentUrl,
          accessible: null,
          contentType: null
        });
      }
    }

    res.json({
      success: true,
      documents: documentsWithUrls
    });
  } catch (error) {
    logger.error('Error retrieving Thanks Roger documents:', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error retrieving document data',
      error: (error as Error).message
    });
  }
});

/**
 * Verify if a document URL is accessible
 */
router.get('/verify-document/:id', async (req, res) => {
  const contractId = parseInt(req.params.id);
  
  try {
    // Find the contract
    const contract = await db.select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);
      
    if (contract.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Find document URL from application progress
    const progressRecords = await db.select()
      .from(applicationProgress)
      .where(
        and(
          applicationProgress.contractId.eq(contractId),
          applicationProgress.step.in(['signing', 'contract_signed', 'document_signed'])
        )
      )
      .limit(1);
    
    let documentUrl = null;
    
    // Extract document URL from metadata
    if (progressRecords.length > 0) {
      const progressRecord = progressRecords[0];
      
      try {
        if (progressRecord.data) {
          const metadata = typeof progressRecord.data === 'string' 
            ? JSON.parse(progressRecord.data) 
            : progressRecord.data;
            
          documentUrl = metadata.documentUrl;
        }
      } catch (error) {
        logger.error('Error parsing metadata during verification:', {
          error: (error as Error).message,
          progressRecordId: progressRecord.id,
          contractId
        });
      }
    }

    // If no document URL, check contract fields
    if (!documentUrl && contract[0].externalDocumentId) {
      // Try to use the Thanks Roger API to get document details
      const thanksRogerApiKey = process.env.THANKS_ROGER_API_KEY || process.env.THANKSROGER_API_KEY;
      
      if (thanksRogerApiKey) {
        try {
          const response = await fetch(`https://api.thanksroger.com/v1/documents/${contract[0].externalDocumentId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${thanksRogerApiKey}`,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            documentUrl = data.downloadUrl || data.viewUrl || data.documentUrl;
          } else {
            logger.warn('Failed to retrieve document from Thanks Roger API:', {
              statusCode: response.status,
              statusText: response.statusText,
              contractId,
              externalDocumentId: contract[0].externalDocumentId
            });
          }
        } catch (error) {
          logger.error('Error fetching document from Thanks Roger API:', {
            error: (error as Error).message,
            contractId,
            externalDocumentId: contract[0].externalDocumentId
          });
        }
      }
    }

    if (!documentUrl) {
      return res.status(404).json({
        success: false,
        message: 'No document URL found for this contract'
      });
    }

    // Verify if the document URL is accessible
    try {
      const response = await fetch(documentUrl, { method: 'HEAD' });
      
      return res.json({
        success: true,
        accessible: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        documentUrl
      });
    } catch (error) {
      logger.error('Error accessing document URL:', {
        error: (error as Error).message,
        documentUrl,
        contractId
      });
      
      return res.json({
        success: true,
        accessible: false,
        error: (error as Error).message,
        documentUrl
      });
    }
  } catch (error) {
    logger.error('Error verifying document URL:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      contractId
    });
    
    res.status(500).json({
      success: false,
      message: 'Error verifying document URL',
      error: (error as Error).message
    });
  }
});

export default router;