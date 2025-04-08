
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
import merchantReportsRouter from "./merchant-reports";
import dueDiligenceRouter from "./due-diligence";
import plaidUnderwritingRouter from "./plaid-underwriting";
import plaidRouter from "./plaid";
import cancelCoveredCareContractRouter from "./cancel-coveredcare-contract";
import merchantPlaidSettingsRouter from "./merchant-plaid-settings";

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
router.use("/merchant-reports", merchantReportsRouter);
router.use("/due-diligence", dueDiligenceRouter);
router.use("/plaid-underwriting", plaidUnderwritingRouter);
router.use("/plaid", plaidRouter);
router.use("/cancel-coveredcare-contract", cancelCoveredCareContractRouter);
// Import the Plaid Settings routes but mount them directly
import { getPlaidSettings, updatePlaidSettings } from "./merchant-plaid-settings";

// Use dedicated endpoints for merchant Plaid settings
router.get("/merchants/:merchantId/plaid-settings", getPlaidSettings);
router.patch("/merchants/:merchantId/plaid-settings", updatePlaidSettings);

// Merchant Performance routes
router.get("/merchant-performances", getAllMerchantPerformances);
router.get("/merchant-performance/:id", getMerchantPerformanceDetails);
router.post("/merchant-performance/:id/update", updateMerchantPerformance);
router.post("/update-all-merchant-performances", updateAllMerchantPerformances);

export default router;
