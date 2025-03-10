
import fetch from 'node-fetch';
import { logger } from './services/logger';

// This script simulates what happens when an application link gets clicked
async function testApplicationRedirect() {
  try {
    // Get the base URL dynamically from environment
    const baseUrl = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
    const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
    
    // Step 1: Create a test contract to get a contract ID
    logger.info({
      message: "Creating test contract for redirect flow simulation",
      category: "test",
    });
    
    const createContractResponse = await fetch(`${protocol}://${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: 1,
        amount: 1000,
        downPayment: 150,
        financedAmount: 850,
        termMonths: 24,
        interestRate: 0,
        monthlyPayment: 35.42,
        status: "pending",
        currentStep: "terms"
      })
    });
    
    if (!createContractResponse.ok) {
      throw new Error(`Failed to create test contract: ${createContractResponse.status} ${createContractResponse.statusText}`);
    }
    
    const contract = await createContractResponse.json();
    const contractId = contract.id;
    
    logger.info({
      message: `Test contract created with ID: ${contractId}`,
      category: "test",
      metadata: { contractId, contractNumber: contract.contractNumber }
    });
    
    // Step 2: Simulate accessing the application URL
    const applicationUrl = `${protocol}://${baseUrl}/apply/${contractId}`;
    logger.info({
      message: `Simulating access to application URL: ${applicationUrl}`,
      category: "test",
    });
    
    // Test initial application load
    const applicationResponse = await fetch(applicationUrl);
    if (!applicationResponse.ok) {
      logger.error({
        message: `Failed to access application URL: ${applicationResponse.status} ${applicationResponse.statusText}`,
        category: "test",
        metadata: { applicationUrl }
      });
    } else {
      logger.info({
        message: "Successfully accessed application URL",
        category: "test",
        metadata: { applicationUrl, status: applicationResponse.status }
      });
    }
    
    // Step 3: Simulate KYC verification redirect by creating a DiDit session and accessing its callback
    logger.info({
      message: "Simulating KYC verification redirect flow",
      category: "test",
    });
    
    const kycSessionResponse = await fetch(`${protocol}://${baseUrl}/api/kyc/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId })
    });
    
    if (!kycSessionResponse.ok) {
      logger.error({
        message: `Failed to create KYC session: ${kycSessionResponse.status} ${kycSessionResponse.statusText}`,
        category: "test",
      });
    } else {
      const kycSession = await kycSessionResponse.json();
      logger.info({
        message: "KYC verification session created",
        category: "test",
        metadata: { 
          sessionId: kycSession.session?.session_id,
          sessionUrl: kycSession.session?.session_url
        }
      });
      
      // Step 4: Simulate verification completion by triggering the webhook
      const webhookResponse = await fetch(`${protocol}://${baseUrl}/api/kyc/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: "verification.completed",
          session_id: kycSession.session?.session_id || "test_session_id",
          status: "approved",
          decision: {
            status: "approved"
          },
          vendor_data: contractId.toString(),
          customer_details: {
            first_name: "Test",
            last_name: "User",
            email: "test@example.com"
          }
        })
      });
      
      if (webhookResponse.ok) {
        logger.info({
          message: "Successfully simulated KYC webhook completion",
          category: "test",
          metadata: { status: webhookResponse.status }
        });
      } else {
        logger.error({
          message: `Webhook simulation failed: ${webhookResponse.status} ${webhookResponse.statusText}`,
          category: "test",
        });
      }
    }
    
    // Step 5: Check if application progress was updated after the webhook
    const progressResponse = await fetch(`${protocol}://${baseUrl}/api/application-progress?contractId=${contractId}`);
    if (progressResponse.ok) {
      const progress = await progressResponse.json();
      logger.info({
        message: "Application progress after redirect simulation",
        category: "test",
        metadata: { progress: JSON.stringify(progress) }
      });
    }
    
    logger.info({
      message: "Application redirect flow test completed",
      category: "test",
      metadata: { contractId }
    });
    
    return {
      success: true,
      contractId,
      applicationUrl,
      message: "Application redirect flow test completed successfully"
    };
  } catch (error) {
    logger.error({
      message: `Error in application redirect test: ${error instanceof Error ? error.message : String(error)}`,
      category: "test",
      metadata: { 
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Run the test
testApplicationRedirect()
  .then(result => {
    console.log("Test complete:", result);
    if (result.success) {
      console.log(`\nTo manually test the application, open this URL in your browser:\n${result.applicationUrl}`);
    }
  })
  .catch(err => {
    console.error("Test failed:", err);
  });
