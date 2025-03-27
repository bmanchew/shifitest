import { Router, Request, Response } from "express";
import { db } from "../../db";
import { plaidTransfers } from "../../../shared/schema";
import { eq, desc } from "drizzle-orm";
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
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    // Get merchant record from request - this is set by the isMerchant middleware
    const merchant = req.merchant;
    
    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant record not found" });
    }
    
    // Use the merchant ID from the merchant record
    const merchantId = merchant.id;
    
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
      success: true,
      transfers: formattedTransfers 
    });
    
  } catch (error) {
    console.error("Error fetching merchant funding data:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch merchant funding data" 
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
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    const merchant = req.merchant;
    
    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant record not found" });
    }
    
    // Get the specific transfer
    const transfer = await db.select()
      .from(plaidTransfers)
      .where(eq(plaidTransfers.transferId, transferId))
      .limit(1);
    
    if (transfer.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Transfer not found" 
      });
    }
    
    // Security check - make sure the transfer belongs to this merchant
    if (transfer[0].merchantId !== merchant.id) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have permission to view this transfer" 
      });
    }
    
    // Format date for client-side consumption
    const formattedTransfer = {
      ...transfer[0],
      createdAt: transfer[0].createdAt ? format(new Date(transfer[0].createdAt), 'yyyy-MM-dd\'T\'HH:mm:ss') : ''
    };
    
    return res.status(200).json({ 
      success: true, 
      transfer: formattedTransfer 
    });
    
  } catch (error) {
    console.error("Error fetching specific transfer:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch transfer details" 
    });
  }
});

export default router;