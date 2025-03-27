/**
 * Test script to verify SesameAI service functionality
 * 
 * This script:
 * 1. Checks if the SesameAI service is properly initialized
 * 2. Tests generating a voice response from text
 * 3. Verifies the generated audio files
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Test configuration
const API_BASE_URL = 'http://localhost:3000/api';
const TEST_TEXTS = [
  "Hello, I'm the ShiFi financial assistant. How can I help you with your merchant financing today?",
  "Your payment of $250 is due on March 15th. Please ensure your account has sufficient funds.",
  "Congratulations! Your financing application has been approved. We'll be in touch shortly with next steps."
];

async function testSesameAIService() {
  console.log('Testing SesameAI service...\n');

  try {
    // Test 1: Check service status
    console.log('Test 1: Checking SesameAI service status...');
    const statusResponse = await fetch(`${API_BASE_URL}/sesameai/status`);
    const statusData = await statusResponse.json();
    
    if (statusResponse.ok && statusData.initialized) {
      console.log('✅ SesameAI service is initialized and ready');
    } else {
      console.error('❌ SesameAI service is not initialized');
      console.log('Response:', statusData);
      return false;
    }

    // Test 2: Generate voice for each test text
    console.log('\nTest 2: Generating voice responses...');
    const generatedFiles = [];
    
    for (let i = 0; i < TEST_TEXTS.length; i++) {
      const text = TEST_TEXTS[i];
      const speakerId = i % 2; // Alternate between speaker 0 and 1
      
      console.log(`\nGenerating voice for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      console.log(`Using speaker ID: ${speakerId}`);
      
      try {
        const response = await fetch(`${API_BASE_URL}/sesameai/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            speakerId
          }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.audioPath) {
          console.log(`✅ Voice generated successfully`);
          console.log(`Audio file: ${data.audioPath}`);
          generatedFiles.push(data.audioPath);
        } else {
          console.error(`❌ Failed to generate voice`);
          console.log('Response:', data);
        }
      } catch (error) {
        console.error(`❌ Error generating voice: ${error.message}`);
      }
    }
    
    // Test 3: Verify audio files exist
    console.log('\nTest 3: Verifying generated audio files...');
    let allFilesExist = true;
    
    for (const filePath of generatedFiles) {
      // Extract relative path from URL or full path
      const relativePath = filePath.includes('/audio/') 
        ? filePath.substring(filePath.indexOf('/audio/'))
        : filePath;
      
      // Get absolute path
      const publicDir = path.join(process.cwd(), 'public');
      const absolutePath = path.join(publicDir, relativePath);
      
      if (fs.existsSync(absolutePath)) {
        const stats = fs.statSync(absolutePath);
        console.log(`✅ File exists: ${relativePath} (${stats.size} bytes)`);
      } else {
        console.error(`❌ File does not exist: ${relativePath}`);
        allFilesExist = false;
      }
    }
    
    if (allFilesExist) {
      console.log('\n✅ All tests passed successfully!');
      return true;
    } else {
      console.log('\n❌ Some tests failed. See above for details.');
      return false;
    }
    
  } catch (error) {
    console.error(`Test failed with error: ${error.message}`);
    console.error(error);
    return false;
  }
}

// Run the tests
testSesameAIService()
  .then((success) => {
    console.log(`\nTest completed ${success ? 'successfully' : 'with failures'}.`);
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error running tests:', error);
    process.exit(1);
  });