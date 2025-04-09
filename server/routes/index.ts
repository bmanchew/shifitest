import express, { Router, Express } from 'express';
import { createServer, Server } from 'http';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import plaidRoutes from './plaid.routes';
import notificationRoutes from './notification';
import communicationsRoutes from './communications';
import merchantFundingRoutes from './merchant-funding';
import customerRoutes from './customers';
import merchantRoutes from './merchant';
import merchantContractsRoutes from './merchant/contracts';
import programsRouter from './merchant/programs';
import exampleRoutes from './example.routes';
import investorRoutes from './investor';
import adminRoutes from './admin/index';
import contractsRoutes from './contracts.routes';
import supportTicketsRoutes from './support-tickets';
import currentMerchantRoutes from './current-merchant';
import applicationProgressRouter from './application-progress';
import documentsRouter from './documents';
import analyticsRoutes from './analytics';
import { ticketAssignmentRouter } from './ticket-assignment';
import ticketCategorizationRouter from './ticket-categorization';
import intercomRouter from './intercom';
import intercomChatRouter from './intercom-chat';
import debugRoutes from './debug';
import { apiRateLimiter, authRateLimiter, userCreationRateLimiter } from '../middleware/authRateLimiter';
import { logger } from '../services/logger';
import { authenticateToken } from '../middleware/auth';
import { testConnectivity } from './admin/connectivity-test';

// Create main router for modular routes
const modulesRouter = express.Router();

// Apply API rate limiting to all API routes
modulesRouter.use('/api', apiRateLimiter);

// Register all API routes with versioning
modulesRouter.use('/api/v1/auth', authRoutes);
modulesRouter.use('/api/v1/users', userRoutes);
modulesRouter.use('/api/v1/plaid', plaidRoutes);
modulesRouter.use('/api/v1/notifications', notificationRoutes);
modulesRouter.use('/api/v1/communications', communicationsRoutes);
modulesRouter.use('/api/v1/merchant-funding', merchantFundingRoutes);
modulesRouter.use('/api/v1/customers', customerRoutes);
modulesRouter.use('/api/v1/examples', exampleRoutes);
modulesRouter.use('/api/v1/investor', investorRoutes);
modulesRouter.use('/api/v1/merchants', merchantRoutes);
modulesRouter.use('/api/v1/admin', adminRoutes);
modulesRouter.use('/api/v1/contracts', contractsRoutes);
modulesRouter.use('/api/v1/support-tickets', supportTicketsRoutes);
modulesRouter.use('/api/v1/current-merchant', currentMerchantRoutes);
modulesRouter.use('/api/v1/application-progress', applicationProgressRouter);
modulesRouter.use('/api/v1/documents', documentsRouter);
modulesRouter.use('/api/v1/analytics', analyticsRoutes);
modulesRouter.use('/api/v1/ticket-assignment', ticketAssignmentRouter);
modulesRouter.use('/api/v1/intercom', intercomRouter);
modulesRouter.use('/api/v1/chat', intercomChatRouter);
modulesRouter.use('/api/v1', ticketCategorizationRouter);
// Mount programsRouter explicitly for v1 API
modulesRouter.use('/api/v1/merchant/programs', authenticateToken, programsRouter);

// Handle other merchant routes for v1 API
modulesRouter.use('/api/v1/merchant', authenticateToken, (req, res, next) => {
  next();
}, (req, res, next) => {
  if (req.path === '/contracts') {
    return merchantContractsRoutes(req, res, next);
  }
  next();
});

