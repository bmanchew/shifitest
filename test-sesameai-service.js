/**
 * Test script to verify that the SesameAI service is working correctly.
 * This tests the full integration from TS service to Python script.
 */

import { sesameAIService } from './server/services/sesameai.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test the SesameAI service
 */
async function testSesameAI() {
  console.log('Testing SesameAI service...');
  
  // Check if the service is initialized
  const isReady = sesameAIService.isReady();
  console.log(`SesameAI service ready: ${isReady}`);
  
  if (!isReady) {
    console.error('❌ SesameAI service is not initialized. Test failed.');
    return;
  }
  
  try {
    // Generate a test voice
    console.log('Generating test voice...');
    
    const outputPath = 'public/audio/test_service_voice.wav';
    const result = await sesameAIService.generateVoice({
      text: 'This is a test of the ShiFi Financial voice system using the SesameAI service.',
      speaker: 0, // Female voice
      outputPath
    });
    
    console.log('Voice generation result:', result);
    
    // Check if the files were created
    const wavExists = fs.existsSync(path.join(__dirname, 'public/audio/test_service_voice.wav'));
    const mp3Exists = fs.existsSync(path.join(__dirname, 'public/audio/test_service_voice.mp3'));
    
    console.log(`WAV file exists: ${wavExists}`);
    console.log(`MP3 file exists: ${mp3Exists}`);
    
    if (wavExists && mp3Exists) {
      console.log('✅ Voice generation test passed!');
    } else {
      console.log('❌ Voice generation test failed - one or more output files are missing.');
    }
    
    // Test notification voice generation
    console.log('\nTesting notification voice generation...');
    
    const notificationResult = await sesameAIService.generateNotificationVoice({
      type: 'customer_payment_reminder',
      data: {
        customerName: 'John Smith',
        amount: 1500,
        contractNumber: 'SHIFI-2025-03-29',
        dueDate: 'April 15, 2025'
      },
      speaker: 1, // Male voice
      outputPath: 'public/audio/test_notification_voice.wav'
    });
    
    console.log('Notification voice generation result:', notificationResult);
    
    // Check if the notification files were created
    const notifWavExists = fs.existsSync(path.join(__dirname, 'public/audio/test_notification_voice.wav'));
    const notifMp3Exists = fs.existsSync(path.join(__dirname, 'public/audio/test_notification_voice.mp3'));
    
    console.log(`Notification WAV file exists: ${notifWavExists}`);
    console.log(`Notification MP3 file exists: ${notifMp3Exists}`);
    
    if (notifWavExists && notifMp3Exists) {
      console.log('✅ Notification voice generation test passed!');
    } else {
      console.log('❌ Notification voice generation test failed - one or more output files are missing.');
    }
    
  } catch (error) {
    console.error('❌ Error testing SesameAI service:', error);
  }
}

// Run the test
testSesameAI().catch(console.error);