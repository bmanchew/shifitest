/**
 * This script generates a due diligence report for a specific merchant
 * It uses the OpenAI-powered dueDiligence service to analyze merchant data
 */

const { dueDiligenceService } = require('./server/services/dueDiligence');
const { storage } = require('./server/storage');
const axios = require('axios');

async function generateDueDiligenceReport() {
  try {
    console.log('Starting due diligence report generation...');
    
    // Check if OpenAI is properly configured
    if (!dueDiligenceService.isInitialized()) {
      console.error('Due diligence service is not initialized. Please ensure the OPENAI_API_KEY environment variable is set.');
      return;
    }
    
    // Try to fetch a specific merchant (using ID 28 or 49 as mentioned in logs)
    const merchantIds = [28, 49]; // Try these IDs first
    let merchant = null;
    let merchantId = null;
    
    for (const id of merchantIds) {
      console.log(`Trying to fetch merchant with ID ${id}...`);
      const foundMerchant = await storage.getMerchant(id);
      if (foundMerchant) {
        merchant = foundMerchant;
        merchantId = id;
        break;
      }
    }
    
    // If we still don't have a merchant, try to get any available merchant
    if (!merchant) {
      console.log('Specific merchants not found, looking for any available merchant...');
      const merchants = await storage.getMerchants({});
      if (merchants && merchants.length > 0) {
        merchant = merchants[0];
        merchantId = merchant.id;
      } else {
        console.error('No merchants found in the system. Cannot generate report.');
        return;
      }
    }
    
    console.log(`Using merchant: ${merchant.name} (ID: ${merchantId})`);
    
    // Get additional merchant data to enrich the report
    const verificationInfo = await storage.getMerchantVerificationInfo(merchantId);
    const businessDetails = await storage.getMerchantBusinessDetailsByMerchantId(merchantId);
    const contracts = await storage.getContractsByMerchantId(merchantId);
    
    console.log('Merchant verification status:', verificationInfo?.status || 'unknown');
    console.log('Active contracts:', contracts.filter(c => c.status === 'active').length);
    
    // Determine a risk score based on available data
    const riskScore = determineRiskScore(merchant, contracts, verificationInfo);
    console.log('Calculated risk score:', riskScore);
    
    // Enrich merchant data with all available information
    const enrichedMerchantData = {
      ...merchant,
      ...businessDetails,
      verificationStatus: verificationInfo?.status || 'unverified',
      middeskBusinessId: verificationInfo?.middeskBusinessId || null,
      activeContractsCount: contracts.filter(c => c.status === 'active').length,
      totalContractsValue: contracts
        .filter(c => c.status === 'active')
        .reduce((sum, contract) => sum + (contract.amount || 0), 0),
      riskScore: riskScore,
      // If business details available, add them
      industry: businessDetails?.industry || 'Financial Services',
      businessType: businessDetails?.businessType || 'LLC',
      yearFounded: businessDetails?.yearFounded || 2020,
      annualRevenue: businessDetails?.annualRevenue || 1000000,
      description: businessDetails?.description || `${merchant.name} is a financial services company.`
    };
    
    console.log('Generating due diligence report with merchant data...');
    console.log('Merchant data summary:', JSON.stringify({
      id: enrichedMerchantData.id,
      name: enrichedMerchantData.name,
      verificationStatus: enrichedMerchantData.verificationStatus,
      activeContractsCount: enrichedMerchantData.activeContractsCount,
      riskScore: enrichedMerchantData.riskScore
    }, null, 2));
    
    // Generate the report using the service
    const reportResult = await dueDiligenceService.generateDueDiligenceReport(enrichedMerchantData);
    
    if (!reportResult.success) {
      console.error('Failed to generate report:', reportResult.error);
      return;
    }
    
    console.log('\n-----------------------------------------------------');
    console.log('DUE DILIGENCE REPORT GENERATED SUCCESSFULLY');
    console.log('-----------------------------------------------------');
    console.log(`Generated at: ${reportResult.generatedAt}`);
    console.log(`Report length: ${reportResult.report.length} characters`);
    console.log('-----------------------------------------------------');
    console.log('REPORT PREVIEW:');
    console.log('-----------------------------------------------------');
    console.log(reportResult.report.substring(0, 1000) + '...');
    console.log('-----------------------------------------------------');
    
    // Save the report to the database
    const savedReport = await storage.saveDueDiligenceReport({
      merchantId: merchantId,
      report: reportResult.report,
      generatedAt: reportResult.generatedAt,
      generatedBy: 1, // Admin user ID
      status: 'completed'
    });
    
    console.log(`Report saved with ID: ${savedReport.id}`);
    console.log('\nYou can view the report in the UI at:');
    console.log(`/admin/merchants/${merchantId}`);
    
    return savedReport;
    
  } catch (error) {
    console.error('Error generating due diligence report:', error);
  }
}

// Helper function to determine merchant risk score
function determineRiskScore(merchant, contracts, verificationInfo) {
  let riskFactors = 0;
  
  // Verification status
  if (!verificationInfo || verificationInfo.status !== 'verified') {
    riskFactors += 2; // High risk factor for unverified merchants
  }
  
  // Contract history
  if (!contracts || contracts.length === 0) {
    riskFactors += 1; // Moderate risk for no contract history
  }
  
  // Contract payment history (if available)
  const hasLatePayments = contracts?.some(c => c.paymentStatus === 'late');
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

// Run the report generation
generateDueDiligenceReport()
  .then(() => console.log('Script completed.'))
  .catch(err => console.error('Script failed:', err));