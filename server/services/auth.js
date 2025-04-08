/**
 * Authentication service for JWT token generation and validation
 * This file is kept for backward compatibility
 * New code should import from ../utils/tokens.ts directly
 */
import { generateToken, verifyToken } from '../utils/tokens';

/**
 * Generate a JWT token for a user
 * @param {object} user - User object
 * @returns {string} JWT token
 */
export function generateJwtToken(user) {
  return generateToken(user);
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token
 * @returns {object|null} Decoded token payload or null if invalid
 */
export function verifyJwtToken(token) {
  return verifyToken(token);
}