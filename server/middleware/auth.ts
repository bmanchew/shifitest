import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { logger } from '../services/logger';

/**
 * Middleware to authenticate user token
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the auth header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }
    
    // Verify the token
    jwt.verify(
      token,
      process.env.JWT_SECRET || 'default_jwt_secret',
      async (err: any, decoded: any) => {
        if (err) {
          logger.warn({
            message: `Invalid or expired token: ${err.message}`,
            category: 'security',
            source: 'internal',
            metadata: {
              error: err.message,
              requestPath: req.path
            }
          });
          
          return res.status(403).json({
            success: false,
            message: 'Invalid or expired token'
          });
        }
        
        // Check if user exists
        const user = await storage.getUser(decoded.userId);
        
        if (!user) {
          logger.warn({
            message: `Token has valid userId but user not found: ${decoded.userId}`,
            category: 'security',
            source: 'internal',
            metadata: {
              userId: decoded.userId,
              requestPath: req.path
            }
          });
          
          return res.status(403).json({
            success: false,
            message: 'User not found'
          });
        }
        
        // Store user info in request object
        req.user = user;
        next();
      }
    );
  } catch (error) {
    logger.error({
      message: `Authentication error: ${error instanceof Error ? error.message : String(error)}`,
      category: 'security',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : null,
        requestPath: req.path
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Authentication failed due to server error'
    });
  }
};

/**
 * Middleware to check if user is an admin
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (req.user.role !== 'admin') {
    logger.warn({
      message: `Access denied: User ${req.user.id} attempted to access admin-only route`,
      category: 'security',
      source: 'internal',
      metadata: {
        userId: req.user.id,
        userRole: req.user.role,
        requestPath: req.path
      }
    });
    
    return res.status(403).json({
      success: false,
      message: 'Access denied: Admin privileges required'
    });
  }
  
  next();
};

/**
 * Middleware to check if user is a merchant
 */
export const isMerchant = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (req.user.role !== 'merchant') {
    logger.warn({
      message: `Access denied: User ${req.user.id} attempted to access merchant-only route`,
      category: 'security',
      source: 'internal',
      metadata: {
        userId: req.user.id,
        userRole: req.user.role,
        requestPath: req.path
      }
    });
    
    return res.status(403).json({
      success: false,
      message: 'Access denied: Merchant privileges required'
    });
  }
  
  // Optionally verify that merchant record exists
  try {
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      logger.warn({
        message: `User ${req.user.id} has merchant role but no merchant record`,
        category: 'security',
        source: 'internal',
        metadata: {
          userId: req.user.id,
          requestPath: req.path
        }
      });
      
      // Store empty merchant info
      req.merchant = null;
    } else {
      // Store merchant info in request
      req.merchant = merchant;
    }
    
    next();
  } catch (error) {
    logger.error({
      message: `Error checking merchant status: ${error instanceof Error ? error.message : String(error)}`,
      category: 'security',
      source: 'internal',
      metadata: {
        userId: req.user.id,
        error: error instanceof Error ? error.stack : null,
        requestPath: req.path
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Error verifying merchant status'
    });
  }
};

/**
 * Middleware to check if user is a customer
 */
export const isCustomer = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (req.user.role !== 'customer') {
    logger.warn({
      message: `Access denied: User ${req.user.id} attempted to access customer-only route`,
      category: 'security',
      source: 'internal',
      metadata: {
        userId: req.user.id,
        userRole: req.user.role,
        requestPath: req.path
      }
    });
    
    return res.status(403).json({
      success: false,
      message: 'Access denied: Customer privileges required'
    });
  }
  
  next();
};

/**
 * Middleware to check if user is a sales rep
 */
export const isSalesRep = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false, 
      message: 'Authentication required'
    });
  }
  
  if (req.user.role !== 'sales_rep') {
    logger.warn({
      message: `Access denied: User ${req.user.id} attempted to access sales-rep-only route`,
      category: 'security',
      source: 'internal',
      metadata: {
        userId: req.user.id,
        userRole: req.user.role,
        requestPath: req.path
      }
    });
    
    return res.status(403).json({
      success: false,
      message: 'Access denied: Sales representative privileges required'
    });
  }
  
  // Optionally verify that salesRep record exists
  try {
    const salesRep = await storage.getSalesRepByUserId(req.user.id);
    
    if (!salesRep) {
      logger.warn({
        message: `User ${req.user.id} has sales_rep role but no sales rep record`,
        category: 'security',
        source: 'internal',
        metadata: {
          userId: req.user.id,
          requestPath: req.path
        }
      });
      
      // Store empty sales rep info
      req.salesRep = null;
    } else {
      // Store sales rep info in request
      req.salesRep = salesRep;
    }
    
    next();
  } catch (error) {
    logger.error({
      message: `Error checking sales rep status: ${error instanceof Error ? error.message : String(error)}`,
      category: 'security',
      source: 'internal',
      metadata: {
        userId: req.user.id,
        error: error instanceof Error ? error.stack : null,
        requestPath: req.path
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Error verifying sales rep status'
    });
  }
};

/**
 * Middleware to check if a user can access merchant data
 * This is a more flexible middleware that allows:
 * 1. Admin users to access any merchant data
 * 2. Merchant users to access only their own merchant data
 */
export const canAccessMerchantData = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  // Get the merchant ID from the request parameters
  const merchantId = parseInt(req.params.id);
  
  if (isNaN(merchantId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid merchant ID'
    });
  }
  
  // Check user role
  if (req.user.role === 'admin') {
    // Admins can access any merchant data
    next();
  } else if (req.user.role === 'merchant') {
    // Load the merchant record for the user
    const userMerchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!userMerchant) {
      logger.warn({
        message: `User ${req.user.id} has merchant role but no merchant record`,
        category: 'security',
        source: 'internal',
        metadata: {
          userId: req.user.id,
          requestPath: req.path
        }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Access denied: No merchant record found for user'
      });
    }
    
    // Check if the user's merchant ID matches the requested merchant ID
    if (userMerchant.id !== merchantId) {
      logger.warn({
        message: `Access denied: Merchant ${userMerchant.id} attempted to access data for merchant ${merchantId}`,
        category: 'security',
        source: 'internal',
        metadata: {
          userId: req.user.id,
          userMerchantId: userMerchant.id,
          requestedMerchantId: merchantId,
          requestPath: req.path
        }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only access your own merchant data'
      });
    }
    
    // Store merchant info in request
    req.merchant = userMerchant;
    next();
  } else {
    // Other user types cannot access merchant data
    logger.warn({
      message: `Access denied: User ${req.user.id} with role ${req.user.role} attempted to access merchant data`,
      category: 'security',
      source: 'internal',
      metadata: {
        userId: req.user.id,
        userRole: req.user.role,
        requestPath: req.path
      }
    });
    
    return res.status(403).json({
      success: false,
      message: 'Access denied: Insufficient privileges to access merchant data'
    });
  }
};

// Add TypeScript declarations for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: any;
      merchant?: any;
      salesRep?: any;
    }
  }
}