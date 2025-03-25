
import express from "express";
import { authenticateAdmin } from "../../middleware/auth";
import {
  getAllMerchantPerformances,
  getMerchantPerformanceDetails,
  updateMerchantPerformance,
  updateAllMerchantPerformances
} from "./merchant-performance";

const router = express.Router();

// Apply admin authentication middleware to all routes
router.use(authenticateAdmin);

// Existing routes...

// Merchant Performance routes
router.get("/merchant-performances", getAllMerchantPerformances);
router.get("/merchant-performance/:id", getMerchantPerformanceDetails);
router.post("/merchant-performance/:id/update", updateMerchantPerformance);
router.post("/update-all-merchant-performances", updateAllMerchantPerformances);

export default router;
