/**
 * Test script to verify Plaid asset data is available and OpenAI integration is working
 * 
 * This script will:
 * 1. Check if asset reports exist for a contract
 * 2. Verify the OpenAI service can access the Plaid data
 * 3. Test the OpenAI integration by generating insights from the data
 */

import { pool } from './server/db.js';
import { plaidService } from './server/services/plaid.js';
import { openaiService } from './server/services/openai.js';
import { logger } from './server/services/logger.js';

async function testPlaidAssetDataForContract(contractId) {
  console.log(`\n---- Testing Plaid Asset Data for Contract ID: ${contractId} ----`);
  
  try {
    // Query the database for asset reports for this contract
    const assetReportResult = await pool.query(
      'SELECT * FROM asset_reports WHERE contract_id = $1 ORDER BY created_at DESC',
      [contractId]
    );
    
    if (assetReportResult.rows.length === 0) {
      console.log(`❌ No asset reports found for contract ID ${contractId}`);
      return false;
    }
    
    console.log(`✅ Found ${assetReportResult.rows.length} asset report(s) for contract ID ${contractId}`);
    
    // Get the most recent asset report
    const latestAssetReport = assetReportResult.rows[0];
    console.log(`Most recent asset report: ${JSON.stringify({
      id: latestAssetReport.id,
      status: latestAssetReport.status,
      created_at: latestAssetReport.created_at,
      asset_report_id: latestAssetReport.asset_report_id
    }, null, 2)}`);
    
    // Check if the asset report has analysis data
    if (!latestAssetReport.analysis_data) {
      console.log(`⚠️ Asset report doesn't have analysis data`);
    } else {
      console.log(`✅ Asset report has analysis data`);
      // Try to parse the analysis data
      try {
        const analysisData = JSON.parse(latestAssetReport.analysis_data);
        console.log(`Analysis data keys: ${Object.keys(analysisData).join(', ')}`);
      } catch (error) {
        console.log(`❌ Failed to parse analysis data: ${error.message}`);
      }
    }
    
    return latestAssetReport;
  } catch (error) {
    console.log(`❌ Error checking asset reports: ${error.message}`);
    return false;
  }
}

async function testOpenAIService() {
  console.log(`\n---- Testing OpenAI Service ----`);
  
  if (!openaiService.isInitialized()) {
    console.log(`❌ OpenAI service is not initialized`);
    return false;
  }
  
  console.log(`✅ OpenAI service is initialized`);
  console.log(`Using model: ${openaiService.getModel()}`);
  
  return true;
}

async function testOpenAIWithPlaidData(assetReport) {
  console.log(`\n---- Testing OpenAI with Plaid Data ----`);
  
  if (!assetReport || !assetReport.asset_report_token) {
    console.log(`❌ No valid asset report available for testing`);
    return false;
  }
  
  try {
    // Attempt to get and analyze the Plaid asset report
    console.log(`Retrieving asset report from Plaid...`);
    
    let plaidData;
    try {
      // Try to get the asset report from Plaid
      const plaidReportData = await plaidService.getAssetReport(
        assetReport.asset_report_token,
        true // include_insights=true
      );
      
      if (!plaidReportData || !plaidReportData.report) {
        console.log(`❌ Failed to retrieve valid report data from Plaid`);
        return false;
      }
      
      console.log(`✅ Successfully retrieved asset report from Plaid`);
      
      // Analyze the asset report to extract financial metrics
      console.log(`Analyzing asset report for financial metrics...`);
      plaidData = await plaidService.analyzeAssetReportForUnderwriting(
        assetReport.asset_report_token
      );
      
      console.log(`✅ Successfully analyzed asset report`);
      console.log(`Analysis data keys: ${Object.keys(plaidData).join(', ')}`);
    } catch (error) {
      console.log(`❌ Error retrieving/analyzing Plaid data: ${error.message}`);
      // Create some minimal data structure for testing OpenAI
      plaidData = {
        income: { monthlyIncome: 5000, annualIncome: 60000 },
        accounts: [{ type: 'depository', balances: { current: 2500 } }],
        transactions: []
      };
      console.log(`⚠️ Created minimal test data for OpenAI testing`);
    }
    
    // Create a simplified financial data structure to test OpenAI
    const customerFinancialData = {
      contracts: [],
      accounts: {
        totalBalance: plaidData.accounts?.reduce((sum, acc) => sum + (acc.balances?.current || 0), 0) || 0,
        totalAccounts: plaidData.accounts?.length || 0
      },
      cashFlow: {
        monthlyIncome: plaidData.income?.monthlyIncome || 0,
        monthlyExpenses: plaidData.income?.monthlyIncome * 0.7 || 0,
        netCashFlow: plaidData.income?.monthlyIncome * 0.3 || 0,
        categories: []
      },
      recentTransactions: []
    };
    
    // Test OpenAI financial insights generation
    console.log(`Testing OpenAI financial insights generation...`);
    const insights = await openaiService.generateFinancialInsights(customerFinancialData);
    
    if (!insights || insights.length === 0) {
      console.log(`❌ Failed to generate financial insights with OpenAI`);
      return false;
    }
    
    console.log(`✅ Successfully generated ${insights.length} financial insights with OpenAI`);
    console.log(`Sample insight: ${JSON.stringify(insights[0], null, 2)}`);
    
    return true;
  } catch (error) {
    console.log(`❌ Error testing OpenAI with Plaid data: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('Starting Plaid + OpenAI integration tests...');

  // Get a test contract ID to check
  try {
    const contractResult = await pool.query(
      'SELECT id FROM contracts ORDER BY created_at DESC LIMIT 1'
    );
    
    if (contractResult.rows.length === 0) {
      console.log('❌ No contracts found for testing');
      return;
    }
    
    const testContractId = contractResult.rows[0].id;
    console.log(`Using contract ID ${testContractId} for testing`);
    
    // Step 1: Test Plaid asset data for the contract
    const assetReport = await testPlaidAssetDataForContract(testContractId);
    
    // Step 2: Test if OpenAI service is initialized
    const openAIReady = await testOpenAIService();
    
    // Step 3: Test OpenAI with Plaid data
    if (assetReport && openAIReady) {
      await testOpenAIWithPlaidData(assetReport);
    }
    
    console.log('\nTests completed. Check the results above.');
  } catch (error) {
    console.error(`Failed to run tests: ${error.message}`);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the tests
runTests();