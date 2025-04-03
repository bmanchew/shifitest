
/**
 * Test script for OpenAI GPT-4o code analysis functionality
 */

import 'dotenv/config';
import { OpenAIService } from './server/services/openai.ts';
import fs from 'fs';
import path from 'path';

const openaiService = new OpenAIService();

async function testCodeAnalysis() {
  try {
    console.log('📝 Testing GPT-4o Code Analysis Functionality');
    console.log('--------------------------------------------');
    
    // Check if service is initialized
    if (!openaiService.isInitialized()) {
      console.error('❌ OpenAI service is not initialized. Check your API key.');
      process.exit(1);
    }
    
    console.log('✅ OpenAI service initialized successfully');
    console.log(`Default model: ${openaiService.getModel()}`);
    
    // Test with a simple code snippet
    const sampleCode = `
function calculateTotalPrice(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}
`;
    
    console.log('\n🔍 Testing code snippet analysis...');
    const codeAnalysis = await openaiService.analyzeCode(
      sampleCode, 
      "Review this JavaScript function for best practices and suggest improvements"
    );
    
    console.log('\nAnalysis Result:');
    console.log('-----------------');
    console.log(codeAnalysis);
    
    // Test with an actual file from the project
    const filePath = 'test-openai-websocket-simple.js';
    if (fs.existsSync(filePath)) {
      console.log(`\n🔍 Testing file analysis with ${filePath}...`);
      const fileAnalysis = await openaiService.analyzeFile(
        filePath,
        "Review this WebSocket test file and identify potential issues or improvements"
      );
      
      console.log('\nFile Analysis Result:');
      console.log('---------------------');
      console.log(fileAnalysis);
    } else {
      console.log(`\n⚠️ File ${filePath} not found, skipping file analysis test`);
    }
    
    console.log('\n✅ Tests completed');
    return true;
  } catch (error) {
    console.error('❌ Error during testing:', error);
    return false;
  }
}

// Run the test
testCodeAnalysis().then(success => {
  if (success) {
    console.log('\n🎉 OpenAI GPT-4o code analysis test completed successfully');
  } else {
    console.log('\n❌ OpenAI GPT-4o code analysis test failed');
    process.exit(1);
  }
});
