import { Router } from "express";
import { authenticateToken, isMerchant } from "../../middleware/auth";
import fundingRouter from "./funding";
import contractsRouter from "./contracts";

const router = Router();

// Apply authentication to all merchant routes
router.use(authenticateToken);

// Apply merchant role check to all routes
router.use(isMerchant);

// Mount the sub-routes for merchant API
router.use("/funding", fundingRouter);
router.use("/contracts", contractsRouter);

export default router;