import { Router, Request, Response } from "express";
import { db } from "../../db";
import { plaidTransfers, users } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { format } from "date-fns";

const router = Router();

/**
 * Get funding data for the authenticated merchant
 * 
 * Returns:
 * - Array of plaid transfers related to merchant funding
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    // Get the authenticated user's ID
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Get the user record
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Get all transfers for this merchant (using user ID as merchant ID for now)
    // Merchant ID and user ID are the same for merchant users
    const merchantId = userId;
    
    const transfers = await db.select()
      .from(plaidTransfers)
      .where(eq(plaidTransfers.merchantId, merchantId))
      .orderBy(desc(plaidTransfers.createdAt));
    
    // Format dates for client-side consumption
    const formattedTransfers = transfers.map(transfer => {
      return {
        ...transfer,
        createdAt: transfer.createdAt ? format(new Date(transfer.createdAt), 'yyyy-MM-dd\'T\'HH:mm:ss') : ''
      };
    });
    
    return res.status(200).json({ 
      transfers: formattedTransfers 
    });
    
  } catch (error) {
    console.error("Error fetching merchant funding data:", error);
    return res.status(500).json({ 
      error: "Failed to fetch merchant funding data" 
    });
  }
});

/**
 * Get a specific plaid transfer by ID
 */
router.get("/:transferId", async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Get the user record
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Get all transfers for this merchant (using user ID as merchant ID for now)
    // Merchant ID and user ID are the same for merchant users
    const merchantId = userId;
    
    // Get the specific transfer, ensuring it belongs to this merchant
    const transfer = await db.select()
      .from(plaidTransfers)
      .where(
        and(
          eq(plaidTransfers.transferId, transferId),
          eq(plaidTransfers.merchantId, merchantId)
        )
      )
      .limit(1);
    
    if (!transfer || transfer.length === 0) {
      return res.status(404).json({ error: "Transfer not found" });
    }
    
    // Format date
    const formattedTransfer = {
      ...transfer[0],
      createdAt: transfer[0].createdAt ? format(new Date(transfer[0].createdAt), 'yyyy-MM-dd\'T\'HH:mm:ss') : ''
    };
    
    return res.status(200).json({ transfer: formattedTransfer });
    
  } catch (error) {
    console.error("Error fetching transfer:", error);
    return res.status(500).json({ error: "Failed to fetch transfer" });
  }
});

export default router;