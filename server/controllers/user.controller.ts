import { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";
import bcrypt from "bcrypt";

/**
 * User controller with methods for managing users
 */
export const userController = {
  /**
   * Get all users (admin only)
   * @param req Express Request
   * @param res Express Response
   */
  async getAllUsers(req: Request, res: Response) {
    try {
      const users = await storage.getAllUsers();
      
      // Map users to remove sensitive information
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt
      }));
      
      res.status(200).json({
        success: true,
        users: sanitizedUsers
      });
    } catch (error) {
      logger.error({
        message: `Error getting all users: ${error instanceof Error ? error.message : String(error)}`,
        category: "user",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting users"
      });
    }
  },
  
  /**
   * Get user by ID (admin only)
   * @param req Express Request
   * @param res Express Response
   */
  async getUserById(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required"
        });
      }
      
      const user = await storage.getUser(parseInt(userId));
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Remove sensitive information
      const sanitizedUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt
      };
      
      res.status(200).json({
        success: true,
        user: sanitizedUser
      });
    } catch (error) {
      logger.error({
        message: `Error getting user by ID: ${error instanceof Error ? error.message : String(error)}`,
        category: "user",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId: req.params.userId
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting user"
      });
    }
  },
  
  /**
   * Update user (admin only)
   * @param req Express Request
   * @param res Express Response
   */
  async updateUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { email, firstName, lastName, role, phone } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required"
        });
      }
      
      // Check if user exists
      const user = await storage.getUser(parseInt(userId));
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Update user
      const updatedUser = await storage.updateUser(parseInt(userId), {
        email: email || user.email,
        firstName: firstName !== undefined ? firstName : user.firstName,
        lastName: lastName !== undefined ? lastName : user.lastName,
        role: role || user.role,
        phone: phone !== undefined ? phone : user.phone
      });
      
      // Log the update
      logger.info({
        message: `User updated: ${updatedUser.email}`,
        category: "user",
        userId: updatedUser.id,
        source: "internal",
        metadata: {
          updatedBy: req.user?.id
        }
      });
      
      // Remove sensitive information
      const sanitizedUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        phone: updatedUser.phone,
        createdAt: updatedUser.createdAt
      };
      
      res.status(200).json({
        success: true,
        message: "User updated successfully",
        user: sanitizedUser
      });
    } catch (error) {
      logger.error({
        message: `Error updating user: ${error instanceof Error ? error.message : String(error)}`,
        category: "user",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId: req.params.userId
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error updating user"
      });
    }
  },
  
  /**
   * Delete user (admin only)
   * @param req Express Request
   * @param res Express Response
   */
  async deleteUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required"
        });
      }
      
      // Check if user exists
      const user = await storage.getUser(parseInt(userId));
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Store email for logging
      const userEmail = user.email;
      
      // Prevent deleting self
      if (req.user && req.user.id === parseInt(userId)) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete your own account"
        });
      }
      
      // Delete user
      await storage.deleteUser(parseInt(userId));
      
      // Log the deletion
      logger.info({
        message: `User deleted: ${userEmail}`,
        category: "user",
        source: "internal",
        metadata: {
          deletedBy: req.user?.id,
          deletedUserEmail: userEmail
        }
      });
      
      res.status(200).json({
        success: true,
        message: "User deleted successfully"
      });
    } catch (error) {
      logger.error({
        message: `Error deleting user: ${error instanceof Error ? error.message : String(error)}`,
        category: "user",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId: req.params.userId
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error deleting user"
      });
    }
  },
  
  /**
   * Get public profile of a user
   * @param req Express Request
   * @param res Express Response
   */
  async getPublicProfile(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required"
        });
      }
      
      const user = await storage.getUser(parseInt(userId));
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Return only public information
      const publicProfile = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      };
      
      res.status(200).json({
        success: true,
        profile: publicProfile
      });
    } catch (error) {
      logger.error({
        message: `Error getting public profile: ${error instanceof Error ? error.message : String(error)}`,
        category: "user",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId: req.params.userId
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting user profile"
      });
    }
  },
  
  /**
   * Get profile of the authenticated user
   * @param req Express Request
   * @param res Express Response
   */
  async getProfile(req: Request, res: Response) {
    try {
      // User is already attached to request by auth middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      }
      
      // Remove sensitive information
      const profile = {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        phone: req.user.phone
      };
      
      res.status(200).json({
        success: true,
        profile
      });
    } catch (error) {
      logger.error({
        message: `Error getting profile: ${error instanceof Error ? error.message : String(error)}`,
        category: "user",
        userId: req.user?.id,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting profile"
      });
    }
  },
  
  /**
   * Update profile of the authenticated user
   * @param req Express Request
   * @param res Express Response
   */
  async updateProfile(req: Request, res: Response) {
    try {
      // User is already attached to request by auth middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      }
      
      const { firstName, lastName, phone } = req.body;
      
      // Update user
      const updatedUser = await storage.updateUser(req.user.id, {
        firstName: firstName !== undefined ? firstName : req.user.firstName,
        lastName: lastName !== undefined ? lastName : req.user.lastName,
        phone: phone !== undefined ? phone : req.user.phone
      });
      
      // Log the update
      logger.info({
        message: `Profile updated for user: ${updatedUser.email}`,
        category: "user",
        userId: updatedUser.id,
        source: "internal"
      });
      
      // Remove sensitive information
      const profile = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        phone: updatedUser.phone
      };
      
      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        profile
      });
    } catch (error) {
      logger.error({
        message: `Error updating profile: ${error instanceof Error ? error.message : String(error)}`,
        category: "user",
        userId: req.user?.id,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error updating profile"
      });
    }
  },
  
  /**
   * Change password of the authenticated user
   * @param req Express Request
   * @param res Express Response
   */
  async changePassword(req: Request, res: Response) {
    try {
      // User is already attached to request by auth middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password and new password are required"
        });
      }
      
      // Get user with password
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      
      if (!isMatch) {
        // Log failed password change attempt
        logger.warn({
          message: `Failed password change attempt for ${user.email} - incorrect current password`,
          category: "security",
          userId: user.id,
          source: "internal",
          metadata: {
            ip: req.ip,
            userAgent: req.headers["user-agent"]
          }
        });
        
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect"
        });
      }
      
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Update password
      await storage.updateUserPassword(user.id, hashedPassword);
      
      // Log password change
      logger.info({
        message: `Password changed for user: ${user.email}`,
        category: "security",
        userId: user.id,
        source: "internal",
        metadata: {
          ip: req.ip
        }
      });
      
      res.status(200).json({
        success: true,
        message: "Password changed successfully"
      });
    } catch (error) {
      logger.error({
        message: `Error changing password: ${error instanceof Error ? error.message : String(error)}`,
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
        message: "Error changing password"
      });
    }
  },
  
  /**
   * Update user preferences
   * @param req Express Request
   * @param res Express Response
   */
  async updatePreferences(req: Request, res: Response) {
    try {
      // User is already attached to request by auth middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      }
      
      const { preferences } = req.body;
      
      if (!preferences) {
        return res.status(400).json({
          success: false,
          message: "Preferences are required"
        });
      }
      
      // Update preferences
      await storage.updateUserPreferences(req.user.id, preferences);
      
      // Log preferences update
      logger.info({
        message: `Preferences updated for user: ${req.user.email}`,
        category: "user",
        userId: req.user.id,
        source: "internal"
      });
      
      res.status(200).json({
        success: true,
        message: "Preferences updated successfully"
      });
    } catch (error) {
      logger.error({
        message: `Error updating preferences: ${error instanceof Error ? error.message : String(error)}`,
        category: "user",
        userId: req.user?.id,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error updating preferences"
      });
    }
  },
  
  /**
   * Get notifications for the authenticated user
   * @param req Express Request
   * @param res Express Response
   */
  async getNotifications(req: Request, res: Response) {
    try {
      // User is already attached to request by auth middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      }
      
      // Get notifications
      const notifications = await storage.getUserNotifications(req.user.id);
      
      res.status(200).json({
        success: true,
        notifications
      });
    } catch (error) {
      logger.error({
        message: `Error getting notifications: ${error instanceof Error ? error.message : String(error)}`,
        category: "notification",
        userId: req.user?.id,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error getting notifications"
      });
    }
  },
  
  /**
   * Mark a notification as read
   * @param req Express Request
   * @param res Express Response
   */
  async markNotificationRead(req: Request, res: Response) {
    try {
      // User is already attached to request by auth middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      }
      
      const { notificationId } = req.params;
      
      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: "Notification ID is required"
        });
      }
      
      // Mark notification as read
      await storage.markNotificationRead(parseInt(notificationId), req.user.id);
      
      res.status(200).json({
        success: true,
        message: "Notification marked as read"
      });
    } catch (error) {
      logger.error({
        message: `Error marking notification as read: ${error instanceof Error ? error.message : String(error)}`,
        category: "notification",
        userId: req.user?.id,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          notificationId: req.params.notificationId
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error marking notification as read"
      });
    }
  },
  
  /**
   * Create a new user (admin only)
   * @param req Express Request
   * @param res Express Response
   */
  async createUser(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName, role, phone } = req.body;
      
      // Validate required fields
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
      
      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        phone,
        createdAt: new Date()
      });
      
      // Log user creation
      logger.info({
        message: `User created by admin: ${email}`,
        category: "user",
        userId: user.id,
        source: "internal",
        metadata: {
          createdBy: req.user?.id,
          userRole: role
        }
      });
      
      // Remove sensitive information
      const sanitizedUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt
      };
      
      res.status(201).json({
        success: true,
        message: "User created successfully",
        user: sanitizedUser
      });
    } catch (error) {
      logger.error({
        message: `Error creating user: ${error instanceof Error ? error.message : String(error)}`,
        category: "user",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          createdBy: req.user?.id
        }
      });
      
      res.status(500).json({
        success: false,
        message: "Error creating user"
      });
    }
  }
};