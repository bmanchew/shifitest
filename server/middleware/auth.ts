import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { logger } from '../services/logger';

/**
 * Middleware to check if the user is authenticated
 * @param req Express Request
 * @param res Express Response
 * @param next Express NextFunction
 */
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is already attached to request (by JWT middleware)
    if (!req.user) {
      logger.warn({
        message: 'Authentication required but no user found on request',
        category: 'security',
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
        }
      });
      
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    next();
  } catch (error) {
    logger.error({
      message: `Authentication error: ${error instanceof Error ? error.message : String(error)}`,
      category: 'security',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Middleware to check if the user is an admin
 * @param req Express Request
 * @param res Express Response
 * @param next Express NextFunction
 */
export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is already attached to request (by JWT middleware)
    if (!req.user) {
      logger.warn({
        message: 'Admin authorization required but no user found on request',
        category: 'security',
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
        }
      });
      
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user is an admin
    if (req.user.role !== 'admin') {
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access admin resource with role ${req.user.role}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: req.user.role
        }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    next();
  } catch (error) {
    logger.error({
      message: `Admin authorization error: ${error instanceof Error ? error.message : String(error)}`,
      category: 'security',
      userId: req.user?.id,
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'An error occurred during authorization'
    });
  }
};

/**
 * Middleware to check if the user is a merchant
 * @param req Express Request
 * @param res Express Response
 * @param next Express NextFunction
 */
export const isMerchant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is already attached to request (by JWT middleware)
    if (!req.user) {
      logger.warn({
        message: 'Merchant authorization required but no user found on request',
        category: 'security',
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
        }
      });
      
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user is a merchant
    if (req.user.role !== 'merchant') {
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access merchant resource with role ${req.user.role}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: req.user.role
        }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Merchant access required'
      });
    }
    
    // Fetch the merchant record and attach it to the request
    try {
      // Import the necessary dependencies
      const { db } = require('../db');
      const { merchants, eq } = require('../../shared/schema');
      
      // Get the merchant record for this user
      const merchantRecords = await db.select()
        .from(merchants)
        .where(eq(merchants.userId, req.user.id))
        .limit(1);
      
      if (merchantRecords.length === 0) {
        logger.warn({
          message: `User ${req.user.email} (${req.user.id}) has merchant role but no merchant record found`,
          category: 'security',
          userId: req.user.id,
          source: 'internal',
          metadata: {
            path: req.path,
            method: req.method,
            userRole: req.user.role
          }
        });
        
        return res.status(404).json({
          success: false,
          message: 'Merchant record not found'
        });
      }
      
      // Attach merchant to request
      req.merchant = merchantRecords[0];
      
      // Log the successful merchant identification
      logger.debug({
        message: `Merchant identified: ${req.merchant.id} for user ${req.user.id}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          merchantId: req.merchant.id,
          userId: req.user.id,
          path: req.path
        }
      });
      
      next();
    } catch (dbError) {
      logger.error({
        message: `Database error fetching merchant record: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
        category: 'database',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined,
          path: req.path,
          method: req.method
        }
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error fetching merchant profile'
      });
    }
    
  } catch (error) {
    logger.error({
      message: `Merchant authorization error: ${error instanceof Error ? error.message : String(error)}`,
      category: 'security',
      userId: req.user?.id,
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'An error occurred during authorization'
    });
  }
};

/**
 * Middleware to check if the user is an admin or merchant
 * @param req Express Request
 * @param res Express Response
 * @param next Express NextFunction
 */
export const isAdminOrMerchant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is already attached to request (by JWT middleware)
    if (!req.user) {
      logger.warn({
        message: 'Admin/Merchant authorization required but no user found on request',
        category: 'security',
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
        }
      });
      
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user is an admin or merchant
    if (req.user.role !== 'admin' && req.user.role !== 'merchant') {
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access admin/merchant resource with role ${req.user.role}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: req.user.role
        }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin or merchant access required'
      });
    }
    
    next();
  } catch (error) {
    logger.error({
      message: `Admin/Merchant authorization error: ${error instanceof Error ? error.message : String(error)}`,
      category: 'security',
      userId: req.user?.id,
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'An error occurred during authorization'
    });
  }
};

/**
 * Middleware to check if the user is a customer
 * @param req Express Request
 * @param res Express Response
 * @param next Express NextFunction
 */
export const isCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is already attached to request (by JWT middleware)
    if (!req.user) {
      logger.warn({
        message: 'Customer authorization required but no user found on request',
        category: 'security',
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
        }
      });
      
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user is a customer
    if (req.user.role !== 'customer') {
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access customer resource with role ${req.user.role}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: req.user.role
        }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Customer access required'
      });
    }
    
    next();
  } catch (error) {
    logger.error({
      message: `Customer authorization error: ${error instanceof Error ? error.message : String(error)}`,
      category: 'security',
      userId: req.user?.id,
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'An error occurred during authorization'
    });
  }
};

/**
 * Middleware to check if the user is a sales representative
 * @param req Express Request
 * @param res Express Response
 * @param next Express NextFunction
 */
export const isSalesRep = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is already attached to request (by JWT middleware)
    if (!req.user) {
      logger.warn({
        message: 'Sales rep authorization required but no user found on request',
        category: 'security',
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
        }
      });
      
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user is a sales representative
    if (req.user.role !== 'sales_rep') {
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access sales rep resource with role ${req.user.role}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: req.user.role
        }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Sales representative access required'
      });
    }
    
    next();
  } catch (error) {
    logger.error({
      message: `Sales rep authorization error: ${error instanceof Error ? error.message : String(error)}`,
      category: 'security',
      userId: req.user?.id,
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'An error occurred during authorization'
    });
  }
};

// For backward compatibility with existing code
export const authenticateToken = isAuthenticated;