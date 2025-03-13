import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ShieldCheck, Check } from "lucide-react";

interface KycVerificationProps {
  contractId: number;
  progressId: number;
  onComplete: () => void;
  onBack: () => void;
}

export default function KycVerification({
  contractId,
  progressId,
  onComplete,
  onBack,
}: KycVerificationProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<
    "instructions" | "verifying_external" | "complete"
  >("instructions");
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [alreadyVerified, setAlreadyVerified] = useState<boolean>(false);
  const verificationWindowRef = useRef<Window | null>(null);

  // Check verification status periodically when waiting for external verification
  useEffect(() => {
    if (!sessionId || step !== "verifying_external") return;

    const checkVerificationStatus = async () => {
      try {
        // Get the current KYC progress for this contract
        const kycProgressResponse = await apiRequest<{
          id: number;
          contractId: number;
          step: string;
          completed: boolean;
          data: string | null;
        }>("GET", `/api/application-progress/kyc/${contractId}`);

        if (kycProgressResponse?.completed) {
          console.log("Verification completed, detected via polling");
          setStep("complete");
          // Wait a moment then move to next step
          setTimeout(onComplete, 2000);
        }
      } catch (error) {
        console.error("Error checking verification status:", error);
      }
    };

    // Check every 5 seconds
    const intervalId = setInterval(checkVerificationStatus, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [sessionId, step, contractId, onComplete]);

  // Start the verification process
  const startVerification = async () => {
    try {
      setIsLoading(true);

      // Get the current KYC progress for this contract
      const kycProgressResponse = await apiRequest<{
        id: number;
        contractId: number;
        step: string;
        completed: boolean;
        data: string | null;
      }>("GET", `/api/application-progress/kyc/${contractId}`);

      if (!kycProgressResponse || !kycProgressResponse.id) {
        throw new Error("Could not find KYC progress for this contract");
      }

      const kycProgressId = kycProgressResponse.id;

      // If verification is already completed, go to the next step
      if (kycProgressResponse.completed) {
        console.log("KYC already completed for this contract, moving to next step");
        setStep("complete");
        setTimeout(onComplete, 1000);
        setIsLoading(false);
        return;
      }

      // Create a verification session
      console.log("Creating verification session for contract", contractId);

      // Get phone number from contract if available
      const contractResponse = await apiRequest<any>("GET", `/api/contracts/${contractId}`);
      const phoneNumber = contractResponse?.contract?.phoneNumber;

      const sessionResponse = await apiRequest<{
        success: boolean;
        alreadyVerified?: boolean;
        userId?: number;
        message?: string;
        session?: {
          session_id: string;
          session_url: string;
        };
      }>("POST", "/api/kyc/create-session", {
        contractId,
        phoneNumber,
      });

      if (!sessionResponse || !sessionResponse.success) {
        throw new Error("Failed to create verification session");
      }

      // Check if the user is already verified
      if (sessionResponse.alreadyVerified) {
        console.log("User already verified:", sessionResponse.message);
        setAlreadyVerified(true);
        setUserId(sessionResponse.userId || null);

        // Mark the KYC step as completed in the UI
        setStep("complete");

        // Mark the KYC step as completed in the backend if it's not already
        if (!kycProgressResponse.completed) {
          await apiRequest("PATCH", `/api/application-progress/${kycProgressId}`, {
            completed: true,
            data: JSON.stringify({
              verified: true,
              verifiedAt: new Date().toISOString(),
              completedVia: "existing_verification",
              userId: sessionResponse.userId,
              message: sessionResponse.message,
            }),
          });
        }

        // Wait a moment then move to next step
        setTimeout(onComplete, 1000);
        setIsLoading(false);
        return;
      }

      // Regular flow - user needs to be verified
      const { session } = sessionResponse;
      setSessionId(session.session_id);

      // Open verification URL in a new window or redirect
      console.log("Opening verification URL:", session.session_url);
      setVerificationUrl(session.session_url);

      // Update UI state
      setStep("verifying_external");

      // Open verification in new window/tab or iframe
      if (window.innerWidth > 768) {
        verificationWindowRef.current = window.open(
          session.session_url,
          "didit_verification",
          "width=500,height=700"
        );
      } else {
        // On mobile, redirect to the verification URL (full screen)
        window.location.href = session.session_url;
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error starting verification:", error);
      toast({
        title: "Verification Error",
        description:
          "Could not start the identity verification process. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6 max-w-lg mx-auto">
      {/* Instructions Step */}
      {step === "instructions" && (
        <div className="w-full space-y-6">
          <div className="bg-primary/5 rounded-lg p-6 border border-primary/20">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Identity Verification</h2>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              We need to verify your identity before proceeding with your
              financing application. This process is secure and typically takes
              less than 2 minutes.
            </p>

            <div className="space-y-3 mb-4">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-primary/10 rounded-full mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm">
                  You'll need a valid government-issued ID (driver's license,
                  passport, or national ID)
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-primary/10 rounded-full mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm">
                  You'll need to take a photo of your face to match with your ID
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-primary/10 rounded-full mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm">
                  This verification is provided by DiDit, our secure identity
                  verification partner
                </p>
              </div>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button variant="outline" onClick={onBack}>
                Back
              </Button>
              <Button onClick={startVerification} disabled={isLoading}>
                {isLoading ? "Starting Verification..." : "Start Verification"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* External Verification Step */}
      {step === "verifying_external" && (
        <div className="w-full space-y-6">
          <div className="bg-primary/5 rounded-lg p-6 border border-primary/20 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <ShieldCheck className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Identity Verification</h2>
              <p className="text-sm text-gray-600">
                We've opened the verification page in a new window. Please
                complete the verification process there.
              </p>
              <p className="text-sm text-gray-600">
                If the verification window was blocked or you closed it, you can
                open it again with the button below.
              </p>
              <Button
                onClick={() => {
                  if (verificationUrl) {
                    const newWindow = window.open(
                      verificationUrl,
                      "_blank",
                      "width=500,height=600",
                    );
                    verificationWindowRef.current = newWindow;
                  }
                }}
                disabled={!verificationUrl}
              >
                Open Verification Window
              </Button>
              <div className="border-t border-gray-200 w-full pt-4 mt-4">
                <p className="text-sm text-gray-500">
                  After completing verification, you'll be automatically
                  redirected back to continue your application.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Step */}
      {step === "complete" && (
        <div className="w-full space-y-6">
          <div className="bg-primary/5 rounded-lg p-6 border border-primary/20 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-green-100 rounded-full">
                <Check className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold">Verification Complete</h2>
              <p className="text-sm text-gray-600">
                {alreadyVerified 
              ? "Your identity has already been verified in our system. No additional verification needed."
              : "Your identity has been successfully verified. You may now proceed with your application."}
              </p>
              <p className="text-sm text-green-500 font-medium">
                Moving to the next step automatically...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}