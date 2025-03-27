import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sesameAIService } from '../services/sesameai';
import { logger } from '../services/logger';

const router = Router();

/**
 * Schema for voice generation request
 */
const generateVoiceSchema = z.object({
  text: z.string().min(1, "Text is required").max(1000, "Text is too long"),
  speaker: z.number().int().min(0).max(1).optional(),
  outputPath: z.string().optional()
});

/**
 * Schema for notification voice generation request
 */
const generateNotificationVoiceSchema = z.object({
  type: z.string().min(1, "Notification type is required"),
  data: z.record(z.any()),
  speaker: z.number().int().min(0).max(1).optional()
});

/**
 * Register SesameAI routes for text-to-speech capabilities
 * @param apiRouter - Express Router to attach routes to
 */
export default function registerSesameAIRoutes(apiRouter: Router) {
  // Mount the SesameAI router under /api/sesameai
  apiRouter.use('/sesameai', router);

  /**
   * Check if SesameAI service is available
   */
  router.get('/status', (req: Request, res: Response) => {
    try {
      const isReady = sesameAIService.isReady();
      res.json({
        status: isReady ? 'ready' : 'not_ready',
        message: isReady ? 'SesameAI service is available' : 'SesameAI service is not initialized'
      });
    } catch (error: any) {
      logger.error({
        message: `Error checking SesameAI service status: ${error.message}`,
        source: 'sesameai',
        category: 'api',
        metadata: { error: error.stack }
      });
      
      res.status(500).json({
        status: 'error',
        message: 'Error checking SesameAI service status'
      });
    }
  });

  /**
   * Generate voice from text
   */
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const validationResult = generateVoiceSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid request parameters',
          errors: validationResult.error.errors
        });
      }
      
      const { text, speaker, outputPath } = validationResult.data;
      
      logger.info({
        message: 'Received voice generation request',
        source: 'sesameai',
        category: 'api',
        metadata: { textLength: text.length, speaker }
      });
      
      const audioPath = await sesameAIService.generateVoice({
        text,
        speaker,
        outputPath
      });
      
      res.json({
        status: 'success',
        path: audioPath
      });
    } catch (error: any) {
      logger.error({
        message: `Error generating voice: ${error.message}`,
        source: 'sesameai',
        category: 'api',
        metadata: { error: error.stack }
      });
      
      res.status(500).json({
        status: 'error',
        message: `Error generating voice: ${error.message}`
      });
    }
  });

  /**
   * Generate voice for notifications
   */
  router.post('/notification', async (req: Request, res: Response) => {
    try {
      const validationResult = generateNotificationVoiceSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid request parameters',
          errors: validationResult.error.errors
        });
      }
      
      const { type, data, speaker } = validationResult.data;
      
      logger.info({
        message: `Received notification voice generation request for type: ${type}`,
        source: 'sesameai',
        category: 'api',
        metadata: { notificationType: type, speaker }
      });
      
      const audioPath = await sesameAIService.generateNotificationVoice({
        type,
        data,
        speaker
      });
      
      res.json({
        status: 'success',
        path: audioPath
      });
    } catch (error: any) {
      logger.error({
        message: `Error generating notification voice: ${error.message}`,
        source: 'sesameai',
        category: 'api',
        metadata: { error: error.stack }
      });
      
      res.status(500).json({
        status: 'error',
        message: `Error generating notification voice: ${error.message}`
      });
    }
  });

  /**
   * List all generated audio files
   */
  router.get('/audio-files', async (req: Request, res: Response) => {
    try {
      const audioFiles = await sesameAIService.listAudioFiles();
      
      res.json({
        status: 'success',
        files: audioFiles
      });
    } catch (error: any) {
      logger.error({
        message: `Error listing audio files: ${error.message}`,
        source: 'sesameai',
        category: 'api',
        metadata: { error: error.stack }
      });
      
      res.status(500).json({
        status: 'error',
        message: `Error listing audio files: ${error.message}`
      });
    }
  });
}