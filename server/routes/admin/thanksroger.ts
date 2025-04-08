import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth';
import { db } from '../../db';
import * as schema from '../../../shared/schema';
import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { logger } from '../../services/logger';
import fetch from 'node-fetch';

const router = Router();

// Ensure all routes are protected with admin authentication
router.use(authenticateAdmin);

/**
 * Test the Thanks Roger API integration
 * This endpoint retrieves a program agreement and tests the template creation/retrieval
 */
router.get('/test-thanksroger', async (req, res) => {
  try {
    logger.info({
      message: 'Testing Thanks Roger API integration',
      userId: req.user?.id,
      category: 'api',
      source: 'internal'
    });
    
    // 1. Retrieve a program agreement from the database
    const agreements = await db.select().from(schema.merchantProgramAgreements).limit(1);
    
    if (agreements.length === 0) {
      return res.json({
        success: false,
        message: 'No program agreements found in the database. Please create one first.'
      });
    }
    
    const agreement = agreements[0];
    
    // Get program details
    const programs = await db.select().from(schema.merchantPrograms)
      .where(eq(schema.merchantPrograms.id, agreement.programId))
      .limit(1);
    
    if (programs.length === 0) {
      return res.json({
        success: false,
        message: `Program with ID ${agreement.programId} not found.`
      });
    }
    
    const program = programs[0];
    
    // Get merchant details
    const merchants = await db.select().from(schema.merchants)
      .where(eq(schema.merchants.id, program.merchantId))
      .limit(1);
    
    if (merchants.length === 0) {
      return res.json({
        success: false,
        message: `Merchant with ID ${program.merchantId} not found.`
      });
    }
    
    const merchant = merchants[0];
    
    // Prepare a formatted response with merchant and program details
    const agreementDetails = {
      id: agreement.id,
      programId: agreement.programId,
      programName: program.name || 'Unknown Program',
      merchantId: program.merchantId,
      merchantName: merchant.name || 'Unknown Merchant',
      originalFilename: agreement.originalFilename,
      mimeType: agreement.mimeType,
      fileSize: agreement.fileSize,
      hasExternalTemplateId: !!agreement.externalTemplateId,
      externalTemplateId: agreement.externalTemplateId || null,
      externalTemplateName: agreement.externalTemplateName || null,
      createdAt: agreement.createdAt
    };

    // Define template details interface for better type checking
    interface TemplateDetails {
      id: string;
      name: string;
      [key: string]: any;
    }
    
    let templateDetails: TemplateDetails | null = null;
    
    // Check for Thanks Roger API key
    const thanksRogerApiKey = process.env.THANKS_ROGER_API_KEY;
    
    if (!thanksRogerApiKey) {
      return res.json({
        success: false,
        message: 'Thanks Roger API key not found in environment variables',
        agreement: agreementDetails
      });
    }
    
    // 2. If there's a template ID, fetch the template details from Thanks Roger
    if (agreement.externalTemplateId) {
      logger.info({
        message: `Fetching template details for ID: ${agreement.externalTemplateId}`,
        userId: req.user?.id,
        category: 'api',
        source: 'internal',
        metadata: {
          templateId: agreement.externalTemplateId,
          apiKeyPresent: !!thanksRogerApiKey
        }
      });
      
      try {
        const response = await fetch(
          `https://api.thanksroger.com/v1/templates/${agreement.externalTemplateId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${thanksRogerApiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        
        templateDetails = await response.json() as TemplateDetails;
        
        return res.json({
          success: true,
          message: 'Successfully retrieved template details from Thanks Roger',
          agreement: agreementDetails,
          templateDetails
        });
      } catch (err) {
        logger.error({
          message: `Error fetching Thanks Roger template details: ${err instanceof Error ? err.message : String(err)}`,
          userId: req.user?.id,
          category: 'api',
          source: 'internal',
          metadata: {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            templateId: agreement.externalTemplateId
          }
        });
        
        return res.status(500).json({
          success: false,
          message: `Error fetching template details: ${err instanceof Error ? err.message : String(err)}`,
          agreement: agreementDetails
        });
      }
    } 
    // 3. If there's no template ID, create a new template in Thanks Roger
    else {
      logger.info({
        message: 'No template ID found, attempting to create a new template',
        userId: req.user?.id,
        category: 'api',
        source: 'internal',
        metadata: {
          agreementId: agreement.id,
          programId: program.id,
          merchantId: merchant.id
        }
      });
      
      // Check if file exists
      const filePath = path.join(process.cwd(), 'uploads', agreement.filename);
      
      if (!fs.existsSync(filePath)) {
        return res.json({
          success: false,
          message: `File not found at ${filePath}`,
          agreement: agreementDetails
        });
      }
      
      try {
        // Read the file as a buffer
        const fileBuffer = fs.readFileSync(filePath);
        const fileBase64 = fileBuffer.toString('base64');
        
        // Create a new template in Thanks Roger
        logger.info({
          message: 'Attempting to reach Thanks Roger API',
          userId: req.user?.id,
          category: 'api',
          source: 'internal',
          metadata: {
            url: 'https://api.thanksroger.com/v1/templates',
            apiKeyPresent: !!thanksRogerApiKey,
            documentSize: fileBase64.length
          }
        });
        
        const response = await fetch(
          'https://api.thanksroger.com/v1/templates',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${thanksRogerApiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              name: `${program.name || 'Program'} Agreement - ${new Date().toISOString().split('T')[0]}`,
              document: fileBase64
            })
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        
        templateDetails = await response.json() as TemplateDetails;
        
        // Update the agreement with the new template ID and name
        if (templateDetails?.id) {
          await db
            .update(schema.merchantProgramAgreements)
            .set({
              externalTemplateId: templateDetails.id,
              externalTemplateName: templateDetails.name || `Template ${templateDetails.id}`
            })
            .where(eq(schema.merchantProgramAgreements.id, agreement.id));
            
          // Update the local object for the response
          agreementDetails.externalTemplateId = templateDetails.id;
          agreementDetails.externalTemplateName = templateDetails.name || `Template ${templateDetails.id}`;
          agreementDetails.hasExternalTemplateId = true;
        }
        
        return res.json({
          success: true,
          message: 'Successfully created a new template in Thanks Roger',
          agreement: agreementDetails,
          templateDetails
        });
      } catch (err) {
        logger.error({
          message: `Error creating Thanks Roger template: ${err instanceof Error ? err.message : String(err)}`,
          userId: req.user?.id,
          category: 'api',
          source: 'internal',
          metadata: {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            agreementId: agreement.id,
            programId: program.id
          }
        });
        
        return res.status(500).json({
          success: false,
          message: `Error creating template: ${err instanceof Error ? err.message : String(err)}`,
          agreement: agreementDetails
        });
      }
    }
  } catch (err) {
    logger.error({
      message: `Error in Thanks Roger test endpoint: ${err instanceof Error ? err.message : String(err)}`,
      userId: req.user?.id,
      category: 'api',
      source: 'internal',
      metadata: {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      }
    });
    
    return res.status(500).json({
      success: false,
      message: `Internal server error: ${err instanceof Error ? err.message : String(err)}`
    });
  }
});

export default router;