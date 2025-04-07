/**
 * This script generates both a due diligence report and checks for Plaid asset reports
 * for a specific merchant to make them visible in the UI
 */

const { dueDiligenceService } = require('./server/services/dueDiligence');
const { storage } = require('./server/storage');
const { plaidService } = require('./server/services/plaid');

async function generateReports() {
  try {
    console.log('Starting report generation...');
    
    // Let's try merchant ID 28 first (the one you were viewing) or fallback to 49 (Brandon)
    const merchantIds = [28, 49]; 
    let merchant = null;
    let merchantId = null;
    
    // Find the first valid merchant
    for (const id of merchantIds) {
      const foundMerchant = await storage.getMerchant(id);
      if (foundMerchant) {
        merchant = foundMerchant;
        merchantId = id;
        break;
      }
    }
    
    if (!merchant) {
      console.error('No valid merchant found. Please check merchant IDs.');
      return;
    }
    
    console.log(`Using merchant: ${merchant.name} (ID: ${merchantId})`);
    
    // 1. Generate Due Diligence Report
    if (dueDiligenceService.isInitialized()) {
      console.log('Generating due diligence report...');
      
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
          .reduce((sum, contract) => sum + (contract.amount || 0), 0)
      };
      
      const reportResult = await dueDiligenceService.generateDueDiligenceReport(enrichedMerchantData);
      
      if (reportResult.success) {
        console.log('Due diligence report generated successfully!');
        console.log(`Report length: ${reportResult.report.length} characters`);
        
        // Save the report in the database
        const savedReport = await storage.saveDueDiligenceReport({
          merchantId: merchantId,
          report: reportResult.report,
          generatedAt: reportResult.generatedAt,
          generatedBy: 1, // Admin user ID
          status: 'completed'
        });
        
        console.log(`Report saved with ID: ${savedReport.id}`);
      } else {
        console.error('Failed to generate due diligence report:', reportResult.error);
      }
    } else {
      console.warn('Due diligence service is not initialized. OpenAI API key may be missing.');
    }
    
    // 2. Check for Plaid Asset Reports
    console.log('\nChecking Plaid asset reports...');
    
    const businessDetails = await storage.getMerchantBusinessDetailsByMerchantId(merchantId);
    
    if (businessDetails?.plaidAssetReportId) {
      console.log(`Merchant has Plaid Asset Report ID: ${businessDetails.plaidAssetReportId}`);
    } else {
      console.log('No Plaid Asset Report found for this merchant.');
    }
    
    // 3. Check MidDesk verification
    console.log('\nChecking MidDesk verification...');
    
    if (businessDetails?.middeskBusinessId) {
      console.log(`Merchant has MidDesk Business ID: ${businessDetails.middeskBusinessId}`);
      console.log(`Verification status: ${businessDetails.verificationStatus || 'unknown'}`);
    } else {
      console.log('No MidDesk verification found for this merchant.');
    }
    
    // 4. List merchant report access endpoints
    console.log('\nTo view reports in the UI, navigate to:');
    console.log(`- Due Diligence: /admin/merchants/${merchantId}/due-diligence`);
    console.log(`- Asset Reports: /admin/merchants/${merchantId}/verification`);
    console.log(`- Full Merchant Detail: /admin/merchants/${merchantId}`);
    
  } catch (error) {
    console.error('Error in report generation:', error);
  }
}

// Run the function
generateReports();