/**
 * Token Utilities
 * Provides centralized token operations for JWT authentication
 */
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../services/logger';

// Generate a secure random JWT secret if not provided in environment
const DEFAULT_JWT_SECRET = process.env.JWT_SECRET || generateSecureSecret();

/**
 * Generates a cryptographically secure random string for use as JWT secret
 * @returns {string} A secure random string
 */
function generateSecureSecret(): string {
  try {
    // Generate a 64-byte (512-bit) random string - much more secure than fixed secret
    return crypto.randomBytes(64).toString('hex');
  } catch (error) {
    logger.error({
      message: `Failed to generate secure JWT secret: ${error instanceof Error ? error.message : String(error)}`,
      category: "security",
      source: "internal"
    });
    // Fallback to a UUID if randomBytes fails (still better than a hardcoded string)
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  }
}

/**
 * Generate a JWT token for a user
 * @param {object} user - User object
 * @returns {string} JWT token
 */
export function generateToken(user: any): string {
  if (!user || !user.id) {
    throw new Error('Invalid user object');
  }
  
  // Create payload with userId, role, and additional security claims
  const payload = {
    userId: user.id,
    role: user.role || 'user',
    jti: crypto.randomUUID(), // Unique token ID for token revocation if needed
    iat: Math.floor(Date.now() / 1000), // Issued at time
  };
  
  // Use a much more secure approach for token generation
  return jwt.sign(
    payload,
    DEFAULT_JWT_SECRET,
    { 
      expiresIn: '7d', // Extend token expiration to 7 days instead of 24 hours
      algorithm: 'HS512' // Use stronger algorithm (HS512 instead of default HS256)
    }
  );
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token
 * @returns {object|null} Decoded token payload or null if invalid
 */
export function verifyToken(token: string): any | null {
  try {
    const decoded = jwt.verify(token, DEFAULT_JWT_SECRET, {
      algorithms: ['HS512', 'HS256'] // Accept both algorithms for backward compatibility
    });
    return decoded;
  } catch (error) {
    logger.warn({
      message: `JWT verification error: ${error instanceof Error ? error.message : String(error)}`,
      category: "security",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.message : String(error)
      }
    });
    return null;
  }
}

/**
 * Extract token from request
 * @param req Express Request
 * @returns Token string or null if not found
 */
export function extractTokenFromRequest(req: Request): string | null {
  // First check for secure HttpOnly cookie (most secure)
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }

  // Legacy support for old cookie name
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  // Fallback to Authorization header (Bearer token) for API clients
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  
  return null;
}

/**
 * Configure cookie options for token storage
 * @param rememberMe Whether to extend cookie lifetime (for "remember me" functionality)
 * @returns Cookie options object
 */
export function getAuthCookieOptions(rememberMe: boolean = false): any {
  return {
    httpOnly: true, // Prevent client-side JavaScript from accessing the cookie
    secure: process.env.NODE_ENV === 'production', // Only use HTTPS in production
    path: '/',
    sameSite: 'strict' as const, // Prevent CSRF
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 30 days if "remember me", 7 days otherwise (matching JWT token expiration)
  };
}