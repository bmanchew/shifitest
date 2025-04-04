/**
 * Authentication service for JWT token generation and validation
 */
import jwt from 'jsonwebtoken';

// Define a default JWT secret for development use
const DEFAULT_JWT_SECRET = "shifi-secure-jwt-secret-for-development-only";

// Use either the environment variable or the default
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

/**
 * Generate a JWT token for a user
 * @param {object} user - User object
 * @returns {string} JWT token
 */
export function generateJwtToken(user) {
  return jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token
 * @returns {object|null} Decoded token payload or null if invalid
 */
export function verifyJwtToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return null;
  }
}