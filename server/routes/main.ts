import { Router, Request, Response } from "express";
import authRouter from "./auth";
import usersRouter from "./users";
import adminRouter from "./admin";
import { reportsRouter } from "./admin/reports";
import { adminReportsRouter } from "./adminReports";
import contractsRouter from "./contracts";
import customersRouter from "./customers";
import underwritingRouter from "./underwriting";
import merchantRouter from "./merchant";
import merchantDashboardRouter from "./merchant-dashboard";
import merchantFundingRouter from "./merchant-funding";
import notificationRouter from "./notification";
import paymentRouter from "./payments";
import healthRouter from "./health";
import blockchainRouter from "./blockchain";
import salesRepRouter from "./salesRep";
import communicationsRouter from "./communications";
import indexRoutes from "./index";

// Create an aggregator router that will combine all feature routers
const mainRouter = Router();

// Health check endpoint for the API
mainRouter.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    message: "ShiFi API is running"
  });
});

// Mount feature routers with appropriate prefixes
mainRouter.use("/auth", authRouter);
mainRouter.use("/users", usersRouter);

// Admin routes with specific prefixes to avoid conflicts
mainRouter.use("/admin/reports", reportsRouter);      // Keeps report-specific routes
mainRouter.use("/admin/analysis", adminReportsRouter); // Renames to avoid conflict
mainRouter.use("/admin", adminRouter);                // Main admin router

// Mount domain-specific routers
mainRouter.use("/underwriting", underwritingRouter);
mainRouter.use("/contracts", contractsRouter);
mainRouter.use("/customers", customersRouter);
mainRouter.use("/merchants", merchantRouter);
mainRouter.use("/merchant-dashboard", merchantDashboardRouter);
mainRouter.use("/merchant-funding", merchantFundingRouter);
mainRouter.use("/notifications", notificationRouter);
mainRouter.use("/payments", paymentRouter);
mainRouter.use("/health", healthRouter);
mainRouter.use("/blockchain", blockchainRouter);
mainRouter.use("/sales-reps", salesRepRouter);

// Communication routes with aliases for different interfaces
mainRouter.use("/communications", communicationsRouter);
mainRouter.use("/conversations", communicationsRouter);
mainRouter.use("/support-tickets", communicationsRouter);

// Catch-all for index routes (should be mounted last)
mainRouter.use(indexRoutes);

// 404 handler
mainRouter.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`
  });
});

export default mainRouter;