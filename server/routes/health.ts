
import { Router } from 'express';
import { preFiService } from '../services/prefi';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const healthRouter = Router();

// Main health check endpoint
healthRouter.get('/', async (req, res) => {
  try {
    // Check database connection
    await db.execute(sql`SELECT 1`);
    
    return res.json({
      status: 'ok',
      message: 'API is healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

healthRouter.get('/prefi', async (req, res) => {
  try {
    if (!process.env.PREFI_API_KEY) {
      return res.status(500).json({
        status: 'error',
        message: 'PreFi API key not configured'
      });
    }
    
    // Attempt a basic API call
    await preFiService.getCreditReport(
      '123-45-6789',
      'Test',
      'User',
      '1990-01-01',
      {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345'
      }
    );
    
    return res.json({
      status: 'ok',
      message: 'PreFi API is responding'
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default healthRouter;
