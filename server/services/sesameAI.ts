/**
 * SesameAI Conversational Speech Model (CSM) Service
 * 
 * This service integrates with the SesameAI CSM to provide high-quality voice generation
 * for the application. It enables the generation of natural-sounding human voices
 * for notifications, alerts, and other communications.
 * 
 * This service provides an interface to the Sesame AI CSM Python model
 * for generating realistic human-sounding speech from text input
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { AppError } from './errorHandler';
import { logger } from './logger';

export class SesameAIService {
  private initialized = false;
  private pythonPath: string = 'python3';
  private csmPath: string = '';
  private audioOutputDir: string = '';
  private speakerIdMap: Record<number, number> = {
    0: 0, // Default voice
    1: 0, // Male voice
    2: 1, // Female voice 
    3: 0, // Additional male voice
    4: 1, // Additional female voice
  };

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the Sesame AI service and verify required components
   */
  private initialize() {
    try {
      // Set paths
      this.csmPath = path.join(process.cwd(), 'sesamechat/csm');
      
      // Create audio output directory if it doesn't exist
      this.audioOutputDir = path.join(process.cwd(), 'public', 'audio');
      if (!fs.existsSync(this.audioOutputDir)) {
        fs.mkdirSync(this.audioOutputDir, { recursive: true });
      }

      // Check if Python is installed and the CSM directory exists
      if (!this.checkPythonInstallation()) {
        throw new Error('Python is not available');
      }

      if (!fs.existsSync(this.csmPath)) {
        throw new Error(`CSM path does not exist: ${this.csmPath}`);
      }

      // Only set initialized to true once we verify all dependencies
      this.initialized = true;
      
      logger.info({
        message: 'SesameAI service initialized successfully',
        category: 'system',
        source: 'sesameai',
        metadata: {
          csmPath: this.csmPath,
          audioOutputDir: this.audioOutputDir
        }
      });
    } catch (error) {
      this.initialized = false;
      logger.error({
        message: `Failed to initialize SesameAI service: ${error instanceof Error ? error.message : String(error)}`,
        category: 'system',
        source: 'sesameai',
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
    }
  }

  /**
   * Check if Python is installed and available
   */
  private checkPythonInstallation(): boolean {
    try {
      // Attempt to run a simple Python command to check if it's available
      const result = spawn(this.pythonPath, ['-c', 'print("Python is available")']);
      
      // Set up event handlers for the result
      result.on('error', (error) => {
        this.initialized = false;
        logger.error({
          message: `Python is not available: ${error.message}`,
          category: 'system',
          source: 'sesameai'
        });
        throw new Error(`Python is not available: ${error.message}`);
      });

      return true;
    } catch (error) {
      this.initialized = false;
      logger.error({
        message: `Error checking Python installation: ${error instanceof Error ? error.message : String(error)}`,
        category: 'system',
        source: 'sesameai'
      });
      return false;
    }
  }

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Generate a voice response from text input
   * @param text The text to convert to speech
   * @param speakerId The ID of the speaker voice to use (0-4)
   * @param outputPath The path where the audio file should be saved
   * @returns The path to the generated audio file
   */
  async generateVoiceResponse(text: string, speakerId: number = 0, outputPath?: string): Promise<string> {
    if (!this.initialized) {
      throw new AppError('SesameAI service is not initialized', 503);
    }

    // Validate input
    if (!text || text.trim().length === 0) {
      throw new AppError('Text input is required', 400);
    }

    // Ensure valid speaker ID
    if (!Object.keys(this.speakerIdMap).includes(speakerId.toString())) {
      speakerId = 0; // Default to the first voice if invalid speaker ID
    }

    // Generate a default output path if not provided
    const finalOutputPath = outputPath || path.join(this.audioOutputDir, `response_${Date.now()}.wav`);
    
    try {
      // Create the parent directory if it doesn't exist
      const parentDir = path.dirname(finalOutputPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Log that we're starting the generation process
      logger.info({
        message: 'Starting SesameAI voice generation',
        category: 'api',
        source: 'sesameai',
        metadata: {
          textLength: text.length,
          speakerId,
          csmSpeakerId: this.speakerIdMap[speakerId],
          outputPath: finalOutputPath
        }
      });

      // In a development environment without GPU, we'll use a simulated response
      // In production with GPU, use the commented out real implementation
      if (process.env.NODE_ENV === 'production' && process.env.SESAME_USE_REAL_MODEL === 'true') {
        await this.callPythonModel(text, this.speakerIdMap[speakerId], finalOutputPath);
      } else {
        // For development, we simulate the process
        await this.simulateVoiceGeneration(text, speakerId, finalOutputPath);
      }

      // Return the path to the generated audio file
      return finalOutputPath;
    } catch (error) {
      logger.error({
        message: `Error generating voice: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'sesameai',
        metadata: {
          textLength: text.length,
          speakerId,
          error: error instanceof Error ? error.stack : null
        }
      });
      throw new AppError(`Failed to generate voice: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * Temporary implementation to simulate voice generation
   * This will be replaced with actual calls to the Python model in production
   */
  private async simulateVoiceGeneration(text: string, speakerId: number, outputPath: string): Promise<void> {
    // For development without GPU resources, simulate the process
    return new Promise((resolve, reject) => {
      try {
        // Create a simple text file with the content that would be spoken
        // In production, this would be replaced with real audio from the model
        const content = `SesameAI would speak: "${text}" using voice ${speakerId}`;
        fs.writeFileSync(outputPath + '.txt', content);
        
        // Simulate processing time based on text length
        const processingTime = Math.min(500 + text.length * 5, 3000);
        setTimeout(() => {
          resolve();
        }, processingTime);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Call the Python model to generate voice
   */
  private async callPythonModel(text: string, speakerId: number, outputPath: string): Promise<void> {
    // Create a temporary Python script that uses the CSM model
    const tempScriptPath = path.join(this.csmPath, 'run_generation.py');
    
    const pythonScript = `
import os
import torch
import torchaudio
from generator import load_csm_1b, Segment

# Disable Triton compilation
os.environ["NO_TORCH_COMPILE"] = "1"

def main():
    # Select CUDA if available
    if torch.cuda.is_available():
        device = "cuda"
    else:
        device = "cpu"
    print(f"Using device: {device}")

    # Load model
    generator = load_csm_1b(device)

    # Generate audio
    text = """${text.replace(/"/g, '\\"')}"""
    speaker_id = ${speakerId}
    
    print(f"Generating audio for text: {text[:50]}...")
    
    audio_tensor = generator.generate(
        text=text,
        speaker=speaker_id,
        context=[],
        max_audio_length_ms=30_000,
    )
    
    # Save the audio file
    output_path = "${outputPath.replace(/\\/g, '\\\\')}"
    torchaudio.save(
        output_path,
        audio_tensor.unsqueeze(0).cpu(),
        generator.sample_rate
    )
    print(f"Audio saved to {output_path}")

if __name__ == "__main__":
    main()
`;

    // Write the script to a temp file
    fs.writeFileSync(tempScriptPath, pythonScript);

    return new Promise((resolve, reject) => {
      // Change to the CSM directory
      const options = {
        cwd: this.csmPath,
        env: {
          ...process.env,
          NO_TORCH_COMPILE: "1" // Disable Triton compilation
        }
      };
      
      // Spawn Python process to run the generation script
      const pythonProcess = spawn(this.pythonPath, [tempScriptPath], options);
      
      let stdoutData = '';
      let stderrData = '';
      
      // Collect stdout data
      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdoutData += output;
        logger.info({
          message: `SesameAI Python output: ${output.trim()}`,
          category: 'system',
          source: 'sesameai'
        });
      });
      
      // Collect stderr data
      pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderrData += output;
        logger.error({
          message: `SesameAI Python error: ${output.trim()}`,
          category: 'system',
          source: 'sesameai'
        });
      });
      
      // Handle process completion
      pythonProcess.on('close', (code) => {
        // Clean up temp script
        try {
          fs.unlinkSync(tempScriptPath);
        } catch (err) {
          // Ignore cleanup errors
        }
        
        if (code === 0) {
          // Success
          logger.info({
            message: 'SesameAI voice generation completed successfully',
            category: 'system',
            source: 'sesameai',
            metadata: {
              outputPath
            }
          });
          resolve();
        } else {
          // Error
          const errorMsg = `Python process exited with code ${code}. Error: ${stderrData}`;
          logger.error({
            message: errorMsg,
            category: 'system',
            source: 'sesameai'
          });
          reject(new Error(errorMsg));
        }
      });
      
      // Handle process errors
      pythonProcess.on('error', (error) => {
        // Clean up temp script
        try {
          fs.unlinkSync(tempScriptPath);
        } catch (err) {
          // Ignore cleanup errors
        }
        
        logger.error({
          message: `Error executing Python process: ${error.message}`,
          category: 'system',
          source: 'sesameai',
          metadata: {
            error: error.stack
          }
        });
        reject(error);
      });
    });
  }

  /**
   * Generate a voice for a notification
   * 
   * @param notificationType The type of notification (e.g., 'payment_reminder', 'application_status')
   * @param data The data to include in the notification message
   * @param speakerId The voice to use (0-4)
   * @returns The path to the generated audio file
   */
  async generateNotificationVoice(
    notificationType: string, 
    data: Record<string, any>, 
    speakerId: number = 0
  ): Promise<string> {
    // Generate appropriate text based on notification type
    let text = '';
    
    switch (notificationType) {
      case 'payment_reminder':
        text = `Hello ${data.customerName || 'there'}. This is a reminder that your payment of $${data.amount || '0'} is due on ${data.dueDate || 'the scheduled date'}. Please ensure your account has sufficient funds for the automatic withdrawal. If you have any questions, please contact us.`;
        break;
        
      case 'application_status':
        if (data.status === 'approved') {
          text = `Great news ${data.customerName || 'there'}! Your financing application has been approved for $${data.amount || '0'}. Our team will be in touch shortly with next steps.`;
        } else if (data.status === 'pending') {
          text = `Hello ${data.customerName || 'there'}. Your financing application is currently under review. We'll notify you as soon as a decision is made.`;
        } else {
          text = `Hello ${data.customerName || 'there'}. We're reaching out regarding your financing application. Please check your account for more details.`;
        }
        break;
        
      case 'contract_signed':
        text = `Hello ${data.customerName || 'there'}. Thank you for signing your contract. Your account has been successfully set up, and your first payment is scheduled for ${data.firstPaymentDate || 'the scheduled date'}.`;
        break;
        
      case 'payment_processed':
        text = `Hello ${data.customerName || 'there'}. We're confirming that your payment of $${data.amount || '0'} was successfully processed on ${data.date || 'the scheduled date'}. Thank you for your business.`;
        break;
        
      default:
        text = `Hello ${data.customerName || 'there'}. This is a notification from ShiFi Merchant Financing. Please check your account for details.`;
    }
    
    // Generate the voice response with the constructed text
    return this.generateVoiceResponse(text, speakerId);
  }
  
  /**
   * List available audio files in the audio directory
   * @returns Array of audio file information
   */
  getAudioFiles(): Array<{filename: string, path: string, size: number, createdAt: Date}> {
    if (!this.initialized) {
      throw new AppError('SesameAI service is not initialized', 503);
    }
    
    try {
      // Get list of files in the audio output directory
      const files = fs.readdirSync(this.audioOutputDir)
        .filter(file => file.endsWith('.wav') || file.endsWith('.mp3'));
      
      // Build file information array
      return files.map(filename => {
        const filePath = path.join(this.audioOutputDir, filename);
        const stats = fs.statSync(filePath);
        
        return {
          filename,
          path: `/audio/${filename}`, // Path relative to public directory
          size: stats.size,
          createdAt: stats.birthtime
        };
      });
    } catch (error) {
      logger.error({
        message: `Error getting audio files: ${error instanceof Error ? error.message : String(error)}`,
        category: 'system',
        source: 'sesameai'
      });
      throw new AppError(`Failed to get audio files: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }
}

// Create a singleton instance
export const sesameAIService = new SesameAIService();