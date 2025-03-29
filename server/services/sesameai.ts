import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { NotificationType } from './notification';
import { logger } from './logger';

const execPromise = util.promisify(exec);

// Define voice engine types
export type VoiceEngine = 'mock' | 'gtts' | 'huggingface';

export interface GenerateVoiceOptions {
  text: string;
  speaker?: number; // 0 for female (default), 1 for male
  outputPath?: string;
  engine?: VoiceEngine; // Which voice engine to use
  modelId?: string; // For Hugging Face, the model ID to use (default: sesame/csm-1b)
}

export interface GenerateNotificationVoiceOptions {
  type: NotificationType;
  data: Record<string, any>;
  speaker?: number;
  outputPath?: string;
  engine?: VoiceEngine; // Which voice engine to use
  modelId?: string; // For Hugging Face, the model ID to use
}

/**
 * Service to interact with SesameAI's Conversational Speech Model (CSM)
 * and Google Text-to-Speech (gTTS) as an alternative
 * 
 * This service handles:
 * - Text-to-speech generation for both generic text and notifications
 * - Audio file management
 * - Integration with SesameAI's CSM Python module and gTTS
 */
export class SesameAIService {
  private initialized = false;
  private audioOutputDir: string;
  private pythonInterpreter: string = 'python3.11'; // Require Python 3.11 specifically
  private csm_script_path: string;
  private gtts_script_path: string;
  private huggingface_script_path: string;
  private defaultEngine: VoiceEngine = 'gtts'; // Default to Google TTS which is more reliable
  
  constructor() {
    // Initialize paths
    this.audioOutputDir = path.join(process.cwd(), 'public', 'audio');
    this.csm_script_path = path.join(process.cwd(), 'sesamechat', 'csm', 'run_csm.py');
    this.gtts_script_path = path.join(process.cwd(), 'sesamechat', 'csm', 'run_gtts.py');
    this.huggingface_script_path = path.join(process.cwd(), 'sesamechat', 'csm', 'run_huggingface.py');
    
    // Ensure output directory exists
    this.initialize();
  }
  
  /**
   * Initialize the service by setting up required directories
   */
  private initialize() {
    try {
      // Create audio output directory if it doesn't exist
      if (!fs.existsSync(this.audioOutputDir)) {
        fs.mkdirSync(this.audioOutputDir, { recursive: true });
      }
      
      // Initialize as not ready
      this.initialized = false;
      
      // Check which voice engines are available
      const availableEngines: VoiceEngine[] = [];
      
      // Check for Google TTS (preferred for reliability)
      if (fs.existsSync(this.gtts_script_path)) {
        availableEngines.push('gtts');
        logger.info({
          message: 'Google TTS script found',
          source: 'sesameai',
          category: 'system'
        });
      }
      
      // Check for Hugging Face (best quality)
      if (fs.existsSync(this.huggingface_script_path)) {
        availableEngines.push('huggingface');
        logger.info({
          message: 'Hugging Face speech script found',
          source: 'sesameai',
          category: 'system'
        });
      }
      
      // Check for mock CSM (fallback)
      if (fs.existsSync(this.csm_script_path)) {
        availableEngines.push('mock');
        logger.info({
          message: 'Mock CSM script found',
          source: 'sesameai',
          category: 'system'
        });
      }
      
      // Set default engine based on availability
      if (availableEngines.includes('gtts')) {
        this.defaultEngine = 'gtts';
      } else if (availableEngines.includes('huggingface')) {
        this.defaultEngine = 'huggingface';
      } else if (availableEngines.includes('mock')) {
        this.defaultEngine = 'mock';
      } else {
        logger.error({
          message: 'No voice engine scripts found',
          source: 'sesameai',
          category: 'system',
          metadata: { 
            gttsPath: this.gtts_script_path,
            huggingfacePath: this.huggingface_script_path,
            csmPath: this.csm_script_path
          }
        });
        return;
      }
      
      // Mark as initialized if we have at least one engine
      this.initialized = availableEngines.length > 0;
      
      if (this.initialized) {
        logger.info({
          message: 'SesameAI service initialized successfully',
          source: 'sesameai',
          category: 'system',
          metadata: { 
            availableEngines,
            defaultEngine: this.defaultEngine
          }
        });
      }
    } catch (error: any) {
      logger.error({
        message: `Failed to initialize SesameAI service: ${error.message}`,
        source: 'sesameai',
        category: 'system',
        metadata: { error: error.stack }
      });
    }
  }
  
