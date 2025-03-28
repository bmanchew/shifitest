import { Router, Request, Response } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { insertUserSchema } from "@shared/schema";
import { storage } from "../storage";
import { userCreationRateLimiter } from "../middleware/authRateLimiter";
import { logger } from "../services/logger";

const usersRouter = Router();

// Create user
usersRouter.post("/", userCreationRateLimiter, async (req: Request, res: Response) => {
  try {
    const userData = insertUserSchema.parse(req.body);

    // Check if user with email already exists
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "User with this email already exists" });
    }

    const newUser = await storage.createUser(userData);

    // Create log for user creation
    await storage.createLog({
      level: "info",
      message: `User created: ${newUser.email}`,
      metadata: JSON.stringify({ id: newUser.id, role: newUser.role }),
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedError = fromZodError(error);
      return res
        .status(400)
        .json({ message: "Validation error", errors: formattedError });
    }
    logger.error({
      message: `Create user error: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        errorStack: error instanceof Error ? error.stack : String(error)
      }
    });
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get user by ID
usersRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    logger.error({
      message: `Get user error: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        userId: req.params.id,
        errorStack: error instanceof Error ? error.stack : String(error)
      }
    });
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get user by phone number
usersRouter.get("/by-phone", async (req: Request, res: Response) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ 
        success: false,
        message: "Phone number is required" 
      });
    }

    // First try to find the user
    let user = await storage.getUserByPhone(phone as string);

    // If user doesn't exist, create a new one
    if (!user) {
      user = await storage.findOrCreateUserByPhone(phone as string);
    }

    // Remove password from response
    const { password, ...userData } = user;

    res.json({
      success: true,
      user: userData,
      message: "User found or created successfully"
    });
  } catch (error) {
    logger.error({
      message: `Get user by phone error: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        phone: req.query.phone,
        errorStack: error instanceof Error ? error.stack : String(error)
      }
    });
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
});

export default usersRouter;