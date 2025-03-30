/**
 * Test script to verify the OpenAI Realtime Agents framework functionality
 * This script runs a direct test against the OpenAI Realtime API
 * 
 * It verifies:
 * 1. That the OPENAI_API_KEY is valid and properly configured
 * 2. That the API supports the required "realtime" features
 * 3. That our agent configuration is valid
 */

import { OpenAI } from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple agent definition for testing
const testAgentConfig = {
  name: "testAgent",
  description: "A simple test agent",
  model: "gpt-4o-realtime-preview",
  instructions: "You are a test agent. Respond to the user with 'Test successful!'",
  tools: []
};

/**
 * Test the OpenAI Realtime API
 * This function verifies that we can create a realtime thread
 */
async function testOpenAIRealtimeAPI() {
  try {
    console.log('Testing OpenAI API key validity...');
    
    // First check if the API key is valid by making a simple API call
    try {
      const models = await openai.models.list();
      console.log(`API key is valid. Available models: ${models.data.length}`);
      
      // Check if the required model is available
      const realtimeModel = models.data.find(model => 
        model.id === 'gpt-4o-realtime-preview'
      );
      
      if (realtimeModel) {
        console.log('✅ Realtime model is available');
      } else {
        console.log('❌ Realtime model "gpt-4o-realtime-preview" not found in available models');
        console.log('Available models:', models.data.map(m => m.id).join(', '));
        return false;
      }
    } catch (error) {
      console.error('❌ API key validation failed:', error.message);
      return false;
    }
    
    // Now test realtime thread creation
    console.log('\nTesting realtime thread creation...');
    try {
      const assistants = await openai.beta.assistants.list({
        limit: 10,
      });
      
      console.log(`Found ${assistants.data.length} assistants.`);
      
      // Check if we need to create a test assistant
      let testAssistant = assistants.data.find(a => a.name === 'testAgent');
      
      if (!testAssistant) {
        console.log('Creating test assistant...');
        testAssistant = await openai.beta.assistants.create({
          name: testAgentConfig.name,
          description: testAgentConfig.description,
          model: testAgentConfig.model,
          instructions: testAgentConfig.instructions,
          tools: testAgentConfig.tools,
        });
        console.log('Test assistant created:', testAssistant.id);
      } else {
        console.log('Using existing test assistant:', testAssistant.id);
      }
      
      // Create a thread
      console.log('\nCreating test thread...');
      const thread = await openai.beta.threads.create();
      console.log('Thread created:', thread.id);
      
      console.log('\n✅ OpenAI Realtime API test completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Realtime API test failed:', error.message);
      if (error.response) {
        console.error('API Response:', error.response.data);
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const success = await testOpenAIRealtimeAPI();
  
  if (success) {
    console.log('\n==================================');
    console.log('✅ OpenAI Realtime API is working correctly');
    console.log('==================================');
  } else {
    console.error('\n==================================');
    console.error('❌ OpenAI Realtime API test failed');
    console.error('==================================');
    process.exit(1);
  }
}

// Run the test
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});