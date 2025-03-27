import express from 'express';
import { plaidController } from '../controllers/plaid.controller';
import { isAuthenticated, isAdmin, isMerchant, isAdminOrMerchant } from '../middleware/auth';

const router = express.Router();

// Link token creation for connecting bank accounts
router.post("/create-link-token", isAuthenticated, plaidController.createLinkToken);

// Exchange public token for access token (post-connection)
router.post("/exchange-public-token", isAuthenticated, plaidController.exchangePublicToken);

// Get user's connected accounts
router.get("/accounts", isAuthenticated, plaidController.getAccounts);

// Get user's transactions
router.get("/transactions", isAuthenticated, plaidController.getTransactions);

// Webhook handler for Plaid events (no auth - Plaid calls this)
router.post("/webhook", plaidController.handleWebhook);

// Get all Plaid connections (admin only)
router.get("/connections", isAdmin, plaidController.getAllConnections);

// Get all active Plaid merchants (admin only)
router.get("/merchants", isAdmin, plaidController.getActivePlaidMerchants);

// Create an asset report for a contract (admin only)
router.post("/create-asset-report", isAdmin, plaidController.createAssetReport);

// Get an asset report (admin only)
router.get("/asset-report/:assetReportId", isAdmin, plaidController.getAssetReport);

// Refresh an asset report (admin only)
router.post("/refresh-asset-report/:assetReportId", isAdmin, plaidController.refreshAssetReport);

// Download an asset report PDF (admin only)
router.get("/asset-report-pdf/:assetReportId", isAdmin, plaidController.getAssetReportPdf);

export default router;