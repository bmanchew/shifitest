import { eq } from "drizzle-orm";
import {
  investorProfiles,
  investorVerificationDocuments,
  investorVerificationProgress,
  thirdPartyVerificationRequests,
  users,
} from "../../../shared/schema";
import { IStorage } from "../../storage";
import { Router } from "express";
import { logger } from "../../services/logger";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create a unique file name to avoid collisions
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: function (req, file, cb) {
    // Accept only certain file types
    const fileTypes = /jpeg|jpg|png|pdf/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Error: Only .jpeg, .jpg, .png, and .pdf files are allowed!"));
    }
  },
});

export function setupAccreditationRoutes(router: Router, storage: IStorage) {
  // Endpoint to verify investor accreditation
  router.post("/investor/accreditation/verify", async (req, res) => {
    try {
      const { method, investorId, ...formData } = req.body;
      const userId = req.session.userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get the investor profile
      let investor;
      if (investorId) {
        investor = await storage.db
          .select()
          .from(investorProfiles)
          .where(eq(investorProfiles.id, investorId))
          .limit(1);
      } else {
        investor = await storage.db
          .select()
          .from(investorProfiles)
          .where(eq(investorProfiles.userId, userId))
          .limit(1);
      }

      if (!investor || investor.length === 0) {
        return res.status(404).json({ error: "Investor profile not found" });
      }

      const profile = investor[0];

      // Update the investor profile based on the verification method
      const now = new Date();
      // Default expiration is 1 year from now
      const expirationDate = new Date(now);
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);

      const updateData: any = {
        accreditationMethod: method,
        verificationStatus: "pending",
        updatedAt: now,
        verificationExpiresAt: expirationDate,
      };

      switch (method) {
        case "income":
          updateData.annualIncome = formData.income;
          updateData.jointIncome = formData.jointIncome;
          updateData.currentYearIncomeExpectation = formData.currentYearEstimate;
          updateData.incomeVerificationMethod = formData.method;
          break;

        case "net_worth":
          updateData.netWorth = formData.calculatedNetWorth || formData.totalAssets - formData.totalLiabilities;
          updateData.netWorthVerificationMethod = formData.method;
          updateData.primaryResidenceValue = formData.primaryResidenceValue;
          break;

        case "professional":
          updateData.professionalLicenseType = formData.certType;
          updateData.professionalLicenseNumber = formData.licenseNumber;
          break;

        case "identity":
          updateData.dateOfBirth = formData.dateOfBirth;
          updateData.maritalStatus = formData.maritalStatus;
          updateData.citizenshipStatus = formData.citizenshipStatus;
          break;
      }

      // Update the investor profile
      await storage.db
        .update(investorProfiles)
        .set(updateData)
        .where(eq(investorProfiles.id, profile.id));

      // Create or update verification progress
      const existingProgress = await storage.db
        .select()
        .from(investorVerificationProgress)
        .where(eq(investorVerificationProgress.investorId, profile.id))
        .where(eq(investorVerificationProgress.step, method));

      if (existingProgress && existingProgress.length > 0) {
        // Update existing progress
        await storage.db
          .update(investorVerificationProgress)
          .set({
            completed: true,
            completedAt: now,
            data: JSON.stringify(formData),
            adminReviewRequired: true,
          })
          .where(eq(investorVerificationProgress.id, existingProgress[0].id));
      } else {
        // Create new progress
        await storage.db.insert(investorVerificationProgress).values({
          investorId: profile.id,
          step: method,
          completed: true,
          completedAt: now,
          data: JSON.stringify(formData),
          adminReviewRequired: true,
        });
      }

      // If a CPA/attorney email was provided, create a third-party verification request
      if (
        (method === "income" && formData.method === "cpa_letter" && formData.cpaProfessionalEmail) ||
        (method === "net_worth" && formData.method === "cpa_letter" && formData.cpaProfessionalEmail)
      ) {
        const requestToken = uuidv4();
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + 30); // 30 days to complete

        await storage.db.insert(thirdPartyVerificationRequests).values({
          investorId: profile.id,
          verifierEmail: formData.cpaProfessionalEmail,
          verifierName: formData.cpaProfessionalName,
          verifierType: "cpa",
          verificationPurpose: method,
          requestToken,
          expiresAt: expiration,
        });

        // TODO: Send email to the verifier (not implemented in this example)
      }

      // Log the verification submission
      logger.info({
        message: `Investor accreditation verification submitted: ${method}`,
        category: "system",
        source: "internal",
        userId,
        investorId: profile.id,
        method,
      });

      return res.status(200).json({
        success: true,
        message: "Verification submitted successfully",
        method,
      });
    } catch (error) {
      logger.error({
        message: `Error submitting investor verification: ${error instanceof Error ? error.message : String(error)}`,
        category: "system",
        source: "internal",
        error,
      });

      return res.status(500).json({ error: "Failed to submit verification" });
    }
  });

  // Endpoint to upload verification documents
  router.post("/investor/documents/upload", upload.array("files", 5), async (req, res) => {
    try {
      const { method, investorId, documentType } = req.body;
      const userId = req.session.userId;
      const files = req.files as Express.Multer.File[];

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Get the investor profile
      let investor;
      if (investorId) {
        investor = await storage.db
          .select()
          .from(investorProfiles)
          .where(eq(investorProfiles.id, Number(investorId)))
          .limit(1);
      } else {
        investor = await storage.db
          .select()
          .from(investorProfiles)
          .where(eq(investorProfiles.userId, userId))
          .limit(1);
      }

      if (!investor || investor.length === 0) {
        return res.status(404).json({ error: "Investor profile not found" });
      }

      const profile = investor[0];

      // Get user info for the filename
      const userInfo = await storage.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userInfo || userInfo.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = userInfo[0];
      const now = new Date();
      const dateStr = format(now, "yyyyMMdd");
      
      // Process each uploaded file
      const uploadedDocuments = [];

      for (const file of files) {
        // Generate a public URL for the file (in a real environment, use a proper file storage service)
        const publicUrl = `/uploads/${file.filename}`;
        const purpose = method || "identity"; // Default to identity if method is not provided

        // Insert document record
        const insertData = {
          investorId: profile.id,
          documentType: documentType || purpose, // Use specified document type or fall back to the purpose
          fileUrl: publicUrl,
          fileName: file.originalname,
          fileType: path.extname(file.originalname).substring(1), // Remove the leading dot
          fileSize: file.size,
          verificationPurpose: purpose,
          uploadedAt: now,
          year: new Date().getFullYear(),
        };

        const result = await storage.db
          .insert(investorVerificationDocuments)
          .values(insertData)
          .returning();

        const docId = result[0]?.id;
        uploadedDocuments.push({
          ...insertData,
          id: docId,
        });
      }

      // Update the investor profile to indicate document upload
      await storage.db
        .update(investorProfiles)
        .set({
          documentVerificationCompleted: true,
          updatedAt: now,
        })
        .where(eq(investorProfiles.id, profile.id));

      // Log the document upload
      logger.info({
        message: `Investor verification documents uploaded: ${files.length} files`,
        category: "system",
        source: "internal",
        userId,
        investorId: profile.id,
        documentType: documentType || method,
        fileCount: files.length,
      });

      return res.status(200).json({
        success: true,
        message: `${files.length} documents uploaded successfully`,
        documents: uploadedDocuments,
      });
    } catch (error) {
      logger.error({
        message: `Error uploading investor documents: ${error instanceof Error ? error.message : String(error)}`,
        category: "system",
        source: "internal",
        error,
      });

      return res.status(500).json({ error: "Failed to upload documents" });
    }
  });

  // Endpoint to get verification status
  router.get("/investor/accreditation/status", async (req, res) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get the investor profile
      const investor = await storage.db
        .select()
        .from(investorProfiles)
        .where(eq(investorProfiles.userId, userId))
        .limit(1);

      if (!investor || investor.length === 0) {
        return res.status(404).json({ error: "Investor profile not found" });
      }

      const profile = investor[0];

      // Get verification progress
      const progress = await storage.db
        .select()
        .from(investorVerificationProgress)
        .where(eq(investorVerificationProgress.investorId, profile.id));

      // Get documents
      const documents = await storage.db
        .select()
        .from(investorVerificationDocuments)
        .where(eq(investorVerificationDocuments.investorId, profile.id));

      // Determine overall status
      let overallStatus = profile.verificationStatus;
      let expiresAt = profile.verificationExpiresAt;

      // Return the status
      return res.status(200).json({
        success: true,
        status: overallStatus,
        accreditationMethod: profile.accreditationMethod,
        accreditationStatus: profile.accreditationStatus,
        documentVerificationCompleted: profile.documentVerificationCompleted,
        progress: progress.map(p => ({
          step: p.step,
          completed: p.completed,
          startedAt: p.startedAt,
          completedAt: p.completedAt,
          adminReviewed: p.adminReviewed,
          adminReviewedAt: p.adminReviewedAt,
        })),
        documents: documents.map(d => ({
          id: d.id,
          documentType: d.documentType,
          fileName: d.fileName,
          fileUrl: d.fileUrl,
          verificationPurpose: d.verificationPurpose,
          uploadedAt: d.uploadedAt,
          verified: d.verified,
          verifiedAt: d.verifiedAt,
        })),
        expiresAt,
      });
    } catch (error) {
      logger.error({
        message: `Error getting investor verification status: ${error instanceof Error ? error.message : String(error)}`,
        category: "system",
        source: "internal",
        error,
      });

      return res.status(500).json({ error: "Failed to get verification status" });
    }
  });

  // Admin endpoint to review verification
  router.post("/admin/investor/accreditation/review", async (req, res) => {
    try {
      const { investorId, approved, rejectionReason, notes } = req.body;
      const adminId = req.session.userId;

      if (!adminId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if the user is an admin
      const admin = await storage.db
        .select()
        .from(users)
        .where(eq(users.id, adminId))
        .limit(1);

      if (!admin || admin.length === 0 || admin[0].role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Get the investor profile
      const investor = await storage.db
        .select()
        .from(investorProfiles)
        .where(eq(investorProfiles.id, investorId))
        .limit(1);

      if (!investor || investor.length === 0) {
        return res.status(404).json({ error: "Investor profile not found" });
      }

      const profile = investor[0];
      const now = new Date();

      // Update the investor profile
      const updateData: any = {
        verificationStatus: approved ? "verified" : "rejected",
        accreditationStatus: approved,
        updatedAt: now,
        reviewedBy: adminId,
        reviewedAt: now,
      };

      if (!approved && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }

      if (notes) {
        updateData.adminNotes = notes;
      }

      await storage.db
        .update(investorProfiles)
        .set(updateData)
        .where(eq(investorProfiles.id, profile.id));

      // Update all progress steps to mark as reviewed
      await storage.db
        .update(investorVerificationProgress)
        .set({
          adminReviewed: true,
          adminReviewedAt: now,
          adminReviewedBy: adminId,
          adminNotes: notes || null,
        })
        .where(eq(investorVerificationProgress.investorId, profile.id));

      // Log the admin review
      logger.info({
        message: `Admin reviewed investor accreditation: ${approved ? "approved" : "rejected"}`,
        category: "system",
        source: "internal",
        adminId,
        investorId,
        approved,
        rejectionReason,
      });

      return res.status(200).json({
        success: true,
        message: `Investor accreditation ${approved ? "approved" : "rejected"}`,
        status: approved ? "verified" : "rejected",
      });
    } catch (error) {
      logger.error({
        message: `Error in admin review of investor verification: ${error instanceof Error ? error.message : String(error)}`,
        category: "system",
        source: "internal",
        error,
      });

      return res.status(500).json({ error: "Failed to process verification review" });
    }
  });

  return router;
}