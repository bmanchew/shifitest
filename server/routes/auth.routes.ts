import express from 'express';
import { authController } from '../controllers/auth.controller';
import { loginRateLimiter, passwordResetRateLimiter, registrationRateLimiter, verificationRateLimiter } from '../middleware/authRateLimiter';
import { isAuthenticated } from '../middleware/auth';
import { asyncHandler } from '../services/errorHandler';

const router = express.Router();

// Login route with rate limiting
router.post('/login', loginRateLimiter, asyncHandler(authController.login));

// Register route with rate limiting
router.post('/register', registrationRateLimiter, asyncHandler(authController.register));

// Verify token route
router.get('/verify-token', isAuthenticated, asyncHandler(authController.verifyToken));

// Get current user route
router.get('/me', isAuthenticated, asyncHandler(authController.getCurrentUser));

// Logout route
router.post('/logout', isAuthenticated, asyncHandler(authController.logout));

// Forgot password route with rate limiting
router.post('/forgot-password', passwordResetRateLimiter, asyncHandler(authController.forgotPassword));

// Reset password route with rate limiting
router.post('/reset-password', passwordResetRateLimiter, asyncHandler(authController.resetPassword));

// Verify email route
router.get('/verify-email/:token', asyncHandler(authController.verifyEmail));

// Resend verification email route with rate limiting
router.post('/resend-verification', verificationRateLimiter, asyncHandler(authController.resendVerificationEmail));

// Magic link request route with rate limiting (for customers only)
router.post('/magic-link', loginRateLimiter, asyncHandler(authController.requestMagicLink));

// Magic link verification route
router.get('/magic-link/verify/:token', asyncHandler(authController.verifyMagicLink));

// OTP request route with rate limiting (for customers only)
router.post('/otp', loginRateLimiter, asyncHandler(authController.requestOtp));

// OTP verification route with rate limiting
router.post('/otp/verify', verificationRateLimiter, asyncHandler(authController.verifyOtp));

export default router;