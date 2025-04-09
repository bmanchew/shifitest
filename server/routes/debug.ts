import express, { Request, Response } from 'express';
import { logger } from '../services/logger';
import { verifyToken, extractTokenFromRequest } from '../utils/tokens';
import { storage } from '../storage';

const router = express.Router();

/**
 * Debugging endpoint to check token status
 * Returns information about the token status without requiring authentication
 */
router.get('/token-status', async (req: Request, res: Response) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(req);
    
    if (!token) {
      return res.json({
        success: false,
        message: 'No token found',
        details: {
          hasCookieToken: !!req.cookies?.auth_token || !!req.cookies?.token,
          hasAuthHeader: !!req.headers.authorization
        }
      });
    }
    
    // Verify the token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.json({
        success: false,
        message: 'Invalid or expired token',
        details: {
          tokenFound: true,
          tokenValid: false,
          tokenExpired: true
        }
      });
    }
    
    // Check if user exists
    let user = null;
    if (decoded.userId) {
      try {
        user = await storage.getUser(decoded.userId);
      } catch (error) {
        logger.error({
          message: `Error getting user for token debugging: ${error instanceof Error ? error.message : String(error)}`,
          category: "debug",
          source: "internal",
          metadata: {
            userId: decoded.userId,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }
    
    return res.json({
      success: true,
      message: 'Token is valid',
      details: {
        tokenFound: true,
        tokenValid: true,
        decoded: {
          userId: decoded.userId,
          role: decoded.role,
          iat: decoded.iat,
          exp: decoded.exp,
          jti: decoded.jti
        },
        userFound: !!user,
        userRole: user?.role
      }
    });
  } catch (error) {
    logger.error({
      message: `Token status debugging error: ${error instanceof Error ? error.message : String(error)}`,
      category: "debug",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Error checking token status',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;