/**
 * SesameAI Routes
 * 
 * This file contains routes for interacting with the SesameAI service
 * to generate and manage voice responses for the application.
 */
import { Request, Response, Router } from 'express';
import { sesameAIService } from '../services/sesameAI';
import { logger } from '../services/logger';
import { asyncHandler } from '../services/errorHandler';
import path from 'path';

const router = Router();

/**
 * Check the status of the SesameAI service
 * GET /api/sesameai/status
 */
router.get('/status', (req: Request, res: Response) => {
  const isInitialized = sesameAIService.isInitialized();
  res.json({
    initialized: isInitialized,
    status: isInitialized ? 'ready' : 'not initialized'
  });
});

/**
 * Generate voice audio from text
 * POST /api/sesameai/generate
 * 
 * Request body:
 * {
 *   text: string - The text to convert to speech
 *   speakerId: number - (optional) The speaker ID (0-4)
 *   outputFile: string - (optional) Specific output file name
 * }
 * 
 * Response:
 * {
 *   success: boolean - Whether the generation was successful
 *   audioPath: string - The path to the generated audio file 
 *   duration: number - Estimated duration of the audio in seconds
 * }
 */
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const { text, speakerId = 0, outputFile } = req.body;

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Text is required'
    });
  }

  // Log the generation request
  logger.info({
    message: 'Voice generation request received',
    category: 'api',
    source: 'sesameai',
    metadata: {
      textLength: text.length,
      speakerId,
      outputFile: outputFile || 'auto-generated'
    }
  });

  try {
    // Build output path if provided
    let outputPath = undefined;
    if (outputFile) {
      // Make sure the output file has the correct extension
      const fileName = outputFile.endsWith('.wav') ? outputFile : `${outputFile}.wav`;
      outputPath = path.join(process.cwd(), 'public', 'audio', fileName);
    }

    // Generate the voice response
    const audioPath = await sesameAIService.generateVoiceResponse(text, speakerId, outputPath);
    
    // Calculate an estimated duration based on text length (very rough estimate)
    // A more accurate duration would be calculated from the actual audio file
    const estimatedDuration = text.length * 0.07; // ~70ms per character
    
    res.json({
      success: true,
      audioPath: audioPath.replace(process.cwd() + '/public', ''),
      duration: estimatedDuration
    });
  } catch (error) {
    logger.error({
      message: `Error in voice generation: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'sesameai',
      metadata: {
        textLength: text.length,
        speakerId,
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}));

/**
 * Generate a voice for a notification
 * POST /api/sesameai/notification
 * 
 * Request body:
 * {
 *   type: string - The notification type (e.g., 'payment_reminder', 'application_status')
 *   data: object - Data for the notification
 *   speakerId: number - (optional) The speaker ID (0-4)
 * }
 */
router.post('/notification', asyncHandler(async (req: Request, res: Response) => {
  const { type, data, speakerId = 0 } = req.body;

  if (!type) {
    return res.status(400).json({
      success: false,
      error: 'Notification type is required'
    });
  }

  if (!data || typeof data !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Notification data is required and must be an object'
    });
  }

  try {
    // Generate the notification voice
    const audioPath = await sesameAIService.generateNotificationVoice(type, data, speakerId);
    
    res.json({
      success: true,
      audioPath: audioPath.replace(process.cwd() + '/public', ''),
      type,
      data
    });
  } catch (error) {
    logger.error({
      message: `Error generating notification voice: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'sesameai',
      metadata: {
        notificationType: type,
        data,
        speakerId,
        error: error instanceof Error ? error.stack : null
      }
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}));

/**
 * List available audio files
 * GET /api/sesameai/audio
 */
router.get('/audio', (req: Request, res: Response) => {
  try {
    const audioFiles = sesameAIService.getAudioFiles();
    res.json({
      success: true,
      files: audioFiles
    });
  } catch (error) {
    logger.error({
      message: `Error listing audio files: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'sesameai'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;