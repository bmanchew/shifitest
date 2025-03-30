/**
 * Test script to verify the Financial Sherpa agent integration
 * Using OpenAI's Realtime Agents framework
 */

import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// We'll directly access the agent config files without importing
const agentConfigDir = path.join(process.cwd(), 'replit_agent', 'src', 'app', 'agentConfigs');

async function testFinancialSherpaAgent() {
  try {
    console.log('Testing Financial Sherpa Agent integration...');
    
    // Check if the agent config directory exists
    console.log('\nChecking agent configuration:');
    const sherpaConfigPath = path.join(agentConfigDir, 'financialSherpa');
    const sherpaExists = fs.existsSync(sherpaConfigPath);
    console.log('Financial Sherpa directory exists:', sherpaExists);
    
    if (!sherpaExists) {
      throw new Error('Financial Sherpa agent configuration directory not found');
    }
    
    // Check index file
    const indexFilePath = path.join(agentConfigDir, 'index.ts');
    const indexFileExists = fs.existsSync(indexFilePath);
    console.log('Agent index file exists:', indexFileExists);
    
    if (indexFileExists) {
      const indexContent = fs.readFileSync(indexFilePath, 'utf8');
      console.log('Default agent set mentioned in index:', indexContent.includes('defaultAgentSetKey = "financialSherpa"'));
      console.log('Financial Sherpa imported in index:', indexContent.includes('import financialSherpa from "./financialSherpa"'));
    }
    
    // Check financial agent file
    const financialAgentPath = path.join(sherpaConfigPath, 'financial.ts');
    const financialAgentExists = fs.existsSync(financialAgentPath);
    console.log('\nFinancial agent file exists:', financialAgentExists);
    
    let testPrompt = "You are a financial assistant. Please respond to: 'What can you tell me about financial terms?'";
    
    if (financialAgentExists) {
      const financialAgentContent = fs.readFileSync(financialAgentPath, 'utf8');
      
      // Extract tool names
      const toolNames = financialAgentContent.match(/name:\s*['"]([^'"]+)['"]/g) || [];
      console.log('Financial agent tools:', toolNames.map(m => m.match(/['"]([^'"]+)['"]/)[1]));
      
      // Get instructions for testing
      const instructionsMatch = financialAgentContent.match(/instructions:\s*`([^`]+)`/);
      const instructions = instructionsMatch ? instructionsMatch[1].trim() : 'You are a financial assistant.';
      
      // Test OpenAI integration with the agent instructions
      console.log('\nTesting OpenAI with financial agent instructions...');
      
      // Create a simplified version of the prompt for testing
      testPrompt = `
You are a financial assistant with the following instructions:
${instructions}

Please respond to: "What can you tell me about financial terms?"
`.trim();
    }
    
    // Check contract agent file
    const contractAgentPath = path.join(sherpaConfigPath, 'contract.ts');
    const contractAgentExists = fs.existsSync(contractAgentPath);
    console.log('\nContract agent file exists:', contractAgentExists);
    
    if (contractAgentExists) {
      const contractAgentContent = fs.readFileSync(contractAgentPath, 'utf8');
      
      // Extract tool names
      const toolNames = contractAgentContent.match(/name:\s*['"]([^'"]+)['"]/g) || [];
      console.log('Contract agent tools:', toolNames.map(m => m.match(/['"]([^'"]+)['"]/)[1]));
    }
    
    // Test with OpenAI API
    console.log('\nSending test prompt to OpenAI API...');
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: 150
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    
    console.log('\nResponse preview:');
    console.log(response.data.choices[0].message.content.substring(0, 200) + '...');
    
    return {
      success: true,
      message: 'Financial Sherpa agent integration tests passed successfully',
    };
    
  } catch (error) {
    console.error('Error testing Financial Sherpa agent integration:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Response Error:');
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
    
    return {
      success: false,
      message: 'Financial Sherpa agent integration tests failed',
      error: error.response ? error.response.data : error.message
    };
  }
}

async function main() {
  const result = await testFinancialSherpaAgent();
  console.log('\nTest Result:', result.success ? 'SUCCESS' : 'FAILED');
  console.log(result.message);
  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error('Unhandled error in main:', err);
  process.exit(1);
});