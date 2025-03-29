/**
 * Test script for the Google TTS audio generation functionality
 * This script directly tests the new gTTS implementation
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testGTTSGeneration() {
  console.log('Testing gTTS audio generation...');
  
  // Check if the Python script exists
  const scriptPath = path.join(process.cwd(), 'sesamechat', 'csm', 'run_gtts.py');
  if (!fs.existsSync(scriptPath)) {
    console.error(`Error: gTTS script not found at ${scriptPath}`);
    return false;
  }
  
  // Create output directory if it doesn't exist
  const outputDir = path.join(process.cwd(), 'public', 'audio', 'test');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Set up test parameters
  const testText = "Hello, this is a test of the Google Text to Speech system used in the ShiFi Financial Sherpa.";
  const outputPath = path.join(outputDir, `gtts_test_${Date.now()}.wav`);
  
  try {
    // Escape text properly for command line
    const escapedText = JSON.stringify(testText);
    
    // Run the Python script
    console.log(`Running command: python3.11 ${scriptPath} --text ${escapedText} --output "${outputPath}"`);
    const { stdout, stderr } = await execPromise(`python3.11 ${scriptPath} --text ${escapedText} --output "${outputPath}"`);
    
    // Display the output
    console.log('Command output:');
    console.log(stdout);
    
    if (stderr) {
      console.log('Command stderr:');
      console.log(stderr);
    }
    
    // Parse the JSON output to get file paths
    try {
      const result = JSON.parse(stdout);
      if (result.success) {
        console.log(`✅ Successfully generated audio!`);
        console.log(`WAV file: ${result.path}`);
        console.log(`MP3 file: ${result.mp3Path || 'Not generated'}`);
        
        // Verify the files exist
        const publicWavPath = path.join(process.cwd(), 'public', result.path);
        const wavExists = fs.existsSync(publicWavPath);
        console.log(`WAV file exists: ${wavExists}`);
        
        if (result.mp3Path) {
          const publicMp3Path = path.join(process.cwd(), 'public', result.mp3Path);
          const mp3Exists = fs.existsSync(publicMp3Path);
          console.log(`MP3 file exists: ${mp3Exists}`);
        }
        
        return true;
      } else {
        console.error(`❌ Failed to generate audio: ${result.error}`);
        return false;
      }
    } catch (parseError) {
      console.error(`❌ Failed to parse script output: ${parseError.message}`);
      console.error('Raw output:', stdout);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error executing gTTS script: ${error.message}`);
    return false;
  }
}

// Run the test
testGTTSGeneration()
  .then(success => {
    if (success) {
      console.log('\n✅ gTTS audio generation test completed successfully!');
    } else {
      console.error('\n❌ gTTS audio generation test failed.');
    }
  })
  .catch(error => {
    console.error(`❌ Unexpected error: ${error.message}`);
  });