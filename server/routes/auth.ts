import { Router, Request, Response } from "express";
import { storage } from "../storage";
import jwt from "jsonwebtoken";
import { logger } from "../services/logger";
import { authRateLimiter } from "../middleware/authRateLimiter";

const authRouter = Router();

// Login endpoint
authRouter.post("/login", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
    }
    
    const user = await storage.getUserByEmail(email);

    if (!user || user.password !== password) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    // Generate a JWT token for auth
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'default_jwt_secret',
      { expiresIn: '7d' }
    );
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    // Add token to user object
    const userWithToken = {
      ...userWithoutPassword,
      token
    };

    // Set cookies for authentication
    res.cookie('userId', user.id.toString(), { 
      httpOnly: true,
      sameSite: 'lax',
      path: '/'
    });
    
    res.cookie('userRole', user.role, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/'
    });

    // Create log for user login
    await storage.createLog({
      level: "info",
      message: `User logged in: ${user.email}`,
      userId: user.id,
      metadata: JSON.stringify({
        ip: req.ip,
        userAgent: req.get("user-agent"),
      }),
    });

    res.json({ 
      success: true, 
      user: userWithToken 
    });
  } catch (error) {
    logger.error({
      message: `Login error: ${error instanceof Error ? error.message : String(error)}`,
      category: "security",
      source: "internal",
      metadata: {
        errorStack: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

// Logout endpoint
authRouter.post("/logout", async (req: Request, res: Response) => {
  try {
    // Clear authentication cookies
    res.clearCookie('userId', { 
      httpOnly: true,
      sameSite: 'lax',
      path: '/'
    });
    
    res.clearCookie('userRole', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/'
    });
    
    // Create log for user logout if we have user info
    if (req.user?.id) {
      await storage.createLog({
        level: "info",
        message: `User logged out`,
        userId: req.user.id,
        metadata: JSON.stringify({
          ip: req.ip,
          userAgent: req.get("user-agent"),
        }),
      });
    }
    
    res.json({ 
      success: true, 
      message: "Logged out successfully" 
    });
  } catch (error) {
    logger.error({
      message: `Logout error: ${error instanceof Error ? error.message : String(error)}`,
      category: "security",
      source: "internal",
      metadata: {
        errorStack: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({ 
      success: false, 
      message: "Error during logout" 
    });
  }
});

export default authRouter;