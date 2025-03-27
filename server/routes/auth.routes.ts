import express from 'express';
import { authController } from '../controllers/auth.controller';
import { authRateLimiter, userCreationRateLimiter } from '../middleware/authRateLimiter';
import { isAuthenticated } from '../middleware/auth';

const router = express.Router();

// Login route with rate limiting
router.post('/login', authRateLimiter, authController.login);

// Register route with rate limiting
router.post('/register', userCreationRateLimiter, authController.register);

// Verify token route
router.get('/verify-token', isAuthenticated, authController.verifyToken);

// Logout route
router.post('/logout', isAuthenticated, authController.logout);

// Forgot password route with rate limiting
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);

// Reset password route with rate limiting
router.post('/reset-password', authRateLimiter, authController.resetPassword);

// Verify email route
router.get('/verify-email/:token', authController.verifyEmail);

// Resend verification email route with rate limiting
router.post('/resend-verification', authRateLimiter, authController.resendVerificationEmail);

export default router;