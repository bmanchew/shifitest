/**
 * Test script to verify SesameAI service functionality
 * 
 * This script:
 * 1. Checks if the SesameAI service is properly initialized
 * 2. Tests generating a voice response from text
 * 3. Verifies the generated audio files
 */

require('dotenv').config();
const { sesameAIService } = require('./server/services/sesameai');
const fs = require('fs');
const path = require('path');

/**
 * Test the SesameAI service functionality
 */
async function testSesameAIService() {
  console.log('Testing SesameAI service...');
  
  // 1. Check if the service is properly initialized
  const isReady = sesameAIService.isReady();
  console.log(`SesameAI service ready: ${isReady}`);
  
  if (!isReady) {
    console.error('SesameAI service is not initialized. Check if Python dependencies are installed.');
    process.exit(1);
  }
  
  try {
    // 2. Test generating a voice from text
    console.log('Testing voice generation...');
    const sampleText = 'Hello, this is a test of the SesameAI Conversational Speech Model.';
    
    // Test with female voice (speaker = 0)
    const femaleAudioPath = await sesameAIService.generateVoice({
      text: sampleText,
      speaker: 0
    });
    console.log(`Female voice generated at: ${femaleAudioPath}`);
    
    // Test with male voice (speaker = 1)
    const maleAudioPath = await sesameAIService.generateVoice({
      text: sampleText,
      speaker: 1
    });
    console.log(`Male voice generated at: ${maleAudioPath}`);
    
    // 3. Test generating a notification voice
    console.log('Testing notification voice generation...');
    const notificationAudioPath = await sesameAIService.generateNotificationVoice({
      type: 'payment_reminder',
      data: {
        customerName: 'John Smith',
        amount: 250.00,
        dueDate: 'April 15, 2025'
      },
      speaker: 0
    });
    console.log(`Notification voice generated at: ${notificationAudioPath}`);
    
    // 4. List all audio files
    console.log('Listing all generated audio files...');
    const audioFiles = await sesameAIService.listAudioFiles();
    console.log(`Found ${audioFiles.length} audio files:`);
    audioFiles.forEach(file => console.log(`- ${file}`));
    
    // 5. Verify files exist
    const basePath = path.resolve(process.cwd(), 'public');
    const filesExist = [femaleAudioPath, maleAudioPath, notificationAudioPath].map(filePath => {
      const fullPath = path.join(basePath, filePath);
      const exists = fs.existsSync(fullPath);
      return { path: filePath, exists };
    });
    
    filesExist.forEach(file => {
      console.log(`File ${file.path}: ${file.exists ? 'EXISTS' : 'MISSING'}`);
    });
    
    // Check if any files are missing
    const missingFiles = filesExist.filter(file => !file.exists);
    if (missingFiles.length > 0) {
      console.error('Some generated audio files are missing!');
      missingFiles.forEach(file => console.error(`- ${file.path}`));
    } else {
      console.log('All generated audio files exist.');
    }
    
    console.log('SesameAI service test completed successfully!');
  } catch (error) {
    console.error('Error testing SesameAI service:', error);
    process.exit(1);
  }
}

// Run the test
testSesameAIService();