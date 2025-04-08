import { Router, Request, Response } from "express";
import { storage } from "../../storage";
import { logger } from "../../services/logger";
import { z } from "zod";
import { insertMerchantProgramSchema, insertMerchantProgramAgreementSchema } from "@shared/schema";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// Configure multer for file uploads
const uploadsDir = path.resolve("./uploads/program-agreements");
// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage_multer = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage: storage_multer });

// Get all programs for the current merchant
router.get("/", async (req: Request, res: Response) => {
  try {
    // Check if user and merchant ID exist
    if (!req.user || !req.merchantId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Get all programs for the merchant
    const programs = await storage.getMerchantProgramsByMerchantId(req.merchantId);

    return res.status(200).json({
      success: true,
      data: programs,
    });
  } catch (error) {
    logger.error({
      message: `Error fetching merchant programs: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Error fetching merchant programs",
    });
  }
});

// Get a single program by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid program ID",
      });
    }

    // Get the program
    const program = await storage.getMerchantProgram(programId);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    // Check if program belongs to the merchant
    if (program.merchantId !== req.merchantId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    return res.status(200).json({
      success: true,
      data: program,
    });
  } catch (error) {
    logger.error({
      message: `Error fetching merchant program: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Error fetching merchant program",
    });
  }
});

// Create a new program
router.post("/", async (req: Request, res: Response) => {
  try {
    // Check if user and merchant ID exist
    if (!req.user || !req.merchantId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Validate request body
    const programSchema = insertMerchantProgramSchema.extend({
      merchantId: z.number(),
      name: z.string().min(1, "Program name is required"),
      durationMonths: z.number().min(1, "Duration must be at least 1 month"),
    });

    const validationResult = programSchema.safeParse({
      ...req.body,
      merchantId: req.merchantId,
    });

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid program data",
        errors: validationResult.error.format(),
      });
    }

    // Create the program
    const newProgram = await storage.createMerchantProgram(validationResult.data);

    return res.status(201).json({
      success: true,
      data: newProgram,
    });
  } catch (error) {
    logger.error({
      message: `Error creating merchant program: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Error creating merchant program",
    });
  }
});

// Request a program update (requires admin approval)
router.put("/:id/request-update", async (req: Request, res: Response) => {
  try {
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid program ID",
      });
    }

    // Get the program to check ownership
    const program = await storage.getMerchantProgram(programId);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    // Check if program belongs to the merchant
    if (program.merchantId !== req.merchantId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Validate request body
    const updateRequestSchema = z.object({
      name: z.string().min(1, "Program name is required").optional(),
      description: z.string().optional().nullable(),
      durationMonths: z.number().min(1, "Duration must be at least 1 month").optional(),
      reason: z.string().min(1, "Reason for update is required"),
    });

    const validationResult = updateRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid program update request data",
        errors: validationResult.error.format(),
      });
    }

    // Create a temporary change record in the database
    // Note: We're using the agreement system temporarily until we implement the full change request system
    const changeRecord = await storage.createMerchantProgramAgreement({
      programId,
      filename: `change-request-${programId}-${Date.now()}.json`,
      originalFilename: `program-update-request-${programId}.json`,
      mimeType: "application/json",
      data: JSON.stringify({
        programId,
        merchantId: req.merchantId,
        requestType: "update",
        requestedData: validationResult.data,
        reason: validationResult.data.reason || "Merchant requested update",
        status: "pending",
        requestedBy: req.user?.id || 0,
      }),
      active: false,
    });

    // Create a notification for admins
    await storage.createNotification({
      recipientId: 1, // Admin user ID
      recipientType: "admin",
      type: "program_change_request",
      metadata: JSON.stringify({
        changeRecordId: changeRecord.id,
        merchantId: req.merchantId,
        programId,
        programName: program.name,
        requestedChanges: validationResult.data,
      }),
    });

    logger.info({
      message: `Merchant requested program update: Program ID ${programId}`,
      userId: req.user?.id,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: req.merchantId,
        programId,
        changeRecordId: changeRecord.id,
        requestedChanges: JSON.stringify(validationResult.data),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Program update request submitted for admin approval",
      requestId: changeRecord.id,
    });
  } catch (error) {
    logger.error({
      message: `Error requesting merchant program update: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Error submitting program update request",
    });
  }
});