  /**
   * Check if the service is ready to use
   */
  isReady(): boolean {
    return this.initialized;
  }
  
  /**
   * Generate voice from text
   * 
   * @param options Options for voice generation
   * @returns Object containing paths to the generated audio files (WAV and optionally MP3)
   */
  async generateVoice(options: GenerateVoiceOptions): Promise<{ audioUrl: string; mp3Url?: string }> {
    if (!this.initialized) {
      throw new Error('SesameAI service is not initialized');
    }
    
    const { 
      text, 
      speaker = 0, 
      outputPath, 
      engine = this.defaultEngine,
      modelId
    } = options;
    
    // Select the appropriate script based on requested engine
    let scriptPath: string;
    let engineName: string;
    
    switch (engine) {
      case 'gtts':
        scriptPath = this.gtts_script_path;
        engineName = 'Google TTS';
        break;
      case 'huggingface':
        scriptPath = this.huggingface_script_path;
        engineName = 'Hugging Face Speech';
        break;
      case 'mock':
      default:
        scriptPath = this.csm_script_path;
        engineName = 'SesameAI CSM (Mock)';
        break;
    }
    
    // Fall back to a different engine if the requested one is not available
    if (!fs.existsSync(scriptPath)) {
      if (fs.existsSync(this.gtts_script_path)) {
        scriptPath = this.gtts_script_path;
        engineName = 'Google TTS (Fallback)';
      } else if (fs.existsSync(this.csm_script_path)) {
        scriptPath = this.csm_script_path;
        engineName = 'SesameAI CSM (Fallback)';
      } else {
        throw new Error(`Requested voice engine ${engine} is not available, and no fallback engines found`);
      }
      
      logger.warn({
        message: `Requested voice engine ${engine} is not available, falling back to ${engineName}`,
        source: 'sesameai',
        category: 'api'
      });
    }
    
    // Ensure we're using a path with the public prefix for the Python script
    // but strip it when returning the URL for the client
    const fullOutputPath = outputPath && !outputPath.startsWith('/public/') 
      ? path.join(process.cwd(), outputPath) 
      : path.join(process.cwd(), 'public', `audio/voice_${Date.now()}.wav`);
    
    // Ensure output directory exists
    const outputDir = path.dirname(fullOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    try {
      // Escape text for shell command using proper quoting
      const escapedText = JSON.stringify(text);
      
      // Build the command based on the engine
      let cmd = `${this.pythonInterpreter} ${scriptPath} --text ${escapedText} --speaker ${speaker} --output "${fullOutputPath}"`;
      
      // Add model ID parameter for Hugging Face if provided
      if (engine === 'huggingface' && modelId) {
        cmd += ` --model "${modelId}"`;
      }
      
      logger.info({
        message: `Generating voice with ${engineName}`,
        source: 'sesameai',
        category: 'api',
        metadata: { 
          textLength: text.length, 
          speaker,
          engine: engineName,
          ...(modelId && { modelId })
        }
      });
      
      const { stdout, stderr } = await execPromise(cmd);
      
      // Log all stdout and stderr for debugging
      console.log(`${engineName} script stdout:`, stdout);
      if (stderr) {
        console.log(`${engineName} script stderr:`, stderr);
      }
      
      // Default return values
      let audioUrl = '';
      let mp3Url: string | undefined = undefined;
      
      // Parse the JSON response from Python script if available
      try {
        const result = JSON.parse(stdout);
        if (result.success === false) {
          logger.error({
            message: `Python script error: ${result.error}`,
            source: 'sesameai',
            category: 'api',
            metadata: { 
              error: result.error,
              engine: engineName
            }
          });
          throw new Error(result.error || 'Unknown error from Python script');
        }
        
        // Check for WAV path from the Python script
        if (result.path) {
          audioUrl = result.path;
          
          // Check if MP3 path was returned for better browser compatibility
          if (result.mp3Path) {
            mp3Url = result.mp3Path;
            logger.info({
              message: 'MP3 version of audio was generated',
              source: 'sesameai', 
              category: 'api',
              metadata: { mp3Url }
            });
          }
        }
      } catch (error: any) {
        // If stdout is not valid JSON, log full details and rethrow
        logger.error({
          message: `Could not parse Python script output: ${error.message}`,
          source: 'sesameai',
          category: 'api',
          metadata: { 
            stdout,
            stderr,
            error: error.message,
            stack: error.stack,
            engine: engineName
          }
        });
        
        // This is likely an issue with the Python script, so rethrow
        throw new Error(`Python script output parsing error: ${error.message}. Check the logs for more details.`);
      }
      
      if (stderr) {
        logger.warn({
          message: `Warning during voice generation: ${stderr}`,
          source: 'sesameai',
          category: 'api',
          metadata: { 
            stderr,
            engine: engineName
          }
        });
      }
      
      // If we couldn't get the path from JSON result, compute it manually
      if (!audioUrl) {
        // Verify WAV file was created
        if (!fs.existsSync(fullOutputPath)) {
          throw new Error('Failed to generate audio file');
        }
        
        // Return the path relative to the public directory for client access
        audioUrl = fullOutputPath.replace(path.join(process.cwd(), 'public'), '');
        audioUrl = audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`;
        
        // Check for MP3 version that might have been created
        const mp3OutputPath = fullOutputPath.replace('.wav', '.mp3');
        if (fs.existsSync(mp3OutputPath)) {
          mp3Url = mp3OutputPath.replace(path.join(process.cwd(), 'public'), '');
          mp3Url = mp3Url.startsWith('/') ? mp3Url : `/${mp3Url}`;
        }
      }
      
      return { audioUrl, mp3Url };
    } catch (error: any) {
      logger.error({
        message: `Error generating voice: ${error.message}`,
        source: 'sesameai',
        category: 'api',
        metadata: { 
          error: error.stack,
          engine: engineName
        }
      });
      
      throw new Error(`Failed to generate voice: ${error.message}`);
    }
  }
  
  /**
   * Generate voice for a notification
   * 
   * @param options Options for notification voice generation
   * @returns Object containing paths to the generated audio files (WAV and optionally MP3)
   */
  async generateNotificationVoice(options: GenerateNotificationVoiceOptions): Promise<{ audioUrl: string; mp3Url?: string }> {
    const { 
      type, 
      data, 
      speaker = 0, 
      outputPath, 
      engine = this.defaultEngine,
      modelId
    } = options;
    
    // Generate appropriate notification text based on type and data
    const text = this.generateNotificationText(type, data);
    
    // Generate voice using the text
    return this.generateVoice({
      text,
      speaker,
      outputPath,
      engine,
      modelId
    });
  }
  
  /**
   * List all generated audio files
   * 
   * @returns Array of audio file paths
   */
  async listAudioFiles(): Promise<string[]> {
    if (!this.initialized) {
      throw new Error('SesameAI service is not initialized');
    }
    
    try {
      // Read directory and filter for audio files
      const files = fs.readdirSync(this.audioOutputDir)
        .filter(file => file.endsWith('.wav') || file.endsWith('.mp3'))
        .map(file => `/audio/${file}`);
      
      return files;
    } catch (error: any) {
      logger.error({
        message: `Error listing audio files: ${error.message}`,
        source: 'sesameai',
        category: 'api',
        metadata: { error: error.stack }
      });
      
      throw new Error(`Failed to list audio files: ${error.message}`);
    }
  }
  
  /**
   * Generate notification text based on notification type and data
   * 
   * @param type Notification type
   * @param data Notification data
   * @returns Generated text for the notification
   */
  private generateNotificationText(type: NotificationType, data: Record<string, any>): string {
    switch (type) {
      case 'customer_payment_reminder':
        return `Hello ${data.customerName}, this is ShiFi reminding you that your payment of $${data.amount} for contract ${data.contractNumber} is due on ${data.dueDate}. Please ensure your payment is made on time to avoid any late fees.`;
        
      case 'customer_payment_confirmation':
        return `Hello ${data.customerName}, this is ShiFi confirming that your payment of $${data.amount} for contract ${data.contractNumber} has been received. Thank you for your payment.`;
        
      case 'customer_application_submitted':
        return `Hello ${data.customerName}, thank you for submitting your application to ShiFi. We have received your application and will begin processing it right away. You will be notified once a decision has been made.`;
        
      case 'customer_application_approved':
        return `Hello ${data.customerName}, we are pleased to inform you that your application for financing has been approved by ShiFi. The approved amount is $${data.amount}. Please log in to your account to view the details and next steps.`;
        
      case 'customer_application_rejected':
        return `Hello ${data.customerName}, we regret to inform you that your application for financing with ShiFi has not been approved at this time. Please contact our customer service for more information about the decision and to discuss alternative options.`;
        
      case 'customer_contract_signed':
        return `Hello ${data.customerName}, thank you for signing your contract with ShiFi. Your contract number is ${data.contractNumber}. The funds will be disbursed according to the terms outlined in your contract.`;
        
      case 'customer_satisfaction_survey':
        return `Hello ${data.customerName}, ShiFi values your feedback. We would appreciate if you could take a moment to complete a brief satisfaction survey about your recent experience with us. Your feedback helps us improve our services.`;
        
      case 'customer_welcome':
        return `Hello ${data.customerName}, welcome to ShiFi! We're excited to have you on board. Your account has been successfully created and you can now access our financing services.`;
        
      case 'merchant_welcome':
        return `Hello ${data.merchantName}, welcome to ShiFi! Your merchant account has been successfully created. You can now start offering financing options to your customers through our platform.`;
        
      case 'merchant_approval':
        return `Hello ${data.merchantName}, we are pleased to inform you that your application to become a ShiFi merchant partner has been approved. You can now access your merchant dashboard and start offering financing to your customers.`;
        
      case 'merchant_rejection':
        return `Hello ${data.merchantName}, we regret to inform you that your application to become a ShiFi merchant partner has not been approved at this time. Please contact our merchant services team for more information about the decision.`;
        
      case 'merchant_document_request':
        return `Hello ${data.merchantName}, we need additional documentation to complete your merchant onboarding process. Please log in to your merchant dashboard to see the list of required documents and upload them at your earliest convenience.`;
        
      case 'merchant_revenue_verification_complete':
        return `Hello ${data.merchantName}, we have completed the verification of your business revenue. Your merchant account has been updated with the verified revenue information.`;
        
      case 'merchant_ticket_created':
        return `Hello ${data.merchantName}, a new support ticket has been created for your issue regarding ${data.subject}. Your ticket number is ${data.ticketNumber}. Our support team will get back to you as soon as possible.`;
        
      case 'merchant_ticket_updated':
        return `Hello ${data.merchantName}, there has been an update to your support ticket number ${data.ticketNumber} regarding ${data.subject}. Please log in to your merchant dashboard to view the update.`;
        
      default:
        return `This is a notification from ShiFi. Please check your account for more details.`;
    }
  }
}

export const sesameAIService = new SesameAIService();