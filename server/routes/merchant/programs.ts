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

// Update a program
router.put("/:id", async (req: Request, res: Response) => {
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
    const updateSchema = z.object({
      name: z.string().min(1, "Program name is required").optional(),
      description: z.string().optional().nullable(),
      durationMonths: z.number().min(1, "Duration must be at least 1 month").optional(),
      active: z.boolean().optional(),
    });

    const validationResult = updateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid program data",
        errors: validationResult.error.format(),
      });
    }

    // Update the program
    const updatedProgram = await storage.updateMerchantProgram(programId, validationResult.data);

    return res.status(200).json({
      success: true,
      data: updatedProgram,
    });
  } catch (error) {
    logger.error({
      message: `Error updating merchant program: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Error updating merchant program",
    });
  }
});

// Delete a program
router.delete("/:id", async (req: Request, res: Response) => {
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

    // Delete the program
    await storage.deleteMerchantProgram(programId);

    return res.status(200).json({
      success: true,
      message: "Program deleted successfully",
    });
  } catch (error) {
    logger.error({
      message: `Error deleting merchant program: ${error instanceof Error ? error.message : String(error)}`,
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
      message: "Error deleting merchant program",
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

// Upload a new agreement for a program
router.post("/:id/agreements", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid program ID",
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
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

    // Create the agreement
    const newAgreement = await storage.createMerchantProgramAgreement(agreementData);

    return res.status(201).json({
      success: true,
      data: newAgreement,
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