// Only allow toggling a program's active status (not modifying core program details)
router.patch("/:id/toggle-status", async (req: Request, res: Response) => {
  try {
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid program ID",
      });
    }

    // Get the program to check ownership
    const program = await storage.getMerchantProgram(programId);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    // Check if program belongs to the merchant
    if (program.merchantId !== req.merchantId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Validate request body - only allow active status toggle
    const statusSchema = z.object({
      active: z.boolean(),
    });

    const validationResult = statusSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request - only 'active' field can be updated",
        errors: validationResult.error.format(),
      });
    }

    // Only update the active status - other fields remain unchanged
    const updatedProgram = await storage.updateMerchantProgram(programId, { 
      active: validationResult.data.active
    });

    return res.status(200).json({
      success: true,
      data: updatedProgram,
      message: `Program ${validationResult.data.active ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    logger.error({
      message: `Error toggling program status: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Error updating program status",
    });
  }
});

// Request program archive (instead of deletion)
router.post("/:id/request-archive", async (req: Request, res: Response) => {
  try {
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid program ID",
      });
    }

    // Get the program to check ownership
    const program = await storage.getMerchantProgram(programId);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    // Check if program belongs to the merchant
    if (program.merchantId !== req.merchantId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Validate request body
    const archiveRequestSchema = z.object({
      reason: z.string().min(1, "Reason for archiving is required"),
    });

    const validationResult = archiveRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.format(),
      });
    }

    // Create a temporary archive record in the database
    // Note: We're using the agreement system temporarily until we implement the full change request system
    const archiveRecord = await storage.createMerchantProgramAgreement({
      programId,
      filename: `archive-request-${programId}-${Date.now()}.json`,
      originalFilename: `program-archive-request-${programId}.json`,
      mimeType: "application/json",
      data: JSON.stringify({
        programId,
        merchantId: req.merchantId,
        requestType: "archive",
        reason: validationResult.data.reason,
        status: "pending",
        requestedBy: req.user?.id || 0,
      }),
      active: false,
    });

    // Create a notification for admins
    await storage.createNotification({
      recipientId: 1, // Admin user ID
      recipientType: "admin",
      type: "program_archive_request",
      metadata: JSON.stringify({
        archiveRecordId: archiveRecord.id,
        merchantId: req.merchantId,
        programId,
        programName: program.name,
        reason: validationResult.data.reason,
      }),
    });

    logger.info({
      message: `Merchant requested program archive: Program ID ${programId}`,
      userId: req.user?.id,
      category: "api",
      source: "internal",
      metadata: {
        merchantId: req.merchantId,
        programId,
        archiveRecordId: archiveRecord.id,
        reason: validationResult.data.reason,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Program archive request submitted for admin approval",
      requestId: archiveRecord.id,
    });
  } catch (error) {
    logger.error({
      message: `Error requesting merchant program archive: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Error submitting program archive request",
    });
  }
});

// Get all agreements for a program
router.get("/:id/agreements", async (req: Request, res: Response) => {
  try {
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid program ID",
      });
    }

    // Get the program to check ownership
    const program = await storage.getMerchantProgram(programId);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    // Check if program belongs to the merchant
    if (program.merchantId !== req.merchantId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Get agreements for the program
    const agreements = await storage.getMerchantProgramAgreementsByProgramId(programId);

    return res.status(200).json({
      success: true,
      data: agreements,
    });
  } catch (error) {
    logger.error({
      message: `Error fetching program agreements: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Error fetching program agreements",
    });
  }
});

