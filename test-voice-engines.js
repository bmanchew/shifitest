/**
 * Test script to verify each voice engine option
 * This will test each available engine: mock, gtts, and huggingface
 */

import { sesameAIService } from './server/services/sesameai.ts';

async function testVoiceEngines() {
  console.log('Testing SesameAI voice engines...');

  // First check if service is ready
  const isReady = sesameAIService.isReady();
  console.log(`SesameAI service ready: ${isReady}`);

  if (!isReady) {
    console.error('SesameAI service is not ready. Exiting test.');
    return;
  }

  const testText = 'This is a test of the voice engine. It should generate audio for this text.';
  const engines = ['mock', 'gtts', 'huggingface'];
  
  // Test each engine
  for (const engine of engines) {
    console.log(`\nTesting engine: ${engine}`);
    try {
      const result = await sesameAIService.generateVoice({
        text: testText,
        engine: engine,
        outputPath: `public/audio/test_${engine}_${Date.now()}.wav`
      });
      
      console.log(`Success with ${engine}!`);
      console.log(`Audio URL: ${result.audioUrl}`);
      if (result.mp3Url) {
        console.log(`MP3 URL: ${result.mp3Url}`);
      }
    } catch (error) {
      console.error(`Error with ${engine} engine:`, error.message);
    }
  }

  // Test HuggingFace with explicit model ID
  try {
    console.log('\nTesting Hugging Face with explicit model ID (sesame/csm-1b)');
    const result = await sesameAIService.generateVoice({
      text: testText,
      engine: 'huggingface',
      modelId: 'sesame/csm-1b',
      outputPath: `public/audio/test_huggingface_explicit_${Date.now()}.wav`
    });
    
    console.log('Success with Hugging Face explicit model!');
    console.log(`Audio URL: ${result.audioUrl}`);
    if (result.mp3Url) {
      console.log(`MP3 URL: ${result.mp3Url}`);
    }
  } catch (error) {
    console.error('Error with Hugging Face explicit model:', error.message);
  }

  // Test a notification voice
  try {
    console.log('\nTesting notification voice generation');
    const result = await sesameAIService.generateNotificationVoice({
      type: 'customer_payment_reminder',
      data: {
        customerName: 'John Doe',
        amount: 500,
        contractNumber: 'C12345',
        dueDate: 'May 1st, 2025'
      },
      engine: 'gtts', // Use the most reliable engine
      outputPath: `public/audio/test_notification_${Date.now()}.wav`
    });
    
    console.log('Success with notification voice!');
    console.log(`Audio URL: ${result.audioUrl}`);
    if (result.mp3Url) {
      console.log(`MP3 URL: ${result.mp3Url}`);
    }
  } catch (error) {
    console.error('Error with notification voice:', error.message);
  }

  console.log('\nTest complete!');
}

// Run the test
testVoiceEngines().catch(err => {
  console.error('Unexpected error during test:', err);
});