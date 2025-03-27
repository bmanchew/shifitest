import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { NotificationType } from './notification';
import { logger } from './logger';

const execPromise = util.promisify(exec);

export interface GenerateVoiceOptions {
  text: string;
  speaker?: number; // 0 for female (default), 1 for male
  outputPath?: string;
}

export interface GenerateNotificationVoiceOptions {
  type: NotificationType;
  data: Record<string, any>;
  speaker?: number;
  outputPath?: string;
}

/**
 * Service to interact with SesameAI's Conversational Speech Model (CSM)
 * 
 * This service handles:
 * - Text-to-speech generation for both generic text and notifications
 * - Audio file management
 * - Integration with SesameAI's CSM Python module
 */
export class SesameAIService {
  private initialized = false;
  private audioOutputDir: string;
  private pythonInterpreter: string = 'python3.11'; // Require Python 3.11 specifically
  private csm_script_path: string;
  
  constructor() {
    // Initialize paths
    this.audioOutputDir = path.join(process.cwd(), 'public', 'audio');
    this.csm_script_path = path.join(process.cwd(), 'sesamechat', 'csm', 'run_csm.py');
    
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
      
      // Check if the CSM script exists
      if (!fs.existsSync(this.csm_script_path)) {
        logger.error({
          message: 'SesameAI CSM script not found',
          source: 'sesameai',
          category: 'api',
          metadata: { path: this.csm_script_path }
        });
        return;
      }
      
      this.initialized = true;
      
      logger.info({
        message: 'SesameAI service initialized successfully',
        source: 'sesameai',
        category: 'system'
      });
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
   * @returns Path to the generated audio file
   */
  async generateVoice(options: GenerateVoiceOptions): Promise<string> {
    if (!this.initialized) {
      throw new Error('SesameAI service is not initialized');
    }
    
    const { text, speaker = 0, outputPath } = options;
    
    // Generate a filename if not provided
    const audioFilename = outputPath || path.join(
      this.audioOutputDir,
      `voice_${Date.now()}.wav`
    );
    
    // Ensure output directory exists
    const outputDir = path.dirname(audioFilename);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    try {
      // Escape text for shell command
      const escapedText = JSON.stringify(text);
      
      // Run Python script to generate audio
      const cmd = `${this.pythonInterpreter} ${this.csm_script_path} --text ${escapedText} --speaker ${speaker} --output "${audioFilename}"`;
      
      logger.info({
        message: 'Generating voice with SesameAI CSM',
        source: 'sesameai',
        category: 'api',
        metadata: { textLength: text.length, speaker }
      });
      
      const { stdout, stderr } = await execPromise(cmd);
      
      if (stderr && !stderr.includes('No CUDA GPUs are available')) {
        logger.warn({
          message: `Warning during voice generation: ${stderr}`,
          source: 'sesameai',
          category: 'api'
        });
      }
      
      // Verify file was created
      if (!fs.existsSync(audioFilename)) {
        throw new Error('Failed to generate audio file');
      }
      
      // Return the path relative to the public directory for client access
      const publicPath = audioFilename.replace(path.join(process.cwd(), 'public'), '');
      return publicPath.startsWith('/') ? publicPath : `/${publicPath}`;
    } catch (error: any) {
      logger.error({
        message: `Error generating voice: ${error.message}`,
        source: 'sesameai',
        category: 'api',
        metadata: { error: error.stack }
      });
      
      throw new Error(`Failed to generate voice: ${error.message}`);
    }
  }
  
  /**
   * Generate voice for a notification
   * 
   * @param options Options for notification voice generation
   * @returns Path to the generated audio file
   */
  async generateNotificationVoice(options: GenerateNotificationVoiceOptions): Promise<string> {
    const { type, data, speaker = 0, outputPath } = options;
    
    // Generate appropriate notification text based on type and data
    const text = this.generateNotificationText(type, data);
    
    // Generate voice using the text
    return this.generateVoice({
      text,
      speaker,
      outputPath
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