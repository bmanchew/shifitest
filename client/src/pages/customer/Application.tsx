import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CustomerLayout from "@/components/layout/CustomerLayout";
import ContractTerms from "@/components/customer/ContractTerms";
import KycVerification from "@/components/customer/KycVerification";
import BankConnection from "@/components/customer/BankConnection";
import PaymentSchedule from "@/components/customer/PaymentSchedule";
import ContractSigning from "@/components/customer/ContractSigning";
import ApplicationSteps, { Step } from "@/components/customer/ApplicationSteps";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Application() {
  const { contractId: contractIdParam } = useParams();
  const contractId = parseInt(contractIdParam || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract URL parameters to handle verification redirects
  const [location, setLocation] = useLocation();
  const urlParams = new URLSearchParams(location.split("?")[1] || "");
  const verifySuccess = urlParams.get("verify") === "success";
  const verifyContractId = parseInt(urlParams.get("contractId") || "0");

  // Mock data for demo purposes when no valid contractId is provided
  const mockContractData = {
    id: 999,
    contractNumber: "SHI-DEMO",
    merchantId: 1,
    customerId: null,
    amount: 2800,
    downPayment: 420,
    financedAmount: 2380,
    termMonths: 24,
    interestRate: 0,
    monthlyPayment: 99.17,
    status: "pending",
    currentStep: "terms",
    merchantName: "TechSolutions Inc.",
    customerName: "Demo Customer",
  };

  const [currentStep, setCurrentStep] = useState("");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [contractData, setContractData] = useState<any>(null);
  const [applicationProgress, setApplicationProgress] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, any>>({});
  const [isHandlingVerification, setIsHandlingVerification] = useState(false);

  // If contractId is valid, fetch real data
  const {
    data: contractResponse,
    isLoading: isLoadingContract,
    refetch,
  } = useQuery({
    queryKey: ["/api/contracts", contractId || verifyContractId],
    queryFn: async () => {
      try {
        const targetId = contractId || verifyContractId;
        if (!targetId || targetId <= 0) return null;

        const res = await fetch(`/api/contracts/${targetId}`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to fetch contract");
        }
        return res.json();
      } catch (error) {
        console.error("Error fetching contract:", error);
        return null;
      }
    },
    enabled: !!(contractId > 0 || verifyContractId > 0),
  });

  // Handle verification redirect
  useEffect(() => {
    if (verifySuccess && verifyContractId > 0 && !isHandlingVerification) {
      setIsHandlingVerification(true);

      const handleVerificationRedirect = async () => {
        try {
          console.log(
            "Handling verification success redirect for contract:",
            verifyContractId,
          );

          // Clear the URL parameters to prevent infinite loops
          const cleanPath = location.split("?")[0];
          setLocation(cleanPath, { replace: true });

          // Refetch the contract data to get the latest progress
          await refetch();

          // Show success toast
          toast({
            title: "Verification Complete",
            description: "Your identity has been successfully verified.",
          });

          try {
            // Get the KYC progress for this contract
            const kycProgressResponse = await apiRequest<{
              id: number;
              contractId: number;
              step: string;
              completed: boolean;
              data: string | null;
            }>("GET", `/api/application-progress/kyc/${verifyContractId}`);

            if (!kycProgressResponse || !kycProgressResponse.id) {
              // Create a new KYC progress record if one doesn't exist
              console.log("No KYC progress record found, creating one...");
              const newProgress = await apiRequest(
                "POST",
                "/api/application-progress",
                {
                  contractId: verifyContractId,
                  step: "kyc",
                  completed: true, // Already completed since we're in the redirect handler
                  data: JSON.stringify({
                    verifiedAt: new Date().toISOString(),
                    status: "approved",
                    completedVia: "redirect_new_record",
                  }),
                },
              );

              console.log("Created new KYC progress record:", newProgress);
            } else if (!kycProgressResponse.completed) {
              // If not already marked as completed, mark it complete
              console.log("Marking KYC as completed from redirect handler");
              await apiRequest(
                "PATCH",
                `/api/application-progress/${kycProgressResponse.id}`,
                {
                  completed: true,
                  data: JSON.stringify({
                    verifiedAt: new Date().toISOString(),
                    status: "approved",
                    completedVia: "redirect",
                  }),
                },
              );
            }

            // Refresh contract data
            await refetch();

            // Wait for contract data to load before updating steps
            setTimeout(() => {
              // Add KYC to completed steps if not already there
              setCompletedSteps((prev) => {
                if (!prev.includes("kyc")) {
                  return [...prev, "kyc"];
                }
                return prev;
              });

              // Move to the next step if currently on KYC
              if (currentStep === "kyc") {
                console.log("Moving from KYC step to bank step");
                setCurrentStep("bank");
              }

              setIsHandlingVerification(false);
            }, 1000); // Longer delay for more reliability
          } catch (progressError) {
            console.error("Error handling progress record:", progressError);

            // Still try to move forward even if there was an error
            setCompletedSteps((prev) => {
              if (!prev.includes("kyc")) {
                return [...prev, "kyc"];
              }
              return prev;
            });

            if (currentStep === "kyc") {
              console.log("Moving from KYC step to bank step despite error");
              setCurrentStep("bank");
            }

            setIsHandlingVerification(false);
          }
        } catch (error) {
          console.error("Error handling verification redirect:", error);
          setIsHandlingVerification(false);

          // Show error toast
          toast({
            title: "Verification Error",
            description:
              "There was a problem processing your verification. Please try again.",
            variant: "destructive",
          });
        }
      };

      handleVerificationRedirect();
    }
  }, [verifySuccess, verifyContractId, location, toast, refetch, currentStep]);

  // When contract data loads, set up the application state
  useEffect(() => {
    if (contractResponse) {
      // Real contract data
      const { contract, progress } = contractResponse;

      // Get merchant name (in a real app would be fetched from API)
      let merchantName = "TechSolutions Inc.";
      // Get customer name (in a real app would be fetched from API)
      let customerName = "Customer";

      setContractData({
        ...contract,
        merchantName,
        customerName,
      });

      setApplicationProgress(progress);

      // Create a map for easier access to progress items
      const progressMapObj: Record<string, any> = {};
      progress.forEach((item: any) => {
        progressMapObj[item.step] = item;
      });
      setProgressMap(progressMapObj);

      // Set current step from contract
      setCurrentStep(contract.currentStep);

      // Set completed steps
      const completed = progress
        .filter((item: any) => item.completed)
        .map((item: any) => item.step);
      setCompletedSteps(completed);
    } else if (!isLoadingContract) {
      // If no contract was found and we're not still loading, 
      // then redirect to the contract lookup page
      if (contractId <= 0) {
        console.log("No contract ID provided, redirecting to contract lookup page");
        setLocation("/customer/contract-lookup");
        return;
      }
      
      // If we have a contractId but no contract was found, show an error
      toast({
        title: "Contract Not Found",
        description: "We couldn't find this contract. Please check your link or enter your phone number to find your application.",
        variant: "destructive",
      });
      
      // Redirect to contract lookup after showing the error
      setTimeout(() => {
        setLocation("/customer/contract-lookup");
      }, 2000);
    }
  }, [contractResponse, isLoadingContract, contractId, toast, setLocation]);

  // All application steps
  const steps: Step[] = [
    {
      id: "terms",
      title: "Review Contract Terms",
      description: "Review and accept financing terms",
    },
    {
      id: "kyc",
      title: "Identity Verification",
      description: "Complete KYC with DiDit",
    },
    {
      id: "bank",
      title: "Bank Connection",
      description: "Connect your bank account via Plaid",
    },
    {
      id: "payment",
      title: "Payment Schedule",
      description: "Confirm your payment schedule",
    },
    {
      id: "signing",
      title: "Contract Signing",
      description: "Sign your retail installment contract",
    },
  ];

  // Calculate the next step after completing the current one
  const getNextStep = (currentStep: string): string => {
    const stepIndex = steps.findIndex((step) => step.id === currentStep);
    if (stepIndex < steps.length - 1) {
      return steps[stepIndex + 1].id;
    }
    return "completed";
  };

  // Calculate the progress percentage
  const calculateProgress = (): number => {
    if (!contractData) return 0;

    const totalSteps = steps.length;
    const completedCount = completedSteps.length;

    if (currentStep === "completed" || completedCount === totalSteps) {
      return 100;
    }

    return Math.round((completedCount / totalSteps) * 100);
  };

  // Calculate the current step number (1-based)
  const getCurrentStepNumber = (): number => {
    if (!contractData) return 1;

    if (currentStep === "completed") {
      return steps.length;
    }

    const stepIndex = steps.findIndex((step) => step.id === currentStep);
    return stepIndex >= 0 ? stepIndex + 1 : 1;
  };

  // Handle completion of a step
  const handleCompleteStep = async () => {
    if (!contractData) return;

    // Add current step to completed steps if not already there
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => [...prev, currentStep]);
    }

    // Get the next step
    const nextStep = getNextStep(currentStep);

    try {
      // In a real app, update the contract step on the server
      if (contractData.id > 0) {
        await apiRequest("PATCH", `/api/contracts/${contractData.id}/step`, {
          step: nextStep,
        });

        // Refresh contract data
        queryClient.invalidateQueries(["/api/contracts", contractData.id]);
      }

      // Move to the next step
      setCurrentStep(nextStep);
    } catch (error) {
      console.error("Error updating contract step:", error);
      toast({
        title: "Error",
        description: "There was a problem updating your application progress.",
        variant: "destructive",
      });

      // Still move to next step in UI for better user experience
      setCurrentStep(nextStep);
    }
  };

  // Navigate to dashboard after completion
  const navigateToDashboard = () => {
    if (!contractData || !contractData.contract) {
      console.error('Contract data not available for dashboard redirect');
      return;
    }

    // Add points for ACH setup if bank connection is completed
    if (completedSteps.includes('bank')) {
      apiRequest('POST', `/api/contracts/${contractData.contract.id}/points`, {
        points: 500,
        reason: 'ach_setup_bonus'
      });
    }

    window.location.href = `/dashboard/${contractData.contract.id}`;
  };

  // Handle going back to the previous step
  const handleGoBack = () => {
    if (!contractData) return;

    const currentIndex = steps.findIndex((step) => step.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id);
    }
  };

  // Handle completion of all steps
  useEffect(() => {
    if (currentStep === "completed" && contractData && contractData.contract) {
      navigateToDashboard();
    }
  }, [currentStep, contractData]);

  // If still loading contract data, show loading state
  if (!contractData) {
    return (
      <CustomerLayout>
        <div className="p-6 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
            <p className="mt-4 text-sm text-gray-600">Loading application...</p>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  // Render different content based on current step
  const renderStepContent = () => {
    // Check if this step is already completed
    const isCurrentStepCompleted = completedSteps.includes(currentStep);
    console.log(
      "Current step:",
      currentStep,
      "Completed:",
      isCurrentStepCompleted,
      "Completed steps:",
      completedSteps,
    );

    // If already completed, move to the next step automatically
    if (isCurrentStepCompleted && currentStep !== "completed") {
      console.log("Step already completed, moving to next...");
      const nextStep = getNextStep(currentStep);

      // Use setTimeout to avoid immediate state update during render
      setTimeout(() => {
        setCurrentStep(nextStep);
      }, 100);
    }

    switch (currentStep) {
      case "terms":
        return (
          <ContractTerms
            contractId={contractData.id}
            progressId={progressMap.terms?.id || 0}
            merchantName={contractData.merchantName}
            amount={contractData.amount}
            downPayment={contractData.downPayment}
            financedAmount={contractData.financedAmount}
            termMonths={contractData.termMonths}
            interestRate={contractData.interestRate}
            monthlyPayment={contractData.monthlyPayment}
            onComplete={handleCompleteStep}
            onBack={handleGoBack}
          />
        );
      case "kyc":
        return (
          <KycVerification
            contractId={contractData.id}
            progressId={progressMap.kyc?.id || 0}
            onComplete={handleCompleteStep}
            onBack={handleGoBack}
          />
        );
      case "bank":
        return (
          <BankConnection
            contractId={contractData.id}
            progressId={progressMap.bank?.id || 0}
            onComplete={handleCompleteStep}
            onBack={handleGoBack}
          />
        );
      case "payment":
        return (
          <PaymentSchedule
            contractId={contractData.id}
            progressId={progressMap.payment?.id || 0}
            amount={contractData.amount}
            downPayment={contractData.downPayment}
            financedAmount={contractData.financedAmount}
            termMonths={contractData.termMonths}
            monthlyPayment={contractData.monthlyPayment}
            onComplete={handleCompleteStep}
            onBack={handleGoBack}
          />
        );
      case "signing":
        return (
          <ContractSigning
            contractId={contractData.id}
            progressId={progressMap.signing?.id || 0}
            contractNumber={contractData.contractNumber}
            customerName={contractData.customerName}
            onComplete={handleCompleteStep}
            onBack={handleGoBack}
          />
        );
      case "completed":
        return (
          <div className="p-6 text-center">
            <div className="py-12">
              <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-green-100 mb-8">
                <svg
                  className="h-12 w-12 text-green-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                Application Complete!
              </h3>
              <p className="text-gray-600 mb-6">
                Your ShiFi financing has been approved and your contract is now
                active.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-medium text-blue-800 mb-2">
                  Contract Summary
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">Contract Number:</div>
                  <div className="font-medium text-gray-900">
                    {contractData.contractNumber}
                  </div>

                  <div className="text-gray-600">Amount Financed:</div>
                  <div className="font-medium text-gray-900">
                    ${contractData.financedAmount.toFixed(2)}
                  </div>

                  <div className="text-gray-600">Down Payment:</div>
                  <div className="font-medium text-gray-900">
                    ${contractData.downPayment.toFixed(2)}
                  </div>

                  <div className="text-gray-600">Term:</div>
                  <div className="font-medium text-gray-900">
                    {contractData.termMonths} months
                  </div>

                  <div className="text-gray-600">Monthly Payment:</div>
                  <div className="font-medium text-gray-900">
                    ${contractData.monthlyPayment.toFixed(2)}
                  </div>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                You'll receive a confirmation email with all the details and a
                copy of your signed contract.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button
                  onClick={() => {
                    toast({
                      title: "Success",
                      description:
                        "Your contract details have been emailed to you.",
                    });
                  }}
                >
                  Download Contract
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    toast({
                      title: "Redirecting",
                      description: "Returning to merchant website...",
                    });
                  }}
                >
                  Return to Merchant
                </Button>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="p-6 text-center">
            <p>Unknown application step. Please start over.</p>
          </div>
        );
    }
  };

  // Show the application progress view if we're on the application flow steps
  if (currentStep !== "completed") {
    return (
      <CustomerLayout
        currentStep={getCurrentStepNumber()}
        totalSteps={steps.length}
        progress={calculateProgress()}
      >
        {renderStepContent()}
      </CustomerLayout>
    );
  }

  // Show the completed screen
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}