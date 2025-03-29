/**
 * OpenAI Realtime Service for real-time audio conversations
 * 
 * This service handles communication with OpenAI's Realtime API to enable voice conversations
 * with GPT-4o. It supports real-time audio streaming for more natural conversation experiences.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

// Types for the OpenAI Realtime API
interface RealtimeSessionOptions {
  model?: string;
  modalities?: string[];
  instructions?: string;
  voice?: string;
  input_audio_format?: string;
  output_audio_format?: string;
  input_audio_transcription?: {
    model?: string;
    language?: string | null;
    prompt?: string;
  } | null;
  turn_detection?: {
    type: string;
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  } | null;
  temperature?: number;
  max_response_output_tokens?: number | string;
}

interface RealtimeSession {
  id: string;
  object: string;
  model: string;
  modalities: string[];
  instructions: string;
  voice: string;
  input_audio_format: string;
  output_audio_format: string;
  input_audio_transcription: {
    model: string;
    language: string | null;
    prompt: string;
  } | null;
  turn_detection: {
    type: string;
    threshold: number;
    prefix_padding_ms: number;
    silence_duration_ms: number;
  } | null;
  temperature: number;
  max_response_output_tokens: number | string;
  client_secret: {
    value: string;
    expires_at: number;
  };
}

interface VoiceGenerationOptions {
  text: string;
  voice?: string;
  outputPath?: string;
  instructions?: string;
}

interface VoiceGenerationResult {
  audioUrl: string;
  mp3Url?: string;
  text: string;
}

interface NotificationVoiceOptions {
  type: string;
  data: Record<string, any>;
  voice?: string;
  outputPath?: string;
}

class OpenAIRealtimeService {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';
  private isInitialized: boolean = false;
  private audioDir: string = path.join(process.cwd(), 'public', 'audio');
  private defaultVoice: string = 'alloy'; // alloy, echo, fable, onyx, nova, shimmer
  private defaultModel: string = 'gpt-4o-realtime-preview';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.initialize();
  }

  /**
   * Initialize the OpenAI Realtime service
   */
  public initialize(): boolean {
    try {
      if (!this.apiKey) {
        logger.error('OpenAI API key is missing', {
          category: 'openai',
          source: 'openai'
        });
        this.isInitialized = false;
        return false;
      }

      // Create audio directories if they don't exist
      const conversationsDir = path.join(this.audioDir, 'conversations');
      const insightsDir = path.join(this.audioDir, 'insights');
      const notificationsDir = path.join(this.audioDir, 'notifications');

      if (!fs.existsSync(this.audioDir)) {
        fs.mkdirSync(this.audioDir, { recursive: true });
      }
      if (!fs.existsSync(conversationsDir)) {
        fs.mkdirSync(conversationsDir, { recursive: true });
      }
      if (!fs.existsSync(insightsDir)) {
        fs.mkdirSync(insightsDir, { recursive: true });
      }
      if (!fs.existsSync(notificationsDir)) {
        fs.mkdirSync(notificationsDir, { recursive: true });
      }

      this.isInitialized = true;
      logger.info('OpenAI Realtime service initialized successfully', {
        category: 'openai',
        source: 'openai'
      });
      return true;
    } catch (error) {
      logger.error('Failed to initialize OpenAI Realtime service', {
        error,
        category: 'openai',
        source: 'openai'
      });
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check if the service is ready
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Create a realtime session with OpenAI
   */
  public async createRealtimeSession(options: RealtimeSessionOptions = {}): Promise<RealtimeSession> {
    try {
      if (!this.isInitialized) {
        throw new Error('OpenAI Realtime service is not initialized');
      }

      logger.info('Creating OpenAI Realtime session with options', {
        apiAvailable: !!this.apiKey,
        apiKeyLength: this.apiKey ? this.apiKey.length : 0,
        category: 'openai',
        source: 'openai'
      });

      const defaultOptions: RealtimeSessionOptions = {
        model: this.defaultModel,
        modalities: ['audio', 'text'],
        instructions: 'You are a friendly and helpful financial assistant for ShiFi Financial. Respond concisely and professionally to users seeking financial advice or information about their contracts and financial products.',
        voice: this.defaultVoice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        temperature: 0.7,
        max_response_output_tokens: 'inf'
      };

      const requestOptions = { ...defaultOptions, ...options };
      
      logger.info('Making API request to OpenAI Realtime API', {
        url: `${this.baseUrl}/realtime/sessions`,
        model: requestOptions.model,
        voice: requestOptions.voice,
        category: 'openai',
        source: 'openai'
      });

      const response = await axios.post(
        `${this.baseUrl}/realtime/sessions`,
        requestOptions,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      logger.info('Created OpenAI Realtime session', {
        sessionId: response.data.id,
        category: 'openai',
        source: 'openai'
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create OpenAI Realtime session', {
        error,
        category: 'openai',
        source: 'openai'
      });
      throw error;
    }
  }

  /**
   * Generate voice using OpenAI's Realtime API
   * 
   * This method adapts the Realtime API for compatibility with our existing voice generation interface.
   * It creates a non-streaming synthesis of speech for the provided text.
   */
  public async generateVoice(options: VoiceGenerationOptions): Promise<VoiceGenerationResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('OpenAI Realtime service is not initialized');
      }

      const { text, voice = this.defaultVoice, outputPath } = options;
      
      // For non-streaming voice generation, we'll use the regular OpenAI TTS API
      const response = await axios.post(
        `${this.baseUrl}/audio/speech`,
        {
          model: 'tts-1',
          voice: voice,
          input: text,
          response_format: 'mp3'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          responseType: 'arraybuffer'
        }
      );

      // Generate a unique filename if not provided
      const outputFilename = outputPath || path.join(this.audioDir, 'conversations', `${uuidv4()}.mp3`);
      
      // Write the audio data to the file
      fs.writeFileSync(outputFilename, Buffer.from(response.data));
      
      // Calculate the web-accessible URL for the audio file
      const audioUrl = '/audio/conversations/' + path.basename(outputFilename);
      
      logger.info('Generated voice audio using OpenAI TTS', {
        category: 'openai',
        source: 'openai',
        outputPath: outputFilename
      });

      return {
        audioUrl,
        mp3Url: audioUrl, // Since we're generating MP3 directly
        text
      };
    } catch (error) {
      logger.error('Failed to generate voice using OpenAI TTS', {
        error,
        category: 'openai',
        source: 'openai'
      });
      throw error;
    }
  }

  /**
   * Generate notification voice
   * 
   * This generates voice for notifications with appropriate templates
   * based on the notification type
   */
  public async generateNotificationVoice(options: NotificationVoiceOptions): Promise<VoiceGenerationResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('OpenAI Realtime service is not initialized');
      }

      const { type, data, voice = this.defaultVoice, outputPath } = options;
      let text = '';

      // Generate text based on notification type
      if (type === 'customer_payment_reminder') {
        text = `Hello ${data.customerName}, this is a reminder that your payment of $${data.amount} for contract ${data.contractNumber} is due on ${data.dueDate}.`;
      } else if (type === 'customer_payment_confirmation') {
        text = `Hello ${data.customerName}, your payment of $${data.amount} for contract ${data.contractNumber} has been successfully processed. Thank you!`;
      } else if (type === 'customer_application_submitted') {
        text = `Hello ${data.customerName}, your application has been successfully submitted. We'll review it and get back to you soon.`;
      } else if (type === 'customer_application_approved') {
        text = `Great news, ${data.customerName}! Your application has been approved. You can now access your financing details in your ShiFi dashboard.`;
      } else if (type === 'customer_application_rejected') {
        text = `Hello ${data.customerName}, we've reviewed your application and unfortunately, we are unable to approve it at this time. Please check your email for more details.`;
      } else if (type === 'customer_contract_signed') {
        text = `Hello ${data.customerName}, your contract has been successfully signed. Welcome to ShiFi Financial!`;
      } else if (type === 'customer_satisfaction_survey') {
        text = `Hello ${data.customerName}, we value your feedback! Please take a moment to complete our customer satisfaction survey.`;
      } else if (type === 'customer_welcome') {
        text = `Welcome to ShiFi Financial, ${data.customerName}! We're excited to have you as a customer. If you have any questions, feel free to reach out to our support team.`;
      } else if (type === 'merchant_welcome') {
        text = `Welcome to ShiFi Financial, ${data.merchantName}! We're excited to have you as a merchant partner. Your dashboard is now ready for you to manage your financing options.`;
      } else if (type === 'merchant_approval') {
        text = `Congratulations, ${data.merchantName}! Your merchant account has been approved. You can now start offering financing to your customers through ShiFi.`;
      } else if (type === 'merchant_rejection') {
        text = `Hello ${data.merchantName}, we've reviewed your merchant application and unfortunately, we are unable to approve it at this time. Please check your email for more details.`;
      } else if (type === 'merchant_document_request') {
        text = `Hello ${data.merchantName}, we need additional documentation for your account. Please log in to your dashboard to see the requested items.`;
      } else if (type === 'merchant_revenue_verification_complete') {
        text = `Hello ${data.merchantName}, your revenue verification is complete. Your updated financing limits are now available in your dashboard.`;
      } else if (type === 'merchant_ticket_created') {
        text = `Hello ${data.merchantName}, a new support ticket (#${data.ticketNumber}) has been created for you. Our team will address your issue shortly.`;
      } else if (type === 'merchant_ticket_updated') {
        text = `Hello ${data.merchantName}, your support ticket (#${data.ticketNumber}) has been updated. Please check your dashboard for details.`;
      } else {
        text = `Notification from ShiFi Financial. Please check your dashboard for more information.`;
      }

      // Generate a unique filename if not provided
      const outputFilename = outputPath || path.join(this.audioDir, 'notifications', `${uuidv4()}.mp3`);
      const notificationDir = path.dirname(outputFilename);
      
      if (!fs.existsSync(notificationDir)) {
        fs.mkdirSync(notificationDir, { recursive: true });
      }

      // Use the generateVoice method to create the audio
      return this.generateVoice({
        text,
        voice,
        outputPath: outputFilename
      });
    } catch (error) {
      logger.error('Failed to generate notification voice', {
        error,
        category: 'openai',
        source: 'openai'
      });
      throw error;
    }
  }
}

// Create and export a singleton instance
export const openAIRealtimeService = new OpenAIRealtimeService();