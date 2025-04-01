import { Router } from 'express';
import { IStorage } from '../../storage';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { generateId } from '../../utils/dateHelpers';

// Setup uploads directory
const uploadsDir = path.join(process.cwd(), 'uploads', 'investor-documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${fileExt}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept images, PDFs, and common document formats
    const allowedTypes = [
      'image/jpeg', 
      'image/png', 
      'image/gif', 
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.') as any, false);
    }
  }
});

export function setupAccreditationRoutes(router: Router, storage: IStorage) {
  
  // Endpoint to verify investor accreditation status
  router.post('/accreditation/verify', async (req, res) => {
    try {
      const { method, investorId, ...verificationData } = req.body;
      
      // Get user ID from session or from the request body
      const userId = req.session?.userId || (investorId ? await getUserIdFromInvestorId(investorId, storage) : null);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. User is not authenticated.'
        });
      }
      
      // Get investor profile or create one if it doesn't exist
      let investor = await storage.getInvestorProfileByUserId(userId);
      
      if (!investor) {
        investor = await storage.createInvestorProfile({
          userId,
          verificationStatus: 'pending',
          accreditationStatus: null
        });
      }
      
      // Update verification data based on the method
      switch (method) {
        case 'income':
          await storage.updateInvestorProfile(investor.id, {
            annualIncome: Number(verificationData.income),
            jointIncome: verificationData.jointIncome ? true : false,
            currentYearEstimate: Number(verificationData.currentYearEstimate),
            incomeVerificationMethod: verificationData.method,
            verificationStatus: 'pending'
          });
          break;
          
        case 'net_worth':
          const totalAssets = Number(verificationData.totalAssets);
          const totalLiabilities = Number(verificationData.totalLiabilities);
          const calculatedNetWorth = totalAssets - totalLiabilities;
          
          await storage.updateInvestorProfile(investor.id, {
            totalAssets,
            totalLiabilities,
            calculatedNetWorth,
            primaryResidenceValue: verificationData.primaryResidenceValue ? 
              Number(verificationData.primaryResidenceValue) : null,
            primaryResidenceMortgage: verificationData.primaryResidenceMortgage ? 
              Number(verificationData.primaryResidenceMortgage) : null,
            netWorthVerificationMethod: verificationData.method,
            verificationStatus: 'pending'
          });
          break;
          
        case 'professional':
          await storage.updateInvestorProfile(investor.id, {
            professionalCertification: verificationData.certType,
            professionalLicenseNumber: verificationData.licenseNumber,
            professionalCertDescription: verificationData.otherCertDescription || null,
            professionalCertIssueDate: verificationData.issueDate ? new Date(verificationData.issueDate) : null,
            professionalCertExpirationDate: verificationData.expirationDate ? 
              new Date(verificationData.expirationDate) : null,
            verificationStatus: 'pending'
          });
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid verification method.'
          });
      }
      
      // Add verification progress record
      await storage.createInvestorVerificationProgress({
        investorId: investor.id,
        verificationStep: 'information_submitted',
        notes: `Submitted ${method} verification information`,
        completed: true
      });
      
      return res.status(200).json({
        success: true,
        message: 'Verification data submitted successfully.',
        method
      });
    } catch (error) {
      console.error("Error verifying investor:", error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during verification.'
      });
    }
  });
  
  // Endpoint to upload documents
  router.post('/documents/upload', upload.array('files', 10), async (req, res) => {
    try {
      const { documentType, method, notes } = req.body;
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files were uploaded.'
        });
      }
      
      // Get user ID from session or from the request body
      const userId = req.session?.userId || (req.body.investorId ? 
        await getUserIdFromInvestorId(Number(req.body.investorId), storage) : null);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. User is not authenticated.'
        });
      }
      
      // Get investor profile
      let investor = await storage.getInvestorProfileByUserId(userId);
      
      if (!investor) {
        return res.status(404).json({
          success: false,
          message: 'Investor profile not found.'
        });
      }
      
      // Save document metadata to database
      const documents = await Promise.all(files.map(async (file) => {
        const documentId = generateId(12);
        
        const document = await storage.createInvestorDocument({
          investorId: investor!.id,
          documentType: documentType,
          documentPath: file.path,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          verificationMethod: method,
          notes: notes || null,
          status: 'pending_review'
        });
        
        return document;
      }));
      
      // Update verification progress
      await storage.createInvestorVerificationProgress({
        investorId: investor.id,
        verificationStep: 'document_uploaded',
        notes: `Uploaded ${files.length} document(s) for ${method} verification`,
        completed: true
      });
      
      // Update investor profile verification status if needed
      if (investor.verificationStatus === 'not_started') {
        await storage.updateInvestorProfile(investor.id, {
          verificationStatus: 'pending'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Documents uploaded successfully.',
        documents: documents.map(doc => ({
          id: doc.id,
          filename: doc.originalFilename,
          type: doc.documentType,
          status: doc.status
        }))
      });
    } catch (error) {
      console.error("Error uploading investor documents:", error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during document upload.'
      });
    }
  });
  
  // Endpoint to get verification status
  router.get('/accreditation/status', async (req, res) => {
    try {
      // Get user ID from session
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. User is not authenticated.'
        });
      }
      
      // Get investor profile
      const investor = await storage.getInvestorProfileByUserId(userId);
      
      if (!investor) {
        return res.status(404).json({
          success: false,
          message: 'Investor profile not found.'
        });
      }
      
      // Get verification progress
      const progress = await storage.getInvestorVerificationProgressByInvestorId(investor.id);
      
      // Get uploaded documents
      const documents = await storage.getInvestorDocumentsByInvestorId(investor.id);
      
      return res.status(200).json({
        success: true,
        verification: {
          status: investor.verificationStatus,
          accredited: investor.accreditationStatus,
          method: getInvestorVerificationMethod(investor),
          progress: progress.map(p => ({
            step: p.verificationStep,
            notes: p.notes,
            completed: p.completed,
            timestamp: p.createdAt
          })),
          documents: documents.map(d => ({
            id: d.id,
            type: d.documentType,
            filename: d.originalFilename,
            status: d.status,
            uploadDate: d.createdAt
          }))
        }
      });
    } catch (error) {
      console.error("Error fetching verification status:", error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while fetching verification status.'
      });
    }
  });
  
  // Admin endpoint to approve/reject verification
  router.post('/admin/accreditation/review', async (req, res) => {
    try {
      const { investorId, decision, notes } = req.body;
      
      // Get admin ID from session
      const adminId = req.session?.userId;
      
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Admin authentication required.'
        });
      }
      
      // Check if user is an admin
      const isAdmin = await storage.isUserAdmin(adminId);
      
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. Admin privileges required.'
        });
      }
      
      if (!investorId || !decision) {
        return res.status(400).json({
          success: false,
          message: 'Investor ID and decision are required.'
        });
      }
      
      // Get investor profile
      const investor = await storage.getInvestorProfileById(Number(investorId));
      
      if (!investor) {
        return res.status(404).json({
          success: false,
          message: 'Investor profile not found.'
        });
      }
      
      // Update investor accreditation status
      const newStatus = decision === 'approve' ? 'verified' : 'rejected';
      const accreditationStatus = decision === 'approve';
      
      await storage.updateInvestorProfile(investor.id, {
        verificationStatus: newStatus,
        accreditationStatus,
        verificationNotes: notes || null,
        lastVerificationDate: new Date()
      });
      
      // Add verification progress record
      await storage.createInvestorVerificationProgress({
        investorId: investor.id,
        verificationStep: decision === 'approve' ? 'verification_approved' : 'verification_rejected',
        notes: notes || `Accreditation verification ${decision === 'approve' ? 'approved' : 'rejected'} by admin`,
        completed: true,
        completedBy: adminId
      });
      
      return res.status(200).json({
        success: true,
        message: `Investor accreditation ${decision === 'approve' ? 'approved' : 'rejected'} successfully.`,
        investor: {
          id: investor.id,
          status: newStatus,
          accredited: accreditationStatus
        }
      });
    } catch (error) {
      console.error("Error reviewing investor accreditation:", error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during accreditation review.'
      });
    }
  });
}

// Helper function to get user ID from investor ID
async function getUserIdFromInvestorId(investorId: number, storage: IStorage): Promise<number | null> {
  try {
    const investor = await storage.getInvestorProfileById(investorId);
    return investor ? investor.userId : null;
  } catch (error) {
    console.error("Error getting user ID from investor ID:", error);
    return null;
  }
}

// Helper function to determine the verification method used by the investor
function getInvestorVerificationMethod(investor: any): string | null {
  if (investor.annualIncome || investor.incomeVerificationMethod) {
    return 'income';
  } else if (investor.totalAssets || investor.netWorthVerificationMethod) {
    return 'net_worth';
  } else if (investor.professionalCertification) {
    return 'professional';
  } else if (investor.thirdPartyVerifier) {
    return 'third_party';
  }
  
  return null;
}