// Upload a new agreement for a program and send to Thanks Roger as a template
router.post("/:id/agreements", upload.single("file"), async (req: Request, res: Response) => {
  try {
    // Log the request details for debugging
    logger.info('Agreement upload request received', {
      category: 'merchant',
      source: 'internal',
      metadata: {
        programId: req.params.id,
        merchantId: req.merchantId,
        hasFile: !!req.file,
        bodyKeys: Object.keys(req.body),
        headers: req.headers,
        files: req.files ? Object.keys(req.files) : 'No files',
        formDataFields: JSON.stringify(req.body)
      }
    });
    
    // Log multer file details
    if (req.file) {
      logger.info('File upload details', {
        category: 'merchant',
        source: 'internal',
        metadata: {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          fieldname: req.file.fieldname,
          filename: req.file.filename
        }
      });
    } else {
      logger.error('No file found in upload request', {
        category: 'merchant',
        source: 'internal',
        metadata: {
          formFields: Object.keys(req.body),
          contentType: req.headers['content-type'],
        }
      });
    }
    
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) {
      logger.error('Invalid program ID format', {
        category: 'merchant',
        source: 'internal',
        metadata: { rawId: req.params.id }
      });
      return res.status(400).json({
        success: false,
        message: "Invalid program ID",
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      logger.error('File missing from upload request', {
        category: 'merchant',
        source: 'internal',
        metadata: { 
          fieldnames: req.body.fieldname || 'unknown',
          contentType: req.headers['content-type']
        }
      });
      return res.status(400).json({
        success: false,
        message: "No file uploaded - please ensure you're selecting a file",
      });
    }

    // Get the program to check ownership
    const program = await storage.getMerchantProgram(programId);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    // Check if program belongs to the merchant
    if (program.merchantId !== req.merchantId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Get merchant details to include in the agreement template
    const merchant = await storage.getMerchant(req.merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    // Prepare agreement data
    const fileData = fs.readFileSync(req.file.path, { encoding: "base64" });
    const agreementData = {
      programId,
      filename: req.file.filename,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      data: fileData,
      fileSize: req.file.size,
    };

    // Create the agreement in our system
    const newAgreement = await storage.createMerchantProgramAgreement(agreementData);

    // Now send to Thanks Roger API to create as a template
    try {
      const thanksRogerApiKey = process.env.THANKS_ROGER_API_KEY;
      
      if (!thanksRogerApiKey) {
        logger.warn({
          message: "Thanks Roger API key is not configured, skipping template creation",
          userId: req.user?.id,
          category: "api",
          source: "internal",
        });
      } else {
        // Prepare the document template data for Thanks Roger
        const templateData = {
          name: `${merchant.name} - ${program.name} Agreement`,
          description: `Sales agreement for ${merchant.name}'s ${program.name} financing program`,
          document: fileData,
          documentName: req.file.originalname,
          documentType: req.file.mimetype,
          tags: ["program_agreement", `merchant_${req.merchantId}`, `program_${programId}`],
          metadata: {
            merchantId: req.merchantId,
            merchantName: merchant.name,
            programId: programId,
            programName: program.name,
            programDuration: program.durationMonths,
          }
        };

        // Send to Thanks Roger API
        const response = await fetch("https://api.thanksroger.com/v1/templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${thanksRogerApiKey}`
          },
          body: JSON.stringify(templateData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Thanks Roger API error: ${JSON.stringify(errorData)}`);
        }

        const templateResponse = await response.json();
        
        // Update our agreement record with the Thanks Roger template info in metadata
        await storage.updateMerchantProgramAgreement(newAgreement.id, {
          data: JSON.stringify({
            fileData: fileData,
            externalTemplateId: templateResponse.id,
            externalTemplateName: templateResponse.name
          })
        });

        logger.info({
          message: `Program agreement uploaded and sent to Thanks Roger: ${newAgreement.id}`,
          userId: req.user?.id,
          category: "api",
          source: "internal",
          metadata: {
            merchantId: req.merchantId,
            programId,
            agreementId: newAgreement.id,
            templateId: templateResponse.id
          }
        });

        return res.status(201).json({
          success: true,
          data: {
            ...newAgreement,
            externalTemplateId: templateResponse.id,
            externalTemplateName: templateResponse.name
          },
          message: "Agreement uploaded and registered as a template successfully"
        });
      }
    } catch (templateError) {
      // Log the error but don't fail the whole request
      logger.error({
        message: `Error creating Thanks Roger template: ${templateError instanceof Error ? templateError.message : String(templateError)}`,
        userId: req.user?.id,
        category: "api",
        source: "internal",
        metadata: {
          merchantId: req.merchantId,
          programId,
          agreementId: newAgreement.id,
          error: templateError instanceof Error ? templateError.stack : String(templateError)
        }
      });
      
      // Continue without template ID
      return res.status(201).json({
        success: true,
        data: newAgreement,
        warning: "Agreement was saved but could not be registered as a template in Thanks Roger"
      });
    }

    // If we skipped Thanks Roger integration
    return res.status(201).json({
      success: true,
      data: newAgreement
    });
  } catch (error) {
    logger.error({
      message: `Error uploading program agreement: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Error uploading program agreement",
    });
  }
});

// Delete an agreement
router.delete("/agreements/:id", async (req: Request, res: Response) => {
  try {
    const agreementId = parseInt(req.params.id);
    if (isNaN(agreementId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid agreement ID",
      });
    }

    // Get the agreement to check ownership
    const agreement = await storage.getMerchantProgramAgreement(agreementId);
    if (!agreement) {
      return res.status(404).json({
        success: false,
        message: "Agreement not found",
      });
    }

    // Get the program to check ownership
    const program = await storage.getMerchantProgram(agreement.programId);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    // Check if program belongs to the merchant
    if (program.merchantId !== req.merchantId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Delete the agreement
    await storage.deleteMerchantProgramAgreement(agreementId);

    return res.status(200).json({
      success: true,
      message: "Agreement deleted successfully",
    });
  } catch (error) {
    logger.error({
      message: `Error deleting program agreement: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Error deleting program agreement",
    });
  }
});

export default router;