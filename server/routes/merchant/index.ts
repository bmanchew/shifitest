import express from "express";
import analyticsRouter from "./analytics";

const router = express.Router();

// Mount analytics router at the root so it becomes /merchant/:merchantId/analytics
router.use("/", analyticsRouter);

export default router;