import express from "express";
import { authenticateMerchant } from "../../middleware/auth";
import { getMerchantAnalytics } from "./analytics";

const router = express.Router();

// Apply merchant authentication middleware to all routes
router.use(authenticateMerchant);

// Example route
router.get("/dashboard", (req, res) => {
  res.status(200).json({ message: "Merchant dashboard data" });
});

// Analytics routes
router.get("/:id/analytics", getMerchantAnalytics);

export default router;