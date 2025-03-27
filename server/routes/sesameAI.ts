/**
 * SesameAI API routes
 *
 * These routes handle voice generation requests using the SesameAI Conversational Speech Model.
 */

import { Router } from 'express';
import { sesameAIService } from '../services';
import { logger } from '../services/logger';

// Initialize router
const router = Router();

/**
 * @route GET /api/sesameai/status
 * @description Check if the SesameAI service is ready
 * @access Private
 */
router.get('/status', async (req, res) => {
  try {
    const isReady = sesameAIService.isReady();
    
    logger.info({
      message: `SesameAI status check: ${isReady ? 'ready' : 'not ready'}`,
      category: 'api',
      source: 'sesameai',
    });
    
    return res.json({
      success: true,
      ready: isReady
    });
  } catch (error: any) {
    logger.error({
      message: `Error checking SesameAI status: ${error.message}`,
      category: 'api',
      source: 'sesameai',
      metadata: { error: error.stack }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to check SesameAI status'
    });
  }
});

/**
 * @route POST /api/sesameai/generate-voice
 * @description Generate voice from text
 * @access Private
 */
router.post('/generate-voice', async (req, res) => {
  try {
    const { text, speaker = 0 } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }
    
    logger.info({
      message: 'Generating voice from text',
      category: 'api',
      source: 'sesameai',
      metadata: { textLength: text.length, speaker }
    });
    
    const audioPath = await sesameAIService.generateVoice({
      text,
      speaker
    });
    
    return res.json({
      success: true,
      audioUrl: audioPath
    });
  } catch (error: any) {
    logger.error({
      message: `Error generating voice: ${error.message}`,
      category: 'api',
      source: 'sesameai',
      metadata: { error: error.stack }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate voice'
    });
  }
});

/**
 * @route POST /api/sesameai/notification-voice
 * @description Generate voice for notification
 * @access Private
 */
router.post('/notification-voice', async (req, res) => {
  try {
    const { type, data, speaker = 0 } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: 'Notification type and data are required'
      });
    }
    
    logger.info({
      message: `Generating voice for notification type: ${type}`,
      category: 'api',
      source: 'sesameai',
      metadata: { notificationType: type, speaker }
    });
    
    const audioPath = await sesameAIService.generateNotificationVoice({
      type,
      data,
      speaker
    });
    
    return res.json({
      success: true,
      audioUrl: audioPath
    });
  } catch (error: any) {
    logger.error({
      message: `Error generating notification voice: ${error.message}`,
      category: 'api',
      source: 'sesameai',
      metadata: { error: error.stack }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate notification voice'
    });
  }
});

/**
 * @route GET /api/sesameai/audio-files
 * @description List all generated audio files
 * @access Private
 */
router.get('/audio-files', async (req, res) => {
  try {
    const files = await sesameAIService.listAudioFiles();
    
    logger.info({
      message: `Listed ${files.length} audio files`,
      category: 'api',
      source: 'sesameai'
    });
    
    return res.json({
      success: true,
      files
    });
  } catch (error: any) {
    logger.error({
      message: `Error listing audio files: ${error.message}`,
      category: 'api',
      source: 'sesameai',
      metadata: { error: error.stack }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to list audio files'
    });
  }
});

/**
 * Register SesameAI routes with the provided router
 * @param apiRouter Express Router instance to mount routes on
 */
function registerSesameAIRoutes(apiRouter: Router) {
  apiRouter.use('/sesameai', router);
}

export default registerSesameAIRoutes;