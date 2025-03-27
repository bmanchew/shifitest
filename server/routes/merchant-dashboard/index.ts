import { Router } from "express";
import { authenticateToken, isMerchant } from "../../middleware/auth";
import fundingRouter from "./funding";

const router = Router();

// Apply authentication to all dashboard routes
router.use(authenticateToken);

// Apply merchant role check to all dashboard routes
router.use(isMerchant);

// Mount the funding routes under /funding
router.use("/funding", fundingRouter);

export default router;