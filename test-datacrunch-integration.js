/**
 * Test script for DataCrunch integration with the SesameAI service
 * This tests the full integration from TypeScript to Python with DataCrunch
 */

import { sesameAIService } from './server/services/sesameai.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current filename and directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test the DataCrunch integration with SesameAI
 */
async function testDataCrunchIntegration() {
  console.log('Testing DataCrunch integration with SesameAI...');
  
  // Check if the service is initialized and ready
  const isReady = sesameAIService.isReady();
  console.log(`SesameAI service ready: ${isReady}`);
  
  if (!isReady) {
    console.error('❌ SesameAI service is not initialized. Test failed.');
    return;
  }
  
  try {
    const testText = "This is a test of the DataCrunch voice engine integration with SesameAI.";
    
    // Create output path
    const outputDir = path.join(__dirname, 'public', 'audio');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Test each engine to compare results
    const engines = ['datacrunch', 'huggingface', 'gtts'];
    
    for (const engine of engines) {
      console.log(`\nTesting ${engine} engine...`);
      
      const outputPath = `public/audio/test_${engine}_${Date.now()}.wav`;
      
      try {
        // Generate voice with the specified engine
        const result = await sesameAIService.generateVoice({
          text: testText,
          speaker: 0, // Female voice
          engine,
          outputPath
        });
        
        console.log(`${engine} result:`, result);
        
        // Check if the files were created
        const wavExists = fs.existsSync(path.join(__dirname, 'public/audio', path.basename(result.audioUrl)));
        const mp3Exists = result.mp3Url ? fs.existsSync(path.join(__dirname, 'public/audio', path.basename(result.mp3Url))) : false;
        
        console.log(`WAV file exists: ${wavExists}`);
        console.log(`MP3 file exists: ${mp3Exists}`);
        
        if (wavExists) {
          console.log(`✅ ${engine} test passed!`);
        } else {
          console.log(`❌ ${engine} test failed - output files missing.`);
        }
      } catch (error) {
        console.error(`❌ ${engine} test failed with error:`, error.message);
      }
    }
    
    console.log('\nDataCrunch integration test completed.');
  } catch (error) {
    console.error('Error testing DataCrunch integration:', error);
  }
}

// Run the test
testDataCrunchIntegration();