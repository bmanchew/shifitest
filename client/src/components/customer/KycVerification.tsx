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
  const verificationWindowRef = useRef<Window | null>(null);

  // Check verification status periodically
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
          completeVerification();
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
  }, [sessionId, step, contractId]);

  // Complete the verification process
  const completeVerification = async () => {
    try {
      setStep("complete");

      // After a short delay, move to the next step in the application
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error("Error updating verification status:", error);
      toast({
        title: "Verification Error",
        description:
          "There was an error completing your verification. Please try again.",
        variant: "destructive",
      });
      setStep("instructions");
    }
  };

  // Start the verification process with DiDit
  const startVerification = async () => {
    try {
      setIsLoading(true);

      // Get the current KYC progress ID for this contract
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

      // Call our API endpoint to create a DiDit verification session
      const response = await apiRequest<{
        success: boolean;
        session: {
          session_id: string;
          session_url?: string;
          url?: string;
          redirect_url?: string;
          status: string;
        };
      }>("POST", "/api/kyc/create-session", {
        contractId,
      });

      if (!response?.success || !response.session) {
        throw new Error("Failed to create verification session");
      }

      const { session } = response;

      console.log("KYC verification session created:", session);

      // Get the verification URL from either url or session_url property
      const sessionUrl = session.url || session.session_url;
      console.log("Verification URL:", sessionUrl);

      if (!sessionUrl) {
        throw new Error("No verification URL provided in session response");
      }

      setSessionId(session.session_id);
      setVerificationUrl(sessionUrl);

      // Update application progress to track that verification has started
      await apiRequest(
        "PATCH",
        `/api/application-progress/${kycProgressResponse.id}`,
        {
          completed: false,
          data: JSON.stringify({
            verificationStarted: new Date().toISOString(),
            sessionId: session.session_id,
            sessionUrl: sessionUrl,
          }),
        },
      );

      // Update UI to show verification in progress
      setStep("verifying_external");

      // Open the verification URL in a new window
      console.log("Opening verification URL:", sessionUrl);
      const verificationWindow = window.open(
        sessionUrl,
        "_blank",
        "width=500,height=600",
      );

      if (
        !verificationWindow ||
        verificationWindow.closed ||
        typeof verificationWindow.closed === "undefined"
      ) {
        // If popup was blocked, show a message with link instead
        toast({
          title: "Popup Blocked",
          description:
            "Please allow popups for this site and try again, or click the button below to open verification.",
          variant: "destructive",
        });
      } else {
        // Store the window reference
        verificationWindowRef.current = verificationWindow;
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error creating verification session:", error);
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
                  We'll need to take a photo of your face to match with your ID
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
              <h2 className="text-xl font-semibold">External Verification</h2>
              <p className="text-sm text-gray-600">
                We've opened the DiDit verification page in a new window. Please
                complete the verification process there.
              </p>
              <p className="text-sm text-gray-600">
                If the verification window was blocked or you closed it, you can
                open it again with the button below.
              </p>
              <Button
                onClick={() => {
                  if (verificationUrl) {
                    console.log(
                      "Re-opening verification URL:",
                      verificationUrl,
                    );
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
                Your identity has been successfully verified. You may now
                proceed with your application.
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
