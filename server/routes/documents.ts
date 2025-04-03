import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../services/logger';

// Create a router with strict path pattern matching
const documentsRouter = express.Router({
  strict: true,
  caseSensitive: true
});

// Apply authentication to all routes in this router
documentsRouter.use(authenticateToken);

/**
 * Get contract documents for a specific contract
 */
documentsRouter.get("/contract/:id", async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.id, 10);
    const { role, merchantId } = req.user || {};
    
    // Check permissions - only admin or merchant can access
    if (!role || (role !== 'admin' && !merchantId)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access contract documents"
      });
    }
    
    // Get the contract to verify ownership
    const contract = await storage.getContract(contractId);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: "Contract not found"
      });
    }
    
    // Verify ownership - only admin or the contract owner can access documents
    if (role !== 'admin' && contract.merchantId !== merchantId) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access this contract's documents"
      });
    }
    
    // Get all application progress records that have document metadata
    const progressRecords = await storage.getApplicationProgressByContractId(contractId);
    
    // Filter and format the records to include only those with document metadata
    const documentRecords = progressRecords
      .filter((record) => {
        // Ensure the record has metadata that includes document information
        return record.metadata && 
              typeof record.metadata === 'object' && 
              record.metadata.hasOwnProperty('documentType');
      })
      .map((record) => {
        return {
          id: record.id,
          contractId,
          documentType: record.metadata?.documentType || 'unknown',
          documentName: record.metadata?.documentName || `Document-${record.id}`,
          createdAt: record.startedAt || new Date(),
          status: record.completed ? 'completed' : 'pending',
          step: record.step,
          metadata: record.metadata
        };
      });
    
    return res.status(200).json({
      success: true,
      data: documentRecords
    });
  } catch (error) {
    logger.error({
      message: `Error fetching contract documents: ${error}`,
      category: 'api',
      source: 'internal',
      metadata: { error, contractId: req.params.id }
    });
    
    return res.status(500).json({
      success: false,
      error: "Failed to fetch contract documents"
    });
  }
});

/**
 * Get document by ID (specific application progress with document metadata)
 */
documentsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    const { role, merchantId } = req.user || {};
    
    // Check permissions - only admin or merchant can access
    if (!role || (role !== 'admin' && !merchantId)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access document details"
      });
    }
    
    // Get the application progress record
    const progressRecord = await storage.getApplicationProgressById(documentId);
    
    if (!progressRecord) {
      return res.status(404).json({
        success: false,
        error: "Document not found"
      });
    }
    
    // Get the contract associated with the application progress
    // The merchantId in the progress record should be the contract ID
    const contractId = progressRecord.metadata?.contractId;
    if (!contractId) {
      return res.status(404).json({
        success: false,
        error: "Contract ID not found in application progress metadata"
      });
    }
    
    const contract = await storage.getContract(parseInt(contractId.toString(), 10));
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: "Associated contract not found"
      });
    }
    
    // Verify ownership - only admin or the contract owner can access documents
    if (role !== 'admin' && contract.merchantId !== merchantId) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access this document"
      });
    }
    
    // Format the document record
    const documentRecord = {
      id: progressRecord.id,
      contractId: contract.id,
      documentType: progressRecord.metadata?.documentType || 'unknown',
      documentName: progressRecord.metadata?.documentName || `Document-${progressRecord.id}`,
      createdAt: progressRecord.startedAt || new Date(),
      status: progressRecord.completed ? 'completed' : 'pending',
      step: progressRecord.step,
      content: progressRecord.metadata?.content || null,
      metadata: progressRecord.metadata
    };
    
    return res.status(200).json({
      success: true,
      data: documentRecord
    });
  } catch (error) {
    logger.error({
      message: `Error fetching document details: ${error}`,
      category: 'api',
      source: 'internal',
      metadata: { error, documentId: req.params.id }
    });
    
    return res.status(500).json({
      success: false,
      error: "Failed to fetch document details"
    });
  }
});

export default documentsRouter;