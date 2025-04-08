import { Request, Response, Router } from "express";
import { logger } from "../../services/logger";
import { storage } from "../../storage";
import { db } from "../../db";
import { merchantProgramAgreements } from "@shared/schema";
import { testConnectivity } from "./connectivity-test";

const router = Router();

// Route to check basic connectivity to Thanks Roger API - public for testing purposes
router.get("/connectivity-check-public", async (req: Request, res: Response) => {
  try {
    logger.info({
      message: "Testing Thanks Roger API connectivity",
      userId: req.user?.id,
      category: "api",
      source: "internal"
    });
    
    const thanksRogerBaseUrl = "https://api.thanksroger.com";
    const thanksRogerApiKey = process.env.THANKS_ROGER_API_KEY;
    
    // Basic connectivity check (without auth)
    const baseConnectivity = await testConnectivity(thanksRogerBaseUrl);
    
    // Test connectivity with auth if API key is available
    let authConnectivity = null;
    let authConnectivityHeadOnly = null;
    
    if (thanksRogerApiKey) {
      // Use a different approach for auth check with headers
      try {
        logger.info({
          message: "Testing authenticated connection with API key",
          userId: req.user?.id,
          category: "api",
          source: "internal"
        });
        
        const response = await fetch(`${thanksRogerBaseUrl}/v1/templates`, {
          method: 'HEAD',
          headers: {
            'Authorization': `Bearer ${thanksRogerApiKey}`,
            'Accept': 'application/json'
          }
        });
        
        authConnectivityHeadOnly = {
          success: response.ok,
          message: `Auth connection with HEAD method: ${response.status} ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries([...response.headers.entries()])
          }
        };
      } catch (error) {
        authConnectivityHeadOnly = {
          success: false,
          message: `Auth connection failed with HEAD method: ${error instanceof Error ? error.message : String(error)}`,
          details: {
            error: error instanceof Error ? error.message : String(error)
          }
        };
      }
      
      // Also do the simpler connectivity test
      authConnectivity = await testConnectivity(`${thanksRogerBaseUrl}/v1/templates`);
    }
    
    return res.json({
      success: baseConnectivity.success,
      message: baseConnectivity.message,
      baseConnectivity,
      authConnectivity,
      authConnectivityHeadOnly, 
      apiKeyPresent: !!thanksRogerApiKey
    });
  } catch (error) {
    logger.error({
      message: `Error testing connectivity: ${error instanceof Error ? error.message : String(error)}`,
      userId: req.user?.id,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.message : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: `Error testing connectivity: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// This route is only available to admin users for testing the Thanks Roger API integration
router.get("/test-thanksroger", async (req: Request, res: Response) => {
  try {
    logger.info({
      message: "Admin requested Thanks Roger API test",
      userId: req.user?.id,
      category: "api",
      source: "internal",
      metadata: {}
    });

    // Check if Thanks Roger API key is configured
    const thanksRogerApiKey = process.env.THANKS_ROGER_API_KEY;
    if (!thanksRogerApiKey) {
      return res.status(500).json({
        success: false,
        message: "THANKS_ROGER_API_KEY environment variable is not set"
      });
    }

    // Query the database directly for merchant program agreements
    const agreements = await db.select().from(merchantProgramAgreements).limit(10);
    if (agreements.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No program agreements found in the database. Please upload a document first."
      });
    }

    const agreement = agreements[0];
    
    // Get the related program and merchant
    const program = await storage.getMerchantProgram(agreement.programId);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: `Program with ID ${agreement.programId} not found.`
      });
    }

    const merchant = await storage.getMerchant(program.merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: `Merchant with ID ${program.merchantId} not found.`
      });
    }

    // Prepare the response data
    const agreementData = {
      id: agreement.id,
      programId: agreement.programId,
      programName: program.name,
      filename: agreement.filename,
      originalFilename: agreement.originalFilename,
      mimeType: agreement.mimeType,
      fileSize: agreement.fileSize,
      uploadedAt: agreement.uploadedAt,
      merchantId: program.merchantId,
      merchantName: merchant.name,
      hasExternalTemplateId: !!agreement.externalTemplateId,
      externalTemplateId: agreement.externalTemplateId,
      externalTemplateName: agreement.externalTemplateName
    };

    // If agreement already has a template ID, fetch its details
    if (agreement.externalTemplateId) {
      logger.info({
        message: "Agreement already has a Thanks Roger template",
        userId: req.user?.id,
        category: "api",
        source: "internal",
        metadata: {
          templateId: agreement.externalTemplateId,
          templateName: agreement.externalTemplateName
        }
      });

      // Try to fetch template details from Thanks Roger
      try {
        const response = await fetch(`https://api.thanksroger.com/v1/templates/${agreement.externalTemplateId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${thanksRogerApiKey}`
          }
        });

        if (response.ok) {
          const templateDetails = await response.json();
          return res.status(200).json({
            success: true,
            agreement: agreementData,
            templateDetails,
            message: "Agreement already has a template in Thanks Roger"
          });
        } else {
          const errorText = await response.text();
          return res.status(response.status).json({
            success: false,
            agreement: agreementData,
            error: errorText,
            message: "Failed to fetch template details from Thanks Roger"
          });
        }
      } catch (error) {
        logger.error({
          message: `Error fetching Thanks Roger template: ${error instanceof Error ? error.message : String(error)}`,
          userId: req.user?.id,
          category: "api",
          source: "internal",
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            templateId: agreement.externalTemplateId
          }
        });

        return res.status(500).json({
          success: false,
          agreement: agreementData,
          error: error instanceof Error ? error.message : String(error),
          message: "Error fetching template details from Thanks Roger"
        });
      }
    } else {
      // Agreement doesn't have a template ID yet
      logger.info({
        message: "Agreement does not have a Thanks Roger template ID yet",
        userId: req.user?.id,
        category: "api",
        source: "internal",
        metadata: {
          agreementId: agreement.id
        }
      });

      // Check if data exists
      if (!agreement.data) {
        return res.status(400).json({
          success: false,
          agreement: agreementData,
          message: "Agreement data is missing or empty. Cannot create template."
        });
      }

      // Prepare template data
      const templateData = {
        name: `${merchant.name} - ${program.name} Agreement`,
        description: `Sales agreement for ${merchant.name}'s ${program.name} financing program`,
        document: agreement.data,
        documentName: agreement.originalFilename,
        documentType: agreement.mimeType,
        tags: ["program_agreement", `merchant_${merchant.id}`, `program_${program.id}`],
        metadata: {
          merchantId: merchant.id,
          merchantName: merchant.name,
          programId: program.id,
          programName: program.name,
          programDuration: program.durationMonths,
        }
      };

      // Send to Thanks Roger API
      logger.info({
        message: "Sending document to Thanks Roger API for template creation",
        userId: req.user?.id,
        category: "api",
        source: "internal",
        metadata: {
          documentName: agreement.originalFilename,
          documentSize: agreement.fileSize,
          documentType: agreement.mimeType,
          merchantId: merchant.id,
          programId: program.id
        }
      });

      try {
        const response = await fetch("https://api.thanksroger.com/v1/templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${thanksRogerApiKey}`
          },
          body: JSON.stringify(templateData)
        });

        if (response.ok) {
          const templateResponse = await response.json();
          
          logger.info({
            message: "Successfully created Thanks Roger template",
            userId: req.user?.id,
            category: "api",
            source: "internal",
            metadata: {
              templateId: templateResponse.id,
              templateName: templateResponse.name
            }
          });

          // Update our agreement record with the Thanks Roger template ID and name
          const updatedAgreement = await storage.updateMerchantProgramAgreement(agreement.id, {
            externalTemplateId: templateResponse.id,
            externalTemplateName: templateResponse.name
          });

          return res.status(201).json({
            success: true,
            agreement: {
              ...agreementData,
              externalTemplateId: templateResponse.id,
              externalTemplateName: templateResponse.name
            },
            templateDetails: templateResponse,
            message: "Agreement successfully registered as a template in Thanks Roger"
          });
        } else {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { message: errorText || "Unknown error" };
          }

          logger.error({
            message: `Failed to create Thanks Roger template: ${JSON.stringify(errorData)}`,
            userId: req.user?.id,
            category: "api",
            source: "internal",
            metadata: {
              error: errorData
            }
          });

          return res.status(response.status).json({
            success: false,
            agreement: agreementData,
            error: errorData,
            message: "Failed to create template in Thanks Roger"
          });
        }
      } catch (error) {
        logger.error({
          message: `Error creating Thanks Roger template: ${error instanceof Error ? error.message : String(error)}`,
          userId: req.user?.id,
          category: "api",
          source: "internal",
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            agreementId: agreement.id
          }
        });

        return res.status(500).json({
          success: false,
          agreement: agreementData,
          error: error instanceof Error ? error.message : String(error),
          message: "Error creating template in Thanks Roger"
        });
      }
    }
  } catch (error) {
    logger.error({
      message: `Error in Thanks Roger test: ${error instanceof Error ? error.message : String(error)}`,
      userId: req.user?.id,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error during Thanks Roger test",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;