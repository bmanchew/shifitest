import { Router } from 'express';
import blockchainRouter from './blockchain';
import merchantRouter from './merchant';
import communicationsRouter from './communications';
// Import other routers here as they are created

const router = Router();

// Mount blockchain routes
router.use('/blockchain', blockchainRouter);

// Mount merchant routes
router.use('/merchants', merchantRouter);

// Mount communications routes
// Main communications endpoint
router.use('/communications', communicationsRouter);

// Legacy endpoints that now use the communications router
// This provides backward compatibility
router.use('/conversations', communicationsRouter);
router.use('/support-tickets', communicationsRouter);

// Export the router
export default router;