/**
 * Simple test for the SesameAI service to verify our integration
 */

const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');

const execPromise = util.promisify(exec);

/**
 * Test directly running our DataCrunch script to verify it works
 */
async function testDataCrunchScript() {
  console.log('Testing DataCrunch script directly...');
  
  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'public', 'audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Output path for test
  const outputPath = path.join(outputDir, `test_direct_${Date.now()}.wav`);
  
  try {
    // Build the command using the Python script directly
    const scriptPath = path.join(process.cwd(), 'sesamechat', 'csm', 'run_datacrunch.py');
    const testText = "This is a direct test of the DataCrunch voice engine.";
    const escapedText = JSON.stringify(testText);
    
    const cmd = `python3.11 ${scriptPath} --text ${escapedText} --speaker 0 --output "${outputPath}"`;
    
    console.log(`Running command: ${cmd}`);
    const { stdout, stderr } = await execPromise(cmd);
    
    console.log('Command stdout:', stdout);
    if (stderr) {
      console.log('Command stderr:', stderr);
    }
    
    // Parse JSON response
    try {
      const result = JSON.parse(stdout);
      console.log('Parsed result:', result);
      
      // Check if the file was created
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`Output file created: ${outputPath} (${stats.size} bytes)`);
      } else {
        console.error(`Output file not created: ${outputPath}`);
      }
      
      return result;
    } catch (e) {
      console.error('Failed to parse output:', e.message);
      return null;
    }
  } catch (error) {
    console.error('Error running DataCrunch script:', error.message);
    if (error.stdout) console.log('stdout:', error.stdout);
    if (error.stderr) console.log('stderr:', error.stderr);
    return null;
  }
}

// Run the test
testDataCrunchScript().then(() => {
  console.log('Test completed');
});