import { Router } from "express";
import { authenticateToken, isMerchant } from "../../middleware/auth";
import fundingRouter from "./funding";

const router = Router();

// Apply authentication to all merchant funding routes
router.use(authenticateToken);

// Apply merchant role check to all routes
router.use(isMerchant);

// Mount the funding routes for merchant API
router.use("/funding", fundingRouter);

export default router;