/**
 * SesameAI service for Conversational Speech Model (CSM) integration
 *
 * This service provides text-to-speech capabilities using SesameAI's CSM model.
 * It supports generating realistic voice responses for customer communications,
 * including notification messages, payment reminders, etc.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';
import { NotificationType } from './notification';

const execPromise = promisify(exec);

// Notification message templates for different notification types
const NOTIFICATION_TEMPLATES: Record<string, (data: any) => string> = {
  payment_reminder: (data) => 
    `Hello ${data.customerName}, this is ShiFi Financial with a friendly reminder about your upcoming payment of $${data.amount} due on ${data.dueDate}. Please ensure your payment method is up to date to avoid any late fees. Thank you for choosing ShiFi Financial.`,
  
  application_submitted: (data) => 
    `Hello ${data.customerName}, thank you for submitting your application with ShiFi Financial. We're reviewing your information now and will get back to you shortly with a decision. If you have any questions, feel free to contact us.`,
  
  application_approved: (data) => 
    `Congratulations ${data.customerName}! Your application with ShiFi Financial has been approved for $${data.amount}. We'll be reaching out to finalize the details and complete the next steps. Thank you for choosing ShiFi Financial.`,
  
  application_rejected: (data) => 
    `Hello ${data.customerName}, we've reviewed your application with ShiFi Financial. Unfortunately, we're unable to approve it at this time. We encourage you to review your financial situation and consider applying again in the future.`,
  
  payment_confirmation: (data) => 
    `Hello ${data.customerName}, we've received your payment of $${data.amount} for your ShiFi Financial account. Thank you for your prompt payment. Your next payment will be due on ${data.nextDueDate}.`,
  
  contract_signed: (data) => 
    `Hello ${data.customerName}, thank you for signing your contract with ShiFi Financial. Your account is now active, and your first payment of $${data.firstPayment} will be due on ${data.firstDueDate}. If you have any questions, please don't hesitate to contact us.`,
  
  customer_satisfaction_survey: (data) => 
    `Hello ${data.customerName}, we value your feedback at ShiFi Financial. We'd appreciate it if you could take a few minutes to complete our customer satisfaction survey. Your input helps us improve our services. Thank you for being a valued customer.`
};

/**
 * Interface for voice generation parameters
 */
interface VoiceGenerationParams {
  text: string;
  speaker?: number; // 0 for female, 1 for male
  outputPath?: string;
}

/**
 * Interface for notification voice parameters
 */
interface NotificationVoiceParams {
  type: string;
  data: Record<string, any>;
  speaker?: number; // 0 for female, 1 for male
}

/**
 * Service class for SesameAI integrations
 */
export class SesameAIService {
  private pythonPath: string;
  private scriptPath: string;
  private audioDir: string;
  private initialized: boolean = false;

  constructor() {
    this.pythonPath = 'python3.11'; // Use Python 3.11 specifically
    this.scriptPath = path.join(process.cwd(), 'sesamechat', 'csm', 'run_csm.py');
    this.audioDir = path.join(process.cwd(), 'public', 'audio');
    
    // Ensure audio directory exists
    if (!fs.existsSync(this.audioDir)) {
      try {
        fs.mkdirSync(this.audioDir, { recursive: true });
      } catch (error: any) {
        logger.error({
          message: `Failed to create audio directory: ${error.message}`,
          category: 'system',
          source: 'sesameai',
          metadata: { error: error.stack }
        });
      }
    }
    
    // Check if Python script exists
    if (fs.existsSync(this.scriptPath)) {
      this.initialized = true;
    } else {
      logger.error({
        message: 'SesameAI CSM script not found',
        category: 'system',
        source: 'sesameai',
        metadata: { scriptPath: this.scriptPath }
      });
    }
  }

  /**
   * Check if the service is ready to use
   * @returns True if initialized and ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Generate voice from text
   * @param params Voice generation parameters
   * @returns Path to the generated audio file
   */
  async generateVoice(params: VoiceGenerationParams): Promise<string> {
    if (!this.initialized) {
      throw new Error('SesameAI service is not initialized');
    }

    const { text, speaker = 0, outputPath } = params;
    
    try {
      // Escape text for command line
      const escapedText = text.replace(/"/g, '\\"');
      
      // Build command
      let command = `${this.pythonPath} "${this.scriptPath}" --text "${escapedText}" --speaker ${speaker}`;
      
      if (outputPath) {
        command += ` --output "${outputPath}"`;
      }
      
      logger.info({
        message: 'Generating voice with SesameAI CSM',
        category: 'api',
        source: 'sesameai',
        metadata: { textLength: text.length, speaker }
      });
      
      // Execute Python script
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr) {
        logger.warn({
          message: `SesameAI CSM warnings: ${stderr}`,
          category: 'api',
          source: 'sesameai'
        });
      }
      
      try {
        const result = JSON.parse(stdout);
        
        if (!result.success) {
          throw new Error(result.error || 'Unknown error');
        }
        
        return result.path;
      } catch (error: any) {
        logger.error({
          message: `Failed to parse SesameAI CSM output: ${error.message}`,
          category: 'api',
          source: 'sesameai',
          metadata: { stdout, stderr }
        });
        throw new Error('Failed to generate voice');
      }
    } catch (error: any) {
      logger.error({
        message: `Error generating voice: ${error.message}`,
        category: 'api',
        source: 'sesameai',
        metadata: { error: error.stack }
      });
      throw error;
    }
  }

  /**
   * Generate voice for notification
   * @param params Notification parameters
   * @returns Path to the generated audio file
   */
  async generateNotificationVoice(params: NotificationVoiceParams): Promise<string> {
    const { type, data, speaker = 0 } = params;
    
    // Get template for notification type
    const templateFn = NOTIFICATION_TEMPLATES[type];
    
    if (!templateFn) {
      throw new Error(`Template not found for notification type: ${type}`);
    }
    
    // Generate text from template
    const text = templateFn(data);
    
    // Generate voice
    return this.generateVoice({
      text,
      speaker,
      outputPath: `notification_${type}_${Date.now()}.wav`
    });
  }

  /**
   * List all generated audio files
   * @returns Array of audio file paths
   */
  async listAudioFiles(): Promise<string[]> {
    try {
      // Get all .wav files in the audio directory
      const files = fs.readdirSync(this.audioDir)
        .filter(file => file.endsWith('.wav'))
        .map(file => `/audio/${file}`); // Convert to web path
      
      return files;
    } catch (error: any) {
      logger.error({
        message: `Error listing audio files: ${error.message}`,
        category: 'system',
        source: 'sesameai',
        metadata: { error: error.stack }
      });
      return [];
    }
  }
}

// Export singleton instance
export const sesameAIService = new SesameAIService();