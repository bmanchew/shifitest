import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { logger } from '../services/logger';
import { db } from '../db';
import { merchants } from '../../shared/schema';
import { eq } from 'drizzle-orm';

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
      
      // Create a merchant record with the correct type structure
      // Use type assertion to resolve TypeScript nullable vs optional field differences
      const merchantRecord = {
        id: merchantRecords[0].id,
        name: merchantRecords[0].name,
        contactName: merchantRecords[0].contactName,
        email: merchantRecords[0].email,
        phone: merchantRecords[0].phone,
        address: merchantRecords[0].address || undefined,
        active: merchantRecords[0].active ?? undefined,
        archived: merchantRecords[0].archived ?? undefined,
        createdAt: merchantRecords[0].createdAt || undefined,
        userId: merchantRecords[0].userId || undefined
      };
      
      // Attach merchant to request
      req.merchant = merchantRecord as Express.Request['merchant'];
      
      // Log the successful merchant identification
      const merchantId = merchantRecord.id;
      logger.debug({
        message: `Merchant identified: ${merchantId} for user ${req.user.id}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          merchantId: merchantId,
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
    
    // If user is a merchant, fetch merchant data
    if (req.user.role === 'merchant') {
      try {
        // Get the merchant record for this user
        const merchantRecords = await db.select()
          .from(merchants)
          .where(eq(merchants.userId, req.user.id))
          .limit(1);
        
        if (merchantRecords.length > 0) {
          // Create a merchant record with the correct type structure
          const merchantRecord = {
            id: merchantRecords[0].id,
            name: merchantRecords[0].name,
            contactName: merchantRecords[0].contactName,
            email: merchantRecords[0].email,
            phone: merchantRecords[0].phone,
            address: merchantRecords[0].address || undefined,
            active: merchantRecords[0].active ?? undefined,
            archived: merchantRecords[0].archived ?? undefined,
            createdAt: merchantRecords[0].createdAt || undefined,
            userId: merchantRecords[0].userId || undefined
          };
          
          // Attach merchant to request
          req.merchant = merchantRecord as Express.Request['merchant'];
          
          logger.debug({
            message: `Merchant identified in isAdminOrMerchant: ${merchantRecord.id} for user ${req.user.id}`,
            category: 'security',
            userId: req.user.id,
            source: 'internal',
            metadata: {
              merchantId: merchantRecord.id,
              userId: req.user.id,
              path: req.path
            }
          });
        }
      } catch (dbError) {
        // Log the error but don't block access
        logger.error({
          message: `Non-blocking DB error in isAdminOrMerchant: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
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
      }
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
 * Middleware to check if the user is an investor
 * @param req Express Request
 * @param res Express Response
 * @param next Express NextFunction
 */
export const isInvestor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is already attached to request (by JWT middleware)
    if (!req.user) {
      logger.warn({
        message: 'Investor authorization required but no user found on request',
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
    
    // Check if user is an investor
    if (req.user.role !== 'investor') {
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access investor resource with role ${req.user.role}`,
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
        message: 'Investor access required'
      });
    }
    
    next();
  } catch (error) {
    logger.error({
      message: `Investor authorization error: ${error instanceof Error ? error.message : String(error)}`,
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

/**
 * Middleware to authenticate admin users for the admin API
 * This combines isAuthenticated and isAdmin into a single middleware
 * @param req Express Request
 * @param res Express Response
 * @param next Express NextFunction
 */
export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // First check if the user is authenticated
    if (!req.user) {
      logger.warn({
        message: 'Admin authentication required but no user found on request',
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
    
    // Then check if the user is an admin
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
      message: `Admin authentication error: ${error instanceof Error ? error.message : String(error)}`,
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
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Generic role-based middleware that can be used to restrict access based on user roles
 * This is a higher-order function that returns a middleware function
 * 
 * @param role The role or array of roles that should be allowed access
 * @returns Middleware function that checks if the user has the required role
 * 
 * @example
 * // Only allow admins
 * router.get('/admin/users', requireRole('admin'), AdminController.getUsers);
 * 
 * @example
 * // Allow either admins or merchants
 * router.get('/shared-resource', requireRole(['admin', 'merchant']), Controller.getResource);
 */
export const requireRole = (role: string | string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is already attached to request (by JWT middleware)
      if (!req.user) {
        logger.warn({
          message: 'Role-based authorization required but no user found on request',
          category: 'security',
          source: 'internal',
          metadata: {
            path: req.path,
            method: req.method,
            requiredRole: role
          }
        });
        
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      // Handle both single role and array of roles
      const roles = Array.isArray(role) ? role : [role];
      
      // Check if user has one of the required roles
      if (!roles.includes(req.user.role)) {
        logger.warn({
          message: `User ${req.user.email} (${req.user.id}) attempted to access resource requiring role(s) [${roles.join(', ')}] with role ${req.user.role}`,
          category: 'security',
          userId: req.user.id,
          source: 'internal',
          metadata: {
            path: req.path,
            method: req.method,
            userRole: req.user.role,
            requiredRoles: roles
          }
        });
        
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${Array.isArray(role) ? role.join(' or ') : role}`
        });
      }
      
      // For merchant role, also fetch and attach merchant data
      if (req.user.role === 'merchant' && !req.merchant) {
        try {
          // Get the merchant record for this user
          const merchantRecords = await db.select()
            .from(merchants)
            .where(eq(merchants.userId, req.user.id))
            .limit(1);
          
          if (merchantRecords.length > 0) {
            // Create a merchant record with the correct type structure
            const merchantRecord = {
              id: merchantRecords[0].id,
              name: merchantRecords[0].name,
              contactName: merchantRecords[0].contactName,
              email: merchantRecords[0].email,
              phone: merchantRecords[0].phone,
              address: merchantRecords[0].address || undefined,
              active: merchantRecords[0].active ?? undefined,
              archived: merchantRecords[0].archived ?? undefined,
              createdAt: merchantRecords[0].createdAt || undefined,
              userId: merchantRecords[0].userId || undefined
            };
            
            // Attach merchant to request
            req.merchant = merchantRecord as Express.Request['merchant'];
          }
        } catch (dbError) {
          // Log the error but continue processing since we need to provide a proper response
          logger.error({
            message: `Error fetching merchant data in requireRole: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
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
        }
      }
      
      next();
    } catch (error) {
      logger.error({
        message: `Role-based authorization error: ${error instanceof Error ? error.message : String(error)}`,
        category: 'security',
        userId: req.user?.id,
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          path: req.path,
          method: req.method,
          requiredRole: role
        }
      });
      
      res.status(500).json({
        success: false,
        message: 'An error occurred during authorization'
      });
    }
  };
};