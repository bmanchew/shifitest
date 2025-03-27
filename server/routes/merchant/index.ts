import { Router } from "express";
import { authenticateToken } from "../../middleware/auth";
import fundingRouter from "./funding";

const router = Router();

// Apply authentication to all merchant routes
router.use(authenticateToken);

// Mount the funding routes for merchant API
router.use("/funding", fundingRouter);

// Mount the funding routes for merchant API (alternate path)
router.use("/merchant/funding", fundingRouter);

export default router;