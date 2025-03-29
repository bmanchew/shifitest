/**
 * This script tests the audio file serving by making HTTP requests directly to the server.
 * It verifies that audio files are accessible and have the correct MIME types.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the test audio files
const testFiles = [
  { path: '/audio/test_audio.mp3', expectedType: 'audio/mpeg' },
  { path: '/audio/test_audio.wav', expectedType: 'audio/wav' }
];

// Test a single file
function testAudioFile(filePath, expectedType) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: filePath,
      method: 'HEAD'  // Just get headers, not the full file
    };

    const req = http.request(options, (res) => {
      console.log(`\n======= Testing ${filePath} =======`);
      console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`Content-Type: ${res.headers['content-type'] || 'none'}`);
      console.log(`Content-Length: ${res.headers['content-length'] || 'unknown'} bytes`);
      
      const statusOk = res.statusCode === 200;
      const typeOk = res.headers['content-type'] === expectedType;
      
      if (statusOk && typeOk) {
        console.log('✅ File is accessible with correct MIME type');
        resolve(true);
      } else {
        console.log('❌ Test failed');
        if (!statusOk) console.log(`   - Status code should be 200 but was ${res.statusCode}`);
        if (!typeOk) console.log(`   - Content-Type should be ${expectedType} but was ${res.headers['content-type']}`);
        resolve(false);
      }
    });
    
    req.on('error', (error) => {
      console.error(`\n❌ Error testing ${filePath}: ${error.message}`);
      resolve(false);
    });
    
    req.end();
  });
}

// Verify local files exist
function checkLocalFiles() {
  console.log('\n======= Checking local files =======');
  const files = [
    path.join(process.cwd(), 'public/audio/test_audio.mp3'),
    path.join(process.cwd(), 'public/audio/test_audio.wav')
  ];
  
  files.forEach(file => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      console.log(`✅ ${file} exists (${stats.size} bytes)`);
    } else {
      console.log(`❌ ${file} does not exist`);
    }
  });
}

// Run all tests
async function runTests() {
  console.log('Starting audio file service tests...');
  
  // First check if files exist locally
  checkLocalFiles();
  
  // Test each file
  let allPassed = true;
  for (const file of testFiles) {
    const passed = await testAudioFile(file.path, file.expectedType);
    if (!passed) allPassed = false;
  }
  
  console.log('\n======= Test Summary =======');
  console.log(allPassed ? '✅ All tests passed!' : '❌ Some tests failed');
}

runTests();