// Support for legacy (non-versioned) routes during transition
modulesRouter.use('/api/auth', authRoutes);
modulesRouter.use('/api/users', userRoutes);
modulesRouter.use('/api/plaid', plaidRoutes);
modulesRouter.use('/api/notifications', notificationRoutes);
modulesRouter.use('/api/communications', communicationsRoutes);
modulesRouter.use('/api/merchant-funding', merchantFundingRoutes);
modulesRouter.use('/api/customers', customerRoutes);
modulesRouter.use('/api/examples', exampleRoutes);
modulesRouter.use('/api/investor', investorRoutes);
modulesRouter.use('/api/merchants', merchantRoutes);
modulesRouter.use('/api/admin', adminRoutes);
modulesRouter.use('/api/contracts', contractsRoutes);
modulesRouter.use('/api/support-tickets', supportTicketsRoutes);
modulesRouter.use('/api/current-merchant', currentMerchantRoutes);
modulesRouter.use('/api/application-progress', applicationProgressRouter);
modulesRouter.use('/api/documents', documentsRouter);
modulesRouter.use('/api/analytics', analyticsRoutes);
modulesRouter.use('/api/ticket-assignment', ticketAssignmentRouter);
modulesRouter.use('/api/intercom', intercomRouter);
modulesRouter.use('/api/chat', intercomChatRouter);
modulesRouter.use('/api/debug', debugRoutes);
modulesRouter.use('/', ticketCategorizationRouter);

// Create a separate router instance for merchant signup (no authentication required)
// We're accessing the handler directly to avoid middleware
import multer from 'multer';
import { storage } from '../storage';
import { plaidService } from '../services/plaid';
import { logger } from '../services/logger';
import emailService from '../services/email';
import crypto from 'crypto';

// Mount merchant signup route without authentication and without CSRF protection
// This is a special case since users need to sign up before they have accounts
modulesRouter.post('/api/merchant/signup', multer({ storage: multer.memoryStorage() }).any(), async (req, res) => {
  try {
    const { 
      firstName, lastName, email, phone, companyName,
      legalBusinessName, ein, businessStructure,
      plaidPublicToken, plaidAccountId,
      primaryProgramName, primaryProgramDescription, primaryProgramDurationMonths,
      termsOfServiceUrl, privacyPolicyUrl
    } = req.body;

    // First verify revenue requirements using Plaid
    if (!plaidPublicToken || !plaidAccountId) {
      return res.status(400).json({
        success: false,
        message: "Bank account verification required for merchant onboarding"
      });
    }

    // Exchange public token for access token
    const { accessToken } = await plaidService.exchangePublicToken(plaidPublicToken);

    // Create asset report for 2 years of data
    const assetReport = await plaidService.createAssetReport(accessToken, 730); // 2 years

    // Analyze the asset report for revenue verification
    const analysis = await plaidService.analyzeAssetReportForUnderwriting(assetReport.assetReportToken);

    // Calculate average monthly revenue
    const monthlyRevenue = analysis?.income?.monthlyIncome || 0;
    const hasRequiredHistory = analysis?.employment?.employmentMonths >= 24;

    if (monthlyRevenue < 100000 || !hasRequiredHistory) {
      return res.status(400).json({
        success: false,
        message: "Merchant does not meet minimum revenue requirements of $100k/month for 2 years",
        monthlyRevenue,
        monthsHistory: analysis?.employment?.employmentMonths
      });
    }

    // Generate a temporary password for the merchant
    const temporaryPassword = crypto.randomBytes(6).toString('hex');

    // First create a user account with merchant role
    const newUser = await storage.createUser({
      email,
      password: temporaryPassword,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`, // For backward compatibility
      role: 'merchant',
      phone
    });

    // Create merchant record associated with the user
    const merchant = await storage.createMerchant({
      name: companyName,
      contactName: `${firstName} ${lastName}`,
      email,
      phone,
      userId: newUser.id, // Link merchant to user account
      terms_of_service_url: termsOfServiceUrl,
      privacy_policy_url: privacyPolicyUrl,
      default_program_name: primaryProgramName,
      default_program_duration: primaryProgramDurationMonths ? parseInt(primaryProgramDurationMonths) : undefined
    });

    // Send welcome email with credentials
    await emailService.sendMerchantWelcome(
      email,
      `${firstName} ${lastName}`,
      temporaryPassword
    );

    // Log email sent
    await logger.info({
      message: `Welcome email sent to merchant: ${email}`,
      category: 'system',
      source: 'internal',
      metadata: {
        emailInfo: JSON.stringify({
          merchantId: merchant.id,
          userId: newUser.id,
          template: 'merchant_welcome'
        })
      }
    });

    // Store business details
    await storage.createMerchantBusinessDetails({
      merchantId: merchant.id,
      legalName: legalBusinessName,
      ein,
      businessStructure
    });

    // Store bank connection from Plaid
    await storage.createPlaidConnection({
      merchantId: merchant.id,
      itemId: 'pending', // Will be updated after asset report is processed
      accessToken,
      accountId: plaidAccountId,
      status: 'active'
    });

    return res.status(201).json({
      success: true,
      merchantId: merchant.id,
      userId: newUser.id,
      message: "Merchant signup completed successfully. Check email for login credentials."
    });
  } catch (err) {
    logger.error({
      message: `Error in merchant signup: ${err instanceof Error ? err.message : String(err)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        error: err instanceof Error ? err.stack : String(err),
        requestBody: JSON.stringify(req.body)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Internal server error processing merchant signup"
    });
  }
});

// Mount programsRouter explicitly
modulesRouter.use('/api/merchant/programs', authenticateToken, programsRouter);

// Handle other merchant routes
modulesRouter.use('/api/merchant', authenticateToken, (req, res, next) => {
  next();
}, (req, res, next) => {
  if (req.path === '/contracts') {
    return merchantContractsRoutes(req, res, next);
  }
  next();
});

// Add a simple status endpoint for health checks
modulesRouter.get('/api/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is operational',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Public health check for external API services
modulesRouter.get('/api/connectivity-check/thanksroger', async (req, res) => {
  try {
    const thanksRogerBaseUrl = "https://api.thanksroger.com";
    const thanksRogerApiKey = process.env.THANKS_ROGER_API_KEY;
    
    // Basic connectivity check (without auth)
    const baseConnectivity = await testConnectivity(thanksRogerBaseUrl);
    
    // Test connectivity with auth if API key is available
    let authConnectivity = null;
    let authConnectivityHeadOnly = null;
    
    if (thanksRogerApiKey) {
      // Use a different approach for auth check with headers
      try {
        const response = await fetch(`${thanksRogerBaseUrl}/v1/templates`, {
          method: 'HEAD',
          headers: {
            'Authorization': `Bearer ${thanksRogerApiKey}`,
            'Accept': 'application/json'
          }
        });
        
        authConnectivityHeadOnly = {
          success: response.ok,
          message: `Auth connection with HEAD method: ${response.status} ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries([...response.headers.entries()])
          }
        };
      } catch (error) {
        authConnectivityHeadOnly = {
          success: false,
          message: `Auth connection failed with HEAD method: ${error instanceof Error ? error.message : String(error)}`,
          details: {
            error: error instanceof Error ? error.message : String(error)
          }
        };
      }
      
      // Also do the simpler connectivity test
      authConnectivity = await testConnectivity(`${thanksRogerBaseUrl}/v1/templates`);
    }
    
    return res.json({
      success: baseConnectivity.success,
      message: baseConnectivity.message,
      baseConnectivity,
      authConnectivity,
      authConnectivityHeadOnly, 
      apiKeyPresent: !!thanksRogerApiKey
    });
  } catch (error) {
    logger.error({
      message: `Error testing connectivity: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.message : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: `Error testing connectivity: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// Track API usage
modulesRouter.use('/api', (req, res, next) => {
  // Record the request start time
  const start = Date.now();
  
  // Once response is finished, log the request details
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.debug({
      message: `${req.method} ${req.path} ${res.statusCode} completed in ${duration}ms`,
      category: 'api',
      source: 'internal',
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip
      }
    });
  });
  
  next();
});

// Export router for standalone use
export default modulesRouter;

// Export function compatible with the original routes.ts for server startup
export async function registerRoutes(app: Express): Promise<Server> {
  // Apply our modular routes
  app.use(modulesRouter);
  
  // Create and return HTTP server
  return createServer(app);
}