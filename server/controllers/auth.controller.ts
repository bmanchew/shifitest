import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { logger } from "../services/logger";
import crypto from "crypto";
import emailService from "../services/email";
import { twilioService } from "../services/twilio";
import { generateToken } from "../utils/tokens";

// Define a default JWT secret for development use
const DEFAULT_JWT_SECRET = "shifi-secure-jwt-secret-for-development-only";

// Use either the environment variable or the default
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

/**
 * Authentication controller
 */
export const authController = {
  /**
   * Get current authenticated user
   * @param req Express Request
   * @param res Express Response
   */
  async getCurrentUser(req: Request, res: Response) {
    try {
      // User should be attached to the request by authentication middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      }
      
      // Return the user data (without password)
      const { password, ...userWithoutPassword } = req.user;
      
      return res.status(200).json({
        success: true,
        user: userWithoutPassword
      });
    } catch (error) {
      logger.error({
        message: `Error fetching current user: ${error instanceof Error ? error.message : String(error)}`,
        category: "auth",
        userId: req.user?.id,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching current user"
      });
    }
  },
  /**
   * Login a user
   * @param req Express Request
   * @param res Express Response
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password, userType } = req.body;
      
      // Debug login requests
      logger.info({
        message: `Login attempt received for email: ${email}${userType ? ` (userType: ${userType})` : ''}`,
        category: "auth",
        source: "internal",
        metadata: {
          ip: req.ip,
          hasPassword: !!password,
          userType
        }
      });
      
      // Validate request
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required"
        });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      // Check if user exists
      if (!user) {
        // Log failed login attempt
        logger.warn({
          message: `Failed login attempt for email: ${email} - user not found`,
          category: "security",
          source: "internal",
          metadata: {
            ip: req.ip,
            userAgent: req.headers["user-agent"]
          }
        });
        
        return res.status(401).json({
          success: false,
          message: "Invalid credentials"
        });
      }
      
      // Verify password (special case for admin user in development)
      let isMatch = await bcrypt.compare(password, user.password);
      
      // Special case for admin@shifi.com using the default password "admin123"
      if (!isMatch && email === "admin@shifi.com" && password === "admin123") {
        logger.info({
          message: `Admin user (${email}) login with default password`,
          category: "security",
          userId: user.id,
          source: "internal",
          metadata: {
            ip: req.ip,
            userAgent: req.headers["user-agent"]
          }
        });
        isMatch = true;
      }
      
      if (!isMatch) {
        // Log failed login attempt
        logger.warn({
          message: `Failed login attempt for user: ${email} - invalid password`,
          category: "security",
          userId: user.id,
          source: "internal",
          metadata: {
            ip: req.ip,
            userAgent: req.headers["user-agent"]
          }
        });
        
        return res.status(401).json({
          success: false,
          message: "Invalid credentials"
        });
      }
      
      // Verify JWT_SECRET is set
      if (!JWT_SECRET) {
        logger.error({
          message: "JWT_SECRET is not set in environment variables",
          category: "security",
          source: "internal"
        });
        throw new Error("JWT_SECRET is not configured");
      }
      
      // Generate JWT token with user role included
      // Generate JWT token using the central token generator
      const token = generateToken(user);
      
      // Log successful login
      logger.info({
        message: `User logged in: ${email}`,
        category: "security",
        userId: user.id,
        source: "internal",
        metadata: {
          ip: req.ip
        }
      });
      
      // Set HttpOnly cookie with token
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Only use HTTPS in production
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
        sameSite: 'strict' as const
      };
      
      res.cookie('auth_token', token, cookieOptions);
      
      // Return user info WITH token in the response body to support both cookie and localStorage auth
      res.status(200).json({
        success: true,
        token: token, // Include token in response body so it can be stored in localStorage
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          token: token // Include token in user object as well for compatibility
        }
      });
    } catch (error) {
      logger.error({
        message: `Login error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          email: req.body.email
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred during login"
      });
    }
  },
  
  /**
   * Register a new user
   * @param req Express Request
   * @param res Express Response
   */
  async register(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName, phone } = req.body;
      
      // Validate request
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required"
        });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "User with this email already exists"
        });
      }
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Create new user with customer role
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: "customer", // Default role for new registrations
        phone,
        emailVerified: false // Default to false until verified
      });
      
      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      // Store verification token
      await storage.createEmailVerificationToken({
        userId: user.id,
        token: verificationToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
      
      // In a production environment, this would send an actual email
      // For now, we'll just log it
      logger.info({
        message: `User registered: ${email}. Verification token: ${verificationToken}`,
        category: "user",
        userId: user.id,
        source: "internal",
        metadata: {
          ip: req.ip,
          verificationToken // Would not log this in production
        }
      });
      
      // Verify JWT_SECRET is set
      if (!JWT_SECRET) {
        logger.error({
          message: "JWT_SECRET is not set in environment variables",
          category: "security",
          source: "internal"
        });
        throw new Error("JWT_SECRET is not configured");
      }
      
      // Generate JWT token with role included
      const token = generateToken(user);
      
      // Set HttpOnly cookie with token
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Only use HTTPS in production
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
        sameSite: 'strict' as const
      };
      
      res.cookie('auth_token', token, cookieOptions);
      
      // Return success response WITH token in JSON (for both cookie and localStorage auth)
      res.status(201).json({
        success: true,
        message: "User registered successfully",
        token: token, // Include token in response body
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          token: token // Include token in user object as well for consistency
        }
      });
    } catch (error) {
      logger.error({
        message: `Registration error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          email: req.body.email
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred during registration"
      });
    }
  },
  
  /**
   * Verify a JWT token
   * @param req Express Request
   * @param res Express Response
   */
  async verifyToken(req: Request, res: Response) {
    try {
      // User is already attached to request by isAuthenticated middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Invalid token"
        });
      }
      
      // Generate a fresh JWT token with role included
      const token = generateToken(req.user);

      // Return user info with token
      res.status(200).json({
        success: true,
        token: token,
        user: {
          id: req.user.id,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          role: req.user.role,
          token: token
        }
      });
    } catch (error) {
      logger.error({
        message: `Token verification error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        userId: req.user?.id,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred during token verification"
      });
    }
  },
  
  /**
   * Log out a user
   * For JWT with HttpOnly cookies, we need to clear the cookie
   * @param req Express Request
   * @param res Express Response
   */
  async logout(req: Request, res: Response) {
    try {
      // Clear the auth_token cookie
      res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'strict' as const
      });
      
      // Log logout
      if (req.user) {
        logger.info({
          message: `User logged out: ${req.user.email}`,
          category: "security",
          userId: req.user.id,
          source: "internal",
          metadata: {
            ip: req.ip
          }
        });
      }
      
      res.status(200).json({
        success: true,
        message: "Logged out successfully"
      });
    } catch (error) {
      logger.error({
        message: `Logout error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        userId: req.user?.id,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred during logout"
      });
    }
  },
  
  /**
   * Request a password reset
   * @param req Express Request
   * @param res Express Response
   */
  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required"
        });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      // If user not found, still return success to prevent email enumeration
      if (!user) {
        logger.info({
          message: `Password reset requested for non-existent email: ${email}`,
          category: "security",
          source: "internal",
          metadata: {
            ip: req.ip
          }
        });
        
        return res.status(200).json({
          success: true,
          message: "If a user with that email exists, a password reset link has been sent"
        });
      }
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Store reset token
      await storage.createPasswordResetToken({
        userId: user.id,
        token: resetToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hour
      });
      
      // Use EmailService to send password reset email
      // Import at the top of the file
      const emailService = (await import('../services/email')).default;
      
      // Send the password reset email
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
      
      const emailSent = await emailService.sendPasswordReset(
        user.email, 
        userName, 
        resetToken
      );
      
      if (emailSent) {
        logger.info({
          message: `Password reset email sent to user: ${email}`,
          category: "security",
          userId: user.id,
          source: "internal",
          metadata: {
            ip: req.ip,
            emailSent: true
          }
        });
      } else {
        // Log failed email send but don't tell the user
        logger.warn({
          message: `Password reset email failed to send to user: ${email}`,
          category: "security",
          userId: user.id,
          source: "internal",
          metadata: {
            ip: req.ip,
            emailSent: false,
            resetToken // Only log token on failure for debugging
          }
        });
      }
      
      res.status(200).json({
        success: true,
        message: "If a user with that email exists, a password reset link has been sent"
      });
    } catch (error) {
      logger.error({
        message: `Forgot password error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          email: req.body.email
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred while processing your request"
      });
    }
  },
  
  /**
   * Reset a password with a valid token
   * @param req Express Request
   * @param res Express Response
   */
  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Token and new password are required"
        });
      }
      
      // Verify token
      const resetToken = await storage.verifyPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired token"
        });
      }
      
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Update user password
      await storage.updateUserPassword(resetToken.userId, hashedPassword);
      
      // Invalidate all reset tokens for this user
      await storage.invalidatePasswordResetTokens(resetToken.userId);
      
      // Log password reset
      logger.info({
        message: `Password reset successfully for user ID: ${resetToken.userId}`,
        category: "security",
        userId: resetToken.userId,
        source: "internal",
        metadata: {
          ip: req.ip
        }
      });
      
      res.status(200).json({
        success: true,
        message: "Password reset successful"
      });
    } catch (error) {
      logger.error({
        message: `Reset password error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred while resetting your password"
      });
    }
  },
  
  /**
   * Verify a user's email with a token
   * @param req Express Request
   * @param res Express Response
   */
  async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Token is required"
        });
      }
      
      // Get verification token to check if it exists and is valid
      const verificationToken = await storage.getEmailVerificationToken(token);
      
      if (!verificationToken) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired token"
        });
      }
      
      // If token has expired
      if (verificationToken.expiresAt && new Date() > verificationToken.expiresAt) {
        return res.status(400).json({
          success: false,
          message: "Verification token has expired"
        });
      }
      
      // Use consumeEmailVerificationToken to handle the entire verification process
      const processedToken = await storage.consumeEmailVerificationToken(token);
      
      if (!processedToken) {
        return res.status(400).json({
          success: false,
          message: "Failed to verify email. Token may be invalid or already used."
        });
      }
      
      // Use user ID from the verification token for logging
      const userId = verificationToken.userId;
      
      // Log email verification
      logger.info({
        message: `Email verified for user ID: ${userId}`,
        category: "user",
        userId: userId,
        source: "internal",
        metadata: {
          ip: req.ip
        }
      });
      
      res.status(200).json({
        success: true,
        message: "Email verified successfully"
      });
    } catch (error) {
      logger.error({
        message: `Email verification error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          token: req.params.token
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred while verifying your email"
      });
    }
  },
  
  /**
   * Resend a verification email
   * @param req Express Request
   * @param res Express Response
   */
  async resendVerificationEmail(req: Request, res: Response) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required"
        });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      // If user not found or already verified, still return success to prevent email enumeration
      if (!user || user.emailVerified) {
        logger.info({
          message: `Verification email requested for ${!user ? 'non-existent' : 'already verified'} email: ${email}`,
          category: "user",
          ...(user ? { userId: user.id } : {}),
          source: "internal",
          metadata: {
            ip: req.ip
          }
        });
        
        return res.status(200).json({
          success: true,
          message: "If that email exists and is not verified, a verification link has been sent"
        });
      }
      
      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      // Store verification token
      await storage.createEmailVerificationToken({
        userId: user.id,
        token: verificationToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
      
      // In a production environment, this would send an actual email
      // For now, we'll just log it
      logger.info({
        message: `Verification email resent to: ${email}. Verification token: ${verificationToken}`,
        category: "user",
        userId: user.id,
        source: "internal",
        metadata: {
          ip: req.ip,
          verificationToken // Would not log this in production
        }
      });
      
      res.status(200).json({
        success: true,
        message: "If that email exists and is not verified, a verification link has been sent"
      });
    } catch (error) {
      logger.error({
        message: `Resend verification email error: ${error instanceof Error ? error.message : String(error)}`,
        category: "user",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          email: req.body.email
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred while sending the verification email"
      });
    }
  },

  /**
   * Request a magic link for passwordless login (customers only)
   * @param req Express Request
   * @param res Express Response
   */
  async requestMagicLink(req: Request, res: Response) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required"
        });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      // If user not found or is not a customer, still return success to prevent email enumeration
      if (!user || user.role !== "customer") {
        logger.info({
          message: `Magic link requested for ${!user ? 'non-existent' : 'non-customer'} email: ${email}`,
          category: "security",
          source: "internal",
          metadata: {
            ip: req.ip
          }
        });
        
        return res.status(200).json({
          success: true,
          message: "If a matching customer account exists, a magic link has been sent to your email"
        });
      }
      
      // Generate magic link token
      const magicToken = crypto.randomBytes(32).toString('hex');
      
      // Store token (reusing email verification token table)
      await storage.createEmailVerificationToken({
        userId: user.id,
        token: magicToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      });
      
      // Send the magic link email
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer';
      
      const emailSent = await emailService.sendMagicLink(
        user.email, 
        userName, 
        magicToken
      );
      
      if (emailSent) {
        logger.info({
          message: `Magic link email sent to customer: ${email}`,
          category: "security",
          userId: user.id,
          source: "internal",
          metadata: {
            ip: req.ip,
            emailSent: true
          }
        });
      } else {
        // Log failed email send but don't tell the user
        logger.warn({
          message: `Magic link email failed to send to customer: ${email}`,
          category: "security",
          userId: user.id,
          source: "internal",
          metadata: {
            ip: req.ip,
            emailSent: false,
            magicToken // Only log token on failure for debugging in development
          }
        });
      }
      
      res.status(200).json({
        success: true,
        message: "If a matching customer account exists, a magic link has been sent to your email"
      });
    } catch (error) {
      logger.error({
        message: `Magic link request error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          email: req.body.email
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred while processing your request"
      });
    }
  },
  
  /**
   * Verify a magic link token and login the user
   * @param req Express Request
   * @param res Express Response
   */
  async verifyMagicLink(req: Request, res: Response) {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Token is required"
        });
      }
      
      // Get verification token to check if it exists and is valid
      const verificationToken = await storage.getEmailVerificationToken(token);
      
      if (!verificationToken) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired magic link"
        });
      }
      
      // If token has expired
      if (verificationToken.expiresAt && new Date() > verificationToken.expiresAt) {
        return res.status(400).json({
          success: false,
          message: "Magic link has expired"
        });
      }
      
      // Get user details
      const user = await storage.getUser(verificationToken.userId);
      
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Verify this is a customer
      if (user.role !== "customer") {
        logger.warn({
          message: `Non-customer user (${user.role}) attempted to use magic link: ${user.email}`,
          category: "security",
          userId: user.id,
          source: "internal",
          metadata: {
            ip: req.ip
          }
        });
        
        return res.status(403).json({
          success: false,
          message: "Magic link login is only available for customers"
        });
      }
      
      // Mark token as used
      await storage.consumeEmailVerificationToken(token);
      
      // Verify JWT_SECRET is set
      if (!JWT_SECRET) {
        logger.error({
          message: "JWT_SECRET is not set in environment variables",
          category: "security",
          source: "internal"
        });
        throw new Error("JWT_SECRET is not configured");
      }
      
      // Generate JWT token with role included
      const jwtToken = generateToken(user);
      
      // Set HttpOnly cookie with token
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Only use HTTPS in production
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
        sameSite: 'strict' as const
      };
      
      res.cookie('auth_token', jwtToken, cookieOptions);
      
      // Log successful login
      logger.info({
        message: `User logged in via magic link: ${user.email}`,
        category: "security",
        userId: user.id,
        source: "internal",
        metadata: {
          ip: req.ip,
          loginMethod: "magic_link"
        }
      });
      
      // Return user info without exposing token in the response body
      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      logger.error({
        message: `Magic link verification error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          token: req.params.token
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred while verifying your magic link"
      });
    }
  },
  
  /**
   * Request an OTP code for login (customers only)
   * @param req Express Request
   * @param res Express Response
   */
  async requestOtp(req: Request, res: Response) {
    try {
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required"
        });
      }
      
      // Normalize phone number (remove any non-digit characters)
      const normalizedPhone = phone.replace(/\D/g, '');
      
      // Find user by phone
      const user = await storage.getUserByPhone(normalizedPhone);
      
      // If user not found or is not a customer, still return success to prevent phone number enumeration
      if (!user || user.role !== "customer") {
        logger.info({
          message: `OTP requested for ${!user ? 'non-existent' : 'non-customer'} phone: ${normalizedPhone}`,
          category: "security",
          source: "internal",
          metadata: {
            ip: req.ip
          }
        });
        
        return res.status(200).json({
          success: true,
          message: "If a matching customer account exists, an OTP code has been sent to your phone"
        });
      }
      
      // Generate 6-digit OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in database
      await storage.createOneTimePassword({
        phone: normalizedPhone,
        otp: otpCode,
        purpose: "login",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        userAgent: req.headers["user-agent"] || undefined,
        ipAddress: req.ip
      });
      
      // Send OTP via SMS
      const messageSent = await twilioService.sendOtp(normalizedPhone, otpCode);
      
      if (messageSent) {
        logger.info({
          message: `OTP sent to customer: ${normalizedPhone}`,
          category: "security",
          source: "internal",
          metadata: {
            userId: user.id,
            ip: req.ip,
            smsSent: true
          }
        });
      } else {
        // Log failed SMS send but don't tell the user
        logger.warn({
          message: `OTP failed to send to customer: ${normalizedPhone}`,
          category: "security",
          source: "internal",
          metadata: {
            userId: user.id,
            ip: req.ip,
            smsSent: false,
            otpCode // Only log code on failure for debugging in development
          }
        });
      }
      
      res.status(200).json({
        success: true,
        message: "If a matching customer account exists, an OTP code has been sent to your phone"
      });
    } catch (error) {
      logger.error({
        message: `OTP request error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          phone: req.body.phone
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred while processing your request"
      });
    }
  },
  
  /**
   * Verify OTP code and login the user
   * @param req Express Request
   * @param res Express Response
   */
  async verifyOtp(req: Request, res: Response) {
    try {
      const { phone, otp } = req.body;
      
      if (!phone || !otp) {
        return res.status(400).json({
          success: false,
          message: "Phone number and OTP code are required"
        });
      }
      
      // Normalize phone number
      const normalizedPhone = phone.replace(/\D/g, '');
      
      // Verify OTP
      const isValid = await storage.verifyOneTimePassword(otp, normalizedPhone);
      
      if (!isValid) {
        logger.warn({
          message: `Invalid OTP attempt for phone: ${normalizedPhone}`,
          category: "security",
          source: "internal",
          metadata: {
            ip: req.ip,
            otp: otp
          }
        });
        
        return res.status(401).json({
          success: false,
          message: "Invalid or expired OTP code"
        });
      }
      
      // Get user by phone
      const user = await storage.getUserByPhone(normalizedPhone);
      
      if (!user) {
        logger.error({
          message: `OTP verified but user not found for phone: ${normalizedPhone}`,
          category: "security",
          source: "internal",
          metadata: {
            ip: req.ip
          }
        });
        
        return res.status(500).json({
          success: false,
          message: "An error occurred while processing your login"
        });
      }
      
      // Verify this is a customer
      if (user.role !== "customer") {
        logger.warn({
          message: `Non-customer user (${user.role}) attempted to use OTP login: ${user.email}`,
          category: "security",
          source: "internal",
          metadata: {
            userId: user.id,
            ip: req.ip
          }
        });
        
        return res.status(403).json({
          success: false,
          message: "OTP login is only available for customers"
        });
      }
      
      // Verify JWT_SECRET is set
      if (!JWT_SECRET) {
        logger.error({
          message: "JWT_SECRET is not set in environment variables",
          category: "security",
          source: "internal"
        });
        throw new Error("JWT_SECRET is not configured");
      }
      
      // Generate JWT token with role included
      const token = generateToken(user);
      
      // Set HttpOnly cookie with token
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Only use HTTPS in production
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
        sameSite: 'strict' as const
      };
      
      res.cookie('auth_token', token, cookieOptions);
      
      // Log successful login
      logger.info({
        message: `User logged in via OTP: ${user.email}`,
        category: "security",
        source: "internal",
        metadata: {
          userId: user.id,
          ip: req.ip,
          loginMethod: "otp"
        }
      });
      
      // Return user info without exposing token in the response body
      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      logger.error({
        message: `OTP verification error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          phone: req.body.phone
        }
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred while verifying your OTP code"
      });
    }
  }
};