import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Building,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { usePlaidLink } from "react-plaid-link";

interface BankConnectionProps {
  contractId: number;
  progressId: number;
  onComplete: () => void;
  onBack: () => void;
}

export default function BankConnection({
  contractId,
  progressId,
  onComplete,
  onBack,
}: BankConnectionProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<"intro" | "connecting" | "success">("intro");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  // Fetch a link token when the component loads
  useEffect(() => {
    const getLinkToken = async () => {
      try {
        setIsLoadingToken(true);

        // Request a link token from our backend
        const response = await apiRequest<{
          success: boolean;
          linkToken: string;
          message?: string; // Added to capture error messages from the server
        }>("POST", "/api/plaid/create-link-token", {
          userId: `user-${contractId}`, // Use contract ID as user ID for now
          userName: "Customer", // Optional
          products: ["auth"], // Specify the Plaid products we need
        });

        if (!response.success) {
          //Improved error handling for 500 errors and other non-success cases
          const errorMessage = response.message || "Failed to get link token";
          console.error("Failed to get link token:", errorMessage);
          toast({
            title: "Connection Error",
            description: errorMessage,
            variant: "destructive",
          });
          throw new Error(errorMessage); // Re-throw to handle in the catch block
        }

        if (!response.linkToken) {
          throw new Error("Link token missing in response");
        }

        setLinkToken(response.linkToken);
      } catch (error) {
        console.error("Error getting link token:", error);
        toast({
          title: "Connection Error",
          description:
            "We're having trouble connecting to our payment provider. Please try again later.",
          variant: "destructive",
        });
        // Reset link token on error
        setLinkToken(null);
      } finally {
        setIsLoadingToken(false);
      }
    };

    getLinkToken();
  }, [contractId, toast]);

  // Handler for successful Plaid Link completion
  const handlePlaidSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      try {
        setStep("connecting");
        setIsConnecting(true);

        console.log("Plaid Link success:", metadata);

        // Exchange the public token for an access token and get bank details
        const response = await apiRequest<{
          success: boolean;
          accounts: any[];
          itemId: string;
          message: string;
        }>("POST", "/api/plaid/set-access-token", {
          publicToken,
          contractId,
          // Include selected institution and account metadata
          institutionId: metadata.institution.institution_id,
          institutionName: metadata.institution.name,
          accountId: metadata.accounts[0]?.id, // Use the first account
        });

        if (!response.success) {
          throw new Error("Failed to set access token");
        }

        // Success! The backend has stored the account info
        setStep("success");

        // After a short delay, move to the next step in the parent
        setTimeout(() => {
          onComplete();
        }, 2000);
      } catch (error) {
        console.error("Bank connection failed:", error);
        toast({
          title: "Connection Failed",
          description: "We couldn't connect to your bank. Please try again.",
          variant: "destructive",
        });
        setStep("intro");
      } finally {
        setIsConnecting(false);
      }
    },
    [contractId, onComplete, toast],
  );

  // Configure the Plaid Link hook
  const { open, ready } = usePlaidLink({
    token: linkToken || "",
    onSuccess: (public_token, metadata) => {
      handlePlaidSuccess(public_token, metadata);
    },
    onExit: (err, metadata) => {
      console.log("Plaid Link exit:", err, metadata);
      if (err) {
        toast({
          title: "Connection Interrupted",
          description:
            "The bank connection process was interrupted. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Handle the "Connect Bank" button click
  const handleConnectBank = () => {
    if (!linkToken || !ready) {
      toast({
        title: "Connection Not Ready",
        description: "Please wait a moment and try again.",
        variant: "destructive",
      });
      return;
    }

    // Open Plaid Link
    open();
  };

  // Intro step with clear explanation
  if (step === "intro") {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Connect Your Bank Account
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Connect your bank account to set up automatic monthly payments for
          your financing.
        </p>

        <div className="rounded-lg bg-blue-50 p-4 mb-6 flex">
          <ShieldCheck className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800 mb-1">
              Secure Connection
            </p>
            <p className="text-sm text-blue-700">
              We use Plaid to securely connect to your bank. Your credentials
              are never stored on our servers.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            What You Need to Know
          </h4>
          <ul className="space-y-2">
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                Your monthly payment of ${contractId ? "99.17" : "TBD"} will be
                automatically debited
              </span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                You'll receive a notification 3 days before each payment
              </span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                You can update your payment method at any time
              </span>
            </li>
          </ul>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button
            onClick={handleConnectBank}
            disabled={!ready || isLoadingToken}
          >
            {isLoadingToken ? (
              <>Loading...</>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Connect Bank
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Connecting step (loading)
  if (step === "connecting") {
    return (
      <div className="p-6 text-center">
        <div className="py-12">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Processing Your Bank Information
          </h3>
          <p className="text-sm text-gray-600">
            Please wait while we securely process your bank account information.
            This may take a moment.
          </p>
        </div>
      </div>
    );
  }

  // Success step
  if (step === "success") {
    return (
      <div className="p-6 text-center">
        <div className="py-12">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Bank Connected Successfully!
          </h3>
          <p className="text-sm text-gray-600">
            Your bank account has been successfully connected for automatic
            payments.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
