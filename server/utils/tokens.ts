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
    console.error('[TOKEN GEN] Cannot generate token: Missing or invalid user ID');
    throw new Error('Invalid user object');
  }
  
  // CRITICAL FIX: Always ensure we have a role explicitly, handling various formats
  let role = 'user'; // Default fallback
  
  try {
    // Handle various user object formats
    if (user.role !== undefined) {
      // User has a role directly 
      role = String(user.role).toLowerCase().trim();
      console.log(`[TOKEN GEN] Found role directly in user object: '${role}'`);
    } else if (user.user && user.user.role !== undefined) {
      // Role is nested in user.user (common in some auth flows)
      role = String(user.user.role).toLowerCase().trim();
      console.log(`[TOKEN GEN] Found role in nested user.user object: '${role}'`);
    } else {
      console.log(`[TOKEN GEN] No role found in user object, using default: '${role}'`);
    }
    
    // Validate and normalize common role values for consistency
    // This ensures case differences don't cause authorization issues
    if (role.toLowerCase() === 'admin') {
      role = 'admin';
    } else if (role.toLowerCase() === 'merchant') {
      role = 'merchant';
    } else if (role.toLowerCase() === 'customer') {
      role = 'customer';
    } else if (role.toLowerCase() === 'investor') {
      role = 'investor';
    } else if (role.toLowerCase() === 'sales_rep') {
      role = 'sales_rep';
    }
    
    console.log(`[TOKEN GEN] Final normalized role for token: '${role}'`);
  } catch (error) {
    console.error(`[TOKEN GEN] Error normalizing role, using default '${role}':`, error);
    logger.error({
      message: `Error normalizing user role in token generation: ${error instanceof Error ? error.message : String(error)}`,
      category: "security",
      source: "internal",
      metadata: {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error)
      }
    });
  }
  
  // Log token generation for debugging
  console.log(`[TOKEN GEN] Generating token for user ID ${user.id} with role: ${role} (email: ${user.email || 'unknown'})`);
  
  // Create payload with userId, role, email and additional security claims
  const payload = {
    userId: user.id,
    id: user.id, // Include ID for legacy systems that expect it
    email: user.email || '',
    role: role, // Using the explicitly normalized role
    jti: crypto.randomUUID(), // Unique token ID for token revocation if needed
    iat: Math.floor(Date.now() / 1000), // Issued at time
  };
  
  console.log(`[TOKEN GEN] Token payload:`, payload);
  
  // Use a much more secure approach for token generation
  const token = jwt.sign(
    payload,
    DEFAULT_JWT_SECRET,
    { 
      expiresIn: '7d', // Extend token expiration to 7 days instead of 24 hours
      algorithm: 'HS512' // Use stronger algorithm (HS512 instead of default HS256)
    }
  );
  
  // Log a short preview of the token for debugging (not showing the full token for security)
  if (token) {
    const tokenPreview = token.substring(0, 10) + '...' + token.substring(token.length - 5);
    console.log(`[TOKEN GEN] Generated token: ${tokenPreview}`);
  }
  
  return token;
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token
 * @returns {object|null} Decoded token payload or null if invalid
 */
