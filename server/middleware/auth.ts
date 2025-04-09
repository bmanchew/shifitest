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
    // Enhanced debugging for admin authorization
    console.log(`[ADMIN AUTH] Checking admin access for ${req.method} ${req.path}`);
    
    // Check if user is already attached to request (by JWT middleware)
    if (!req.user) {
      console.log(`[ADMIN AUTH] No user found on request! Authentication failed.`);
      
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
    
    // Log user details for debugging
    console.log(`[ADMIN AUTH] User found: ID=${req.user.id}, Email=${req.user.email || 'unknown'}, Role=${req.user.role || 'undefined'}`);
    
    // CRITICAL FIX: Ensure role is properly checked, with more explicit debugging and case-insensitive comparison
    // Extract user role and ensure it's a string, normalized to lowercase
    const userRole = ((req.user.role || '') + '').toLowerCase().trim();
    
    // Now compare the normalized role with 'admin'
    if (userRole !== 'admin') {
      console.log(`[ADMIN AUTH] Access denied - User role '${userRole}' is not 'admin'`);
      
      // Detailed logging of the user object to help with debugging
      console.log(`[ADMIN AUTH] Full user object:`, JSON.stringify(req.user, null, 2));
      
      logger.warn({
        message: `User ${req.user.email || 'unknown'} (${req.user.id}) attempted to access admin resource with role ${userRole}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: userRole
        }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    // User is confirmed as admin, proceed
    console.log(`[ADMIN AUTH] Access granted - User is admin`);
    
    // User is an admin, proceed to next middleware/route handler
    next();
  } catch (error) {
    console.log(`[ADMIN AUTH] Error in admin authorization check: ${error instanceof Error ? error.message : String(error)}`);
    
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
    
    // CRITICAL FIX: Normalize the user role for more reliable role-based access control
    // Extract user role and ensure it's a string, normalized to lowercase
    const userRole = ((req.user.role || '') + '').toLowerCase().trim();
    console.log(`[MERCHANT AUTH] Checking merchant access for user ID ${req.user.id} with role: ${userRole}`);

    // Check if user is a merchant with case-insensitive comparison
    if (userRole !== 'merchant') {
      console.log(`[MERCHANT AUTH] Access denied - User role '${userRole}' is not 'merchant'`);
      
      // Log detailed user object for debugging
      console.log(`[MERCHANT AUTH] Full user object:`, JSON.stringify(req.user, null, 2));
      
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access merchant resource with role ${userRole}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: userRole
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
      
      // Add merchantId to request for convenience
      req.merchantId = merchantRecord.id;
      
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
    
    // CRITICAL FIX: Normalize the user role for more reliable role-based access control
    const userRole = ((req.user.role || '') + '').toLowerCase().trim();
    console.log(`[ADMIN/MERCHANT AUTH] Checking admin/merchant access for user ID ${req.user.id} with role: ${userRole}`);

    // Check if user is an admin or merchant with case-insensitive comparison
    if (userRole !== 'admin' && userRole !== 'merchant') {
      console.log(`[ADMIN/MERCHANT AUTH] Access denied - User role '${userRole}' is neither 'admin' nor 'merchant'`);
      
      // Log detailed user object for debugging
      console.log(`[ADMIN/MERCHANT AUTH] Full user object:`, JSON.stringify(req.user, null, 2));
      
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access admin/merchant resource with role ${userRole}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: userRole
        }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin or merchant access required'
      });
    }
    
    // If user is a merchant, fetch merchant data
    // Use the normalized role variable for consistency
    if (userRole === 'merchant') {
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
          
          // Add merchantId to request for convenience
          req.merchantId = merchantRecord.id;
          
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
    
    // CRITICAL FIX: Normalize the user role for consistent case-insensitive checks
    const userRole = ((req.user.role || '') + '').toLowerCase().trim();
    console.log(`[CUSTOMER AUTH] Checking customer access for user ID ${req.user.id} with role: ${userRole}`);
    
    // Check if user is a customer with case-insensitive comparison
    if (userRole !== 'customer') {
      console.log(`[CUSTOMER AUTH] Access denied - User role '${userRole}' is not 'customer'`);
      
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access customer resource with role ${userRole}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: userRole
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
    
    // CRITICAL FIX: Normalize the user role for consistent case-insensitive checks
    const userRole = ((req.user.role || '') + '').toLowerCase().trim();
    console.log(`[INVESTOR AUTH] Checking investor access for user ID ${req.user.id} with role: ${userRole}`);
    
    // Check if user is an investor with case-insensitive comparison
    if (userRole !== 'investor') {
      console.log(`[INVESTOR AUTH] Access denied - User role '${userRole}' is not 'investor'`);
      
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access investor resource with role ${userRole}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: userRole
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
    
    // CRITICAL FIX: Normalize the user role for consistent case-insensitive checks
    const userRole = ((req.user.role || '') + '').toLowerCase().trim();
    console.log(`[SALES REP AUTH] Checking sales rep access for user ID ${req.user.id} with role: ${userRole}`);
    
    // Check if user is a sales representative with case-insensitive comparison
    if (userRole !== 'sales_rep') {
      console.log(`[SALES REP AUTH] Access denied - User role '${userRole}' is not 'sales_rep'`);
      
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access sales rep resource with role ${userRole}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: userRole
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

/**
 * Enhanced authentication middleware that:
 * 1. Checks if the user is authenticated
 * 2. For merchant users, also attaches the merchant data to the request
 * 
 * This provides backward compatibility with existing code while ensuring
 * merchant data is available when needed.
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // First check if user is authenticated
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
    
    // If user is a merchant, also fetch and attach merchant data
    // Use the normalized role for consistency in checks
    const userRole = ((req.user.role || '') + '').toLowerCase().trim();
    console.log(`[AUTH] User role from token: '${userRole}'`);
    
    if (userRole === 'merchant') {
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
          
          // Add merchantId to request for convenience
          req.merchantId = merchantRecord.id;
          
          logger.debug({
            message: `Merchant record attached in authenticateToken: ${merchantRecord.id} for user ${req.user.id}`,
            category: 'security',
            userId: req.user.id,
            source: 'internal',
            metadata: {
              merchantId: merchantRecord.id,
              path: req.path
            }
          });
        } else {
          logger.warn({
            message: `User ${req.user.email} (${req.user.id}) has merchant role but no merchant record found`,
            category: 'security',
            userId: req.user.id,
            source: 'internal',
            metadata: {
              path: req.path,
              method: req.method
            }
          });
          // We don't return an error here to maintain backward compatibility
          // The route handlers will check if req.merchant exists when needed
        }
      } catch (dbError) {
        // Log the error but don't block the request to maintain backward compatibility
        logger.error({
          message: `Error fetching merchant data in authenticateToken: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
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
 * Middleware to authenticate admin users for the admin API
 * This combines isAuthenticated and isAdmin into a single middleware
 * @param req Express Request
 * @param res Express Response
 * @param next Express NextFunction
 */
export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(`[ADMIN AUTH] Authenticating admin request for ${req.method} ${req.path}`);
    
    // First check if the user is authenticated
    if (!req.user) {
      console.log(`[ADMIN AUTH] No user found on request - authentication failed`);
      
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
    
    // Debug log user information
    console.log(`[ADMIN AUTH] User found: ID=${req.user.id}, Email=${req.user.email || 'unknown'}, Role=${req.user.role || 'unknown'}`);
    
    // CRITICAL FIX: Normalize the role check against multiple possible formats
    // This ensures role check works even if token structure varies
    const userRole = req.user.role?.toLowerCase() || '';  
    console.log(`[ADMIN AUTH] Checking if user role '${userRole}' matches 'admin'`);
    
    // Then check if the user is an admin
    if (userRole !== 'admin') {
      console.log(`[ADMIN AUTH] Access denied - User role '${userRole}' is not 'admin'`);
      
      logger.warn({
        message: `User ${req.user.email || 'unknown'} (${req.user.id}) attempted to access admin resource with role ${userRole}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal',
        metadata: {
          path: req.path,
          method: req.method,
          userRole: userRole
        }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    console.log(`[ADMIN AUTH] Access granted - User confirmed as admin`)
    
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
      console.log(`[ROLE AUTH] Checking role access for ${req.method} ${req.path}`);
      console.log(`[ROLE AUTH] Required role(s): ${Array.isArray(role) ? role.join(', ') : role}`);
      
      // Check if user is already attached to request (by JWT middleware)
      if (!req.user) {
        console.log(`[ROLE AUTH] No user found on request! Authentication failed.`);
        
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
      
      // Log user details for debugging
      // ENHANCED: Normalize role check - handle various formats and case-insensitivity
      const userRole = (req.user.role || '').toLowerCase().trim();
      console.log(`[ROLE AUTH] User found: ID=${req.user.id}, Email=${req.user.email || 'unknown'}, Role=${userRole}`);
      
      // Handle both single role and array of roles
      // ENHANCED: Convert all roles to lowercase for case-insensitive matching
      const roles = Array.isArray(role) 
        ? role.map(r => (r || '').toLowerCase().trim()) 
        : [(role || '').toLowerCase().trim()];
      
      console.log(`[ROLE AUTH] Required roles (normalized): [${roles.join(', ')}]`);
      
      // Check if user has one of the required roles
      // ENHANCED: Use case-insensitive comparison
      if (!roles.includes(userRole)) {
        console.log(`[ROLE AUTH] Access denied - User role '${userRole}' is not one of required roles: [${roles.join(', ')}]`);
        
        logger.warn({
          message: `User ${req.user.email || 'unknown'} (${req.user.id}) attempted to access resource requiring role(s) [${roles.join(', ')}] with role ${userRole}`,
          category: 'security',
          userId: req.user.id,
          source: 'internal',
          metadata: {
            path: req.path,
            method: req.method,
            userRole: userRole,
            requiredRoles: roles
          }
        });
        
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${Array.isArray(role) ? role.join(' or ') : role}`
        });
      }
      
      console.log(`[ROLE AUTH] Access granted - User role '${userRole}' matches required role(s)`)
      
      // For merchant role, also fetch and attach merchant data
      // ENHANCED: Make the role check case-insensitive
      if ((req.user.role || '').toLowerCase() === 'merchant' && !req.merchant) {
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
            
            // Add merchantId to request for convenience
            req.merchantId = merchantRecord.id;
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