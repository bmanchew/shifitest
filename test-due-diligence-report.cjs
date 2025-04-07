const { dueDiligenceService } = require('./server/services/dueDiligence');
const { storage } = require('./server/storage');

async function generateTestDueDiligenceReport() {
  try {
    console.log('Starting due diligence report test generation...');
    
    // Check if the OpenAI service is initialized
    if (!dueDiligenceService.isInitialized()) {
      console.error('Due diligence service is not initialized. Please ensure the OPENAI_API_KEY environment variable is set.');
      return;
    }
    
    // Get a merchant to test with - using merchantId 49 as mentioned in notes or 
    // fallback to any available merchant
    let merchantId = 49; // Default to merchant ID 49 (Brandon)
    const merchant = await storage.getMerchant(merchantId);
    
    if (!merchant) {
      console.error(`Merchant with ID ${merchantId} not found. Trying to find another merchant...`);
      
      // Fallback: Get any available merchant
      const merchants = await storage.getMerchants({});
      if (merchants.length === 0) {
        console.error('No merchants found in the system.');
        return;
      }
      
      merchantId = merchants[0].id;
      console.log(`Found fallback merchant with ID: ${merchantId}`);
    } else {
      console.log(`Using merchant: ${merchant.name} (ID: ${merchantId})`);
    }
    
    // Get merchant verification information if available
    const verificationInfo = await storage.getMerchantVerificationInfo(merchantId);
    
    // Get contract info
    const contracts = await storage.getContractsByMerchantId(merchantId);
    
    // Enrich merchant data with additional information for report
    const enrichedMerchantData = {
      ...merchant,
      verificationStatus: verificationInfo?.status || 'unverified',
      middeskBusinessId: verificationInfo?.middeskBusinessId || null,
      activeContractsCount: contracts.filter(c => c.status === 'active').length,
      totalContractsValue: contracts
        .filter(c => c.status === 'active')
        .reduce((sum, contract) => sum + (contract.amount || 0), 0),
      riskScore: determineRiskScore(merchant, contracts, verificationInfo)
    };
    
    console.log('Generating due diligence report...');
    const reportResult = await dueDiligenceService.generateDueDiligenceReport(enrichedMerchantData);
    
    if (!reportResult.success) {
      console.error('Failed to generate report:', reportResult.error);
      return;
    }
    
    console.log('----------------------------------------------');
    console.log('DUE DILIGENCE REPORT GENERATED SUCCESSFULLY');
    console.log('----------------------------------------------');
    console.log(`Report length: ${reportResult.report.length} characters`);
    console.log(`Generated at: ${reportResult.generatedAt}`);
    console.log('----------------------------------------------');
    console.log('REPORT PREVIEW (first 500 characters):');
    console.log('----------------------------------------------');
    console.log(reportResult.report.substring(0, 500) + '...');
    console.log('----------------------------------------------');
    
    // Save the report in the database
    const savedReport = await storage.saveDueDiligenceReport({
      merchantId: merchantId,
      report: reportResult.report,
      generatedAt: reportResult.generatedAt,
      generatedBy: 2, // Admin user ID (Brandon's ID)
      status: 'completed'
    });
    
    console.log(`Report saved with ID: ${savedReport.id}`);
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

// Helper function to determine a merchant's risk score
function determineRiskScore(merchant, contracts, verificationInfo) {
  // Basic risk assessment heuristics
  let riskFactors = 0;
  
  // Verification status
  if (!verificationInfo || verificationInfo.status !== 'verified') {
    riskFactors += 2; // High risk factor for unverified merchants
  }
  
  // Contract history
  if (contracts.length === 0) {
    riskFactors += 1; // Moderate risk for no contract history
  }
  
  // Contract payment history
  const hasLatePayments = contracts.some(c => c.paymentStatus === 'late');
  if (hasLatePayments) {
    riskFactors += 2; // High risk for late payments
  }
  
  // Account age
  const accountAge = merchant.createdAt ? 
    Math.floor((new Date().getTime() - new Date(merchant.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0; // in months
  
  if (accountAge < 3) {
    riskFactors += 1; // New accounts have moderate risk
  }
  
  // Determine final risk score
  if (riskFactors >= 3) {
    return 'high';
  } else if (riskFactors >= 1) {
    return 'medium';
  } else {
    return 'low';
  }
}

// Run the test
generateTestDueDiligenceReport();