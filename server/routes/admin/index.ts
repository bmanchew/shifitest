
import express from "express";
import { authenticateAdmin } from "../../middleware/auth";
import {
  getAllMerchantPerformances,
  getMerchantPerformanceDetails,
  updateMerchantPerformance,
  updateAllMerchantPerformances
} from "./merchant-performance";
import merchantsRouter from "./merchants";
import { logger } from "../../services/logger";
import contractCancellationsRouter from "./contract-cancellations";
import { reportsRouter } from "./reports-improved";
import merchantFundingRouter from "./merchant-funding";

const router = express.Router();

// Apply admin authentication middleware to all routes
router.use(authenticateAdmin);

// Attach any request logging middleware
router.use((req, res, next) => {
  logger.debug({
    message: `Admin API request: ${req.method} ${req.path}`,
    category: "api",
    userId: req.user?.id,
    source: "internal",
    metadata: {
      path: req.path,
      method: req.method,
      query: req.query
    }
  });
  next();
});

// Register sub-routes
router.use("/merchants", merchantsRouter);
router.use("/cancellation-requests", contractCancellationsRouter);
router.use("/reports", reportsRouter);
router.use("/merchant-funding", merchantFundingRouter);

// Merchant Performance routes
router.get("/merchant-performances", getAllMerchantPerformances);
router.get("/merchant-performance/:id", getMerchantPerformanceDetails);
router.post("/merchant-performance/:id/update", updateMerchantPerformance);
router.post("/update-all-merchant-performances", updateAllMerchantPerformances);

export default router;
