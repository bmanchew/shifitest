import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
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

const CONTRACT_STEPS = ["terms", "kyc", "bank", "payment", "signing"]; // Define CONTRACT_STEPS constant

export default function Application() {
  const { contractId: contractIdParam } = useParams();
  const contractId = contractIdParam ? parseInt(contractIdParam) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Extract URL parameters to handle verification redirects
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const verifySuccess = urlParams.get("verify") === "success";
  const verifyContractId = parseInt(urlParams.get("contractId") || "0");

  // Debug log to see what's happening with IDs
  console.log("Application component loaded with:", { 
    contractIdParam, 
    contractId, 
    verifyContractId, 
    pathname: location.pathname 
  });

  // Redirect to contract lookup page if contractId is undefined or invalid
  useEffect(() => {
    if (contractIdParam === "undefined" || !contractId) {
      console.error("Invalid contract ID in URL:", contractIdParam);
      toast({
        title: "Error",
        description: "Invalid contract link. Please check your SMS and try again.",
        variant: "destructive",
      });
      navigate("/customer/contract-lookup");
    }
  }, [contractIdParam, contractId, navigate, toast]);

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
    isError: isErrorContract,
    error: errorContract,
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
          navigate(location.pathname, { replace: true });

          // Refetch the contract data to get the latest progress
          await refetch();

          // Show success toast
          toast({
            title: "Verification Complete",
            description: "Your identity has been successfully verified.",
          });

          // Get the KYC progress for this contract
          const kycProgressResponse = await apiRequest<{
            id: number;
            contractId: number;
            step: string;
            completed: boolean;
            data: string | null;
          }>("GET", `/api/application-progress/kyc/${verifyContractId}`);

          if (kycProgressResponse) {
            try {
              // Always mark as completed when redirected from verification
              console.log("Marking KYC as completed from redirect handler", kycProgressResponse);

              // Update the progress status
              const progressUpdateResponse = await apiRequest(
                "PATCH",
                `/api/application-progress/${kycProgressResponse.id}`,
                {
                  completed: true,
                  data: JSON.stringify({
                    verified: true,
                    verifiedAt: new Date().toISOString(),
                    status: "approved",
                    completedVia: "redirect",
                  }),
                },
              );

              console.log("Progress update response:", progressUpdateResponse);

              // Also update the contract step to move to "bank"
              const stepUpdateResponse = await apiRequest(
                "PATCH",
                `/api/contracts/${verifyContractId}/step`,
                {
                  step: "bank"
                }
              );

              console.log("Contract step update response:", stepUpdateResponse);

              // Force refresh contract data
              await refetch();

              // Add a small delay to ensure the UI updates properly
              setTimeout(() => {
                // Correctly navigate to the application with the contractId and step
                navigate(`/apply/${verifyContractId}?step=bank`);
              }, 500);
            } catch (error) {
              console.error("Error updating KYC verification status:", error);
              alert("Your verification was completed, but we encountered an issue updating your application. Please refresh the page.");
            }
          } else {
            console.error("Could not find KYC progress for contract", verifyContractId);
            alert("Your verification was completed, but we couldn't find your application data. Please refresh the page.");
          }

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
              setCurrentStep("bank");
            }

            // Show success message using toast
            toast({
              title: "Identity Verification Complete",
              description: "Your identity has been successfully verified"
            });

            setIsHandlingVerification(false);
          }, 500);
        } catch (error) {
          console.error("Error handling verification redirect:", error);
          setIsHandlingVerification(false);
        }
      };

      handleVerificationRedirect();
    }
  }, [verifySuccess, verifyContractId, location, toast, refetch, currentStep, navigate]);

  // Effect to set up contract data and application progress
  useEffect(() => {
    if (contractResponse?.contract) {
      // Valid contract found from API
      console.log("Valid contract data received:", contractResponse.contract.id);
      setContractData(contractResponse.contract);

      // Create a progress map
      const progressMapObj: Record<string, any> = {};
      contractResponse.progress.forEach((item: any) => {
        progressMapObj[item.step] = item;
      });
      setProgressMap(progressMapObj);
      setApplicationProgress(contractResponse.progress);

      // Set the current step based on progress
      if (contractResponse.progress.length === 0) {
        setCurrentStep("terms");
      } else {
        // Find the first incomplete step
        const incompleteStep = CONTRACT_STEPS.find(
          (step) => !progressMapObj[step]?.completed
        );

        if (incompleteStep) {
          setCurrentStep(incompleteStep);
        } else {
          setCurrentStep("completed");
        }
      }

      // Set completed steps
      const completed = contractResponse.progress
        .filter((item: any) => item.completed)
        .map((item: any) => item.step);
      setCompletedSteps(completed);
    } else if (isErrorContract) {
      // Handle fetch errors
      console.error("Error fetching contract:", errorContract);
      // Don't return here, just continue to render the component
      console.log(`Contract error for ID ${contractId}, but not redirecting`);
    } else if (!isLoadingContract && !contractResponse?.contract) {
      // Contract not found but API request completed
      console.error(`Contract with ID ${contractId} not found in API response`);

      // Log more details for debugging
      console.log("Contract API response:", contractResponse);
      console.log("Contract ID from URL:", contractIdParam);
      console.log("Parsed Contract ID:", contractId);
    }
  }, [contractResponse, isLoadingContract, navigate, isErrorContract, contractId, contractIdParam]);

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
  const handleCompleteStep = async (stepId: string, nextStep?: string) => {
    if (!contractData) {
      console.error("Cannot complete step: contractData is undefined");
      return;
    }

    // Calculate the next step if not provided
    const calculatedNextStep = nextStep || getNextStep(stepId);
    console.log(`Contract ID: ${contractData.id}, Completed step: ${stepId}, moving to: ${calculatedNextStep}`);

    try {
      // Update contract step in the database if we're moving to a new step
      if (calculatedNextStep !== "completed") {
        console.log(`Updating contract ${contractData.id} step to ${calculatedNextStep}`);
        await apiRequest(
          "PATCH",
          `/api/contracts/${contractData.id}/step`,
          { step: calculatedNextStep }
        );
      } else {
        // If completing the final step, update contract status to active
        console.log(`Setting contract ${contractData.id} status to active`);
        await apiRequest(
          "PATCH",
          `/api/contracts/${contractData.id}/status`,
          { status: "active" }
        );
      }

      // Update the list of completed steps
      setCompletedSteps((prev) => {
        if (prev.includes(stepId)) return prev;
        return [...prev, stepId];
      });

      // Move to the next step
      setCurrentStep(calculatedNextStep);
      console.log(`Successfully moved to step ${calculatedNextStep} for contract ${contractData.id}`);
    } catch (error) {
      console.error(`Error updating contract ${contractData.id} step:`, error);
      toast({
        title: "Error",
        description: "There was a problem updating your application progress.",
        variant: "destructive",
      });

      // Still move to next step in UI for better user experience
      setCurrentStep(calculatedNextStep);
    }
  };

  // Handle going back to the previous step
  const handleGoBack = () => {
    if (!contractData) return;

    const currentIndex = steps.findIndex((step) => step.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id);
    }
  };

  // If still loading contract data, show loading state
  if (isLoadingContract) {
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