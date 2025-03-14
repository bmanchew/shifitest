
import { Router } from 'express';
import { preFiService } from '../services/prefi';

const healthRouter = Router();

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