export function verifyToken(token: string): any | null {
  try {
    // Enhanced debugging for JWT verification
    let decodedBase64Payload = null;
    try {
      // Debug peek at token content before verification (without signature check)
      const parts = token.split('.');
      if (parts.length === 3) {
        // Base64 decode the payload (middle part)
        decodedBase64Payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log(`[TOKEN DEBUG] Pre-verification payload check:`, decodedBase64Payload);
        
        // Preview role from the payload
        const previewRole = decodedBase64Payload.role || 'NOT_FOUND';
        console.log(`[TOKEN DEBUG] Role in pre-verification payload: ${previewRole}`);
      }
    } catch (debugErr) {
      console.log(`[TOKEN DEBUG] Failed to peek at token content: ${debugErr instanceof Error ? debugErr.message : String(debugErr)}`);
    }
    
    // Verify the token using the configured secret
    const decoded = jwt.verify(token, DEFAULT_JWT_SECRET, {
      algorithms: ['HS512', 'HS256'] // Accept both algorithms for backward compatibility
    });
    
    // Ensure decoded is an object
    if (decoded && typeof decoded === 'object') {
      // Log successful verification with token details
      console.log(`[TOKEN DEBUG] JWT successfully verified. Payload:`, decoded);
      
      // CRITICAL ENHANCEMENT: Check for both ID or userId and standardize the output
      // This ensures consistent user identification regardless of how the token was created
      if (!decoded.id && decoded.userId) {
        console.log(`[TOKEN DEBUG] Normalizing token: Adding id=${decoded.userId} from userId`);
        decoded.id = decoded.userId;
      } else if (!decoded.userId && decoded.id) {
        console.log(`[TOKEN DEBUG] Normalizing token: Adding userId=${decoded.id} from id`);
        decoded.userId = decoded.id;
      }
      
      // ENHANCED ROLE HANDLING: Ensure role is present and normalized
      // This handles various ways role might be represented in the token
      let role = 'pending_verification'; // Default placeholder

      try {
        if (decoded.role) {
          // Ensure role is a normalized string (lowercase)
          if (typeof decoded.role === 'string') {
            role = decoded.role.toLowerCase().trim();
            console.log(`[TOKEN DEBUG] Normalized existing role: ${role}`);
          } else {
            // Handle non-string roles by converting to string
            const originalRole = decoded.role;
            role = String(decoded.role).toLowerCase().trim();
            console.log(`[TOKEN DEBUG] Converted non-string role (${typeof originalRole}) to: ${role}`);
          }
        } else if (decoded.user && decoded.user.role) {
          // Role is nested in a user property
          role = String(decoded.user.role).toLowerCase().trim();
          console.log(`[TOKEN DEBUG] Using nested role from decoded.user.role: ${role}`);
        } else if (decoded.userId || decoded.id) {
          // If no role is found anywhere, log warning and use placeholder
          logger.debug({
            message: `JWT token missing role property, using placeholder role`,
            category: "security",
            source: "internal",
            metadata: {
              userId: decoded.userId || decoded.id
            }
          });
          
          // CRITICAL FIX: Temporarily assign a placeholder role to be replaced
          // This ensures we don't have null/undefined role causing comparison issues
          console.log(`[TOKEN DEBUG] WARNING: JWT token is missing the 'role' property. User ID: ${decoded.userId || decoded.id}`);
          console.log(`[TOKEN DEBUG] Setting temporary placeholder role to be filled from database`);
        }
        
        // Normalize common role values for consistency with authorization checks
        if (role.toLowerCase() === 'admin') {
          role = 'admin';
        } else if (role.toLowerCase() === 'merchant') {
          role = 'merchant';
        } else if (role.toLowerCase() === 'customer') {
          role = 'customer';
        } else if (role.toLowerCase() === 'investor') {
          role = 'investor';
        } else if (role.toLowerCase() === 'sales_rep') {
          role = 'sales_rep';
        }
        
        // Update the decoded token with normalized role
        decoded.role = role;
        console.log(`[TOKEN DEBUG] Final normalized role for token verification: '${role}'`);
      } catch (roleErr) {
        // If role normalization fails for any reason, use the placeholder
        console.error(`[TOKEN DEBUG] Error normalizing role, using placeholder:`, roleErr);
        decoded.role = 'pending_verification';
      }
      
      // CRITICAL FIX: Ensure user object has expected format with all required fields
      // Create standardized user object with all expected properties
      const standardizedUser = {
        id: decoded.id || decoded.userId,
        userId: decoded.userId || decoded.id,
        email: decoded.email || '',
        role: decoded.role || 'pending_verification',
        iat: decoded.iat,
        exp: decoded.exp,
        jti: decoded.jti
      };
      
      console.log(`[TOKEN DEBUG] Normalized user data from token:`, standardizedUser);
      
      return standardizedUser;
    }
    
    console.log(`[TOKEN DEBUG] Token verified but decoded value is not an object:`, decoded);
    return null;
  } catch (error) {
    console.log(`[TOKEN DEBUG] JWT verification error: ${error instanceof Error ? error.message : String(error)}`);
    
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
  // Debug logging for admin routes
  const isAdminRoute = req.path.startsWith('/api/admin');
  
  if (isAdminRoute) {
    console.log(`[TOKEN EXTRACT] Processing token extraction for ${req.method} ${req.path}`);
    
    if (req.cookies) {
      console.log(`[TOKEN EXTRACT] Available cookies:`, Object.keys(req.cookies));
    } else {
      console.log(`[TOKEN EXTRACT] No cookies available`);
    }
    
    if (req.headers.authorization) {
      console.log(`[TOKEN EXTRACT] Authorization header exists`);
    } else {
      console.log(`[TOKEN EXTRACT] No Authorization header`);
    }
  }
  
  // CRITICAL FIX: For admin routes specifically, prioritize Authorization header over cookies
  // This fixes issues where client is explicitly setting Bearer token for admin API calls
  if (isAdminRoute && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];
    if (token) {
      console.log(`[TOKEN EXTRACT] Using Authorization header for admin route`);
      return token;
    }
  }
  
  // Check for secure HttpOnly cookie (most secure for regular operations)
  if (req.cookies && req.cookies.auth_token) {
    if (isAdminRoute) {
      console.log(`[TOKEN EXTRACT] Using auth_token cookie`);
    }
    return req.cookies.auth_token;
  }

  // Legacy support for old cookie name
  if (req.cookies && req.cookies.token) {
    if (isAdminRoute) {
      console.log(`[TOKEN EXTRACT] Using legacy token cookie`);
    }
    return req.cookies.token;
  }
  
  // Fallback to Authorization header (Bearer token) for API clients
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    if (isAdminRoute) {
      console.log(`[TOKEN EXTRACT] Using Authorization header as fallback`);
    }
    return authHeader.split(' ')[1];
  }
  
  if (isAdminRoute) {
    console.log(`[TOKEN EXTRACT] No token found in any location`);
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