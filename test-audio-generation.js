/**
 * Test script to verify audio generation via the Python script
 */
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const pythonScript = path.join(__dirname, 'sesamechat/csm/run_csm.py');
const outputWav = path.join(__dirname, 'public/audio/test_integration.wav');
const pythonInterpreter = 'python3.11';

/**
 * Generate a voice using the Python script directly
 */
async function generateVoice() {
  console.log('Generating test voice...');
  
  const text = 'This is an integration test for the ShiFi Financial voice system.';
  const speaker = 0; // Female voice
  
  // Format command
  const escapedText = JSON.stringify(text);
  const cmd = `${pythonInterpreter} ${pythonScript} --text ${escapedText} --speaker ${speaker} --output "${outputWav}"`;
  
  console.log(`Executing command: ${cmd}`);
  
  try {
    const { stdout, stderr } = await execPromise(cmd);
    
    console.log('\nCommand output:');
    console.log('STDOUT:', stdout);
    
    if (stderr) {
      console.log('STDERR:', stderr);
    }
    
    // Try to parse the output
    try {
      const result = JSON.parse(stdout);
      console.log('\nParsed result:', result);
      
      if (result.success) {
        console.log('✅ Voice generation successful!');
        console.log('Generated files:');
        console.log('- WAV:', result.path);
        console.log('- MP3:', result.mp3Path);
        
        // Verify files exist
        const wavExists = fs.existsSync(outputWav);
        const mp3Exists = fs.existsSync(outputWav.replace('.wav', '.mp3'));
        
        console.log(`WAV file exists: ${wavExists}`);
        console.log(`MP3 file exists: ${mp3Exists}`);
        
        if (wavExists && mp3Exists) {
          console.log('✅ Files successfully created on disk');
        } else {
          console.log('❌ One or more files are missing on disk');
        }
      } else {
        console.log('❌ Voice generation failed:', result.error);
      }
    } catch (parseError) {
      console.error('❌ Failed to parse Python script output:', parseError);
      console.log('Raw output:', stdout);
    }
  } catch (error) {
    console.error('❌ Error executing Python script:', error);
  }
}

// Run the test
generateVoice().catch(console.error);