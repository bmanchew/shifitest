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
  RefreshCw,
} from "lucide-react";
import { usePlaidLink } from "react-plaid-link";

interface BankConnectionDetails {
  accountId: string;
  accountName: string;
  accountType: string;
  accountSubtype: string;
  accountMask: string;
  bankName: string;
  connected: boolean;
  connectedAt: string;
}

interface BankConnectionProps {
  contractId: number;
  progressId: number;
  onComplete: () => void;
  onBack: () => void;
  existingConnection?: BankConnectionDetails;
}

export default function BankConnection({
  contractId,
  progressId,
  onComplete,
  onBack,
  existingConnection,
}: BankConnectionProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<"intro" | "connecting" | "success">(
    existingConnection ? "success" : "intro"
  );
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
        }>("POST", "/api/plaid/create-link-token", {
          userId: `user-${contractId}`, 
          // userName: "Customer", 
          products: ['auth', 'assets', 'transactions'],
        });

        if (!response.success || !response.linkToken) {
          throw new Error("Failed to get link token");
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
    // Check if we have existing connection details
    const connectionDetails = existingConnection || {
      accountName: "Your Bank Account",
      accountMask: "****",
      accountType: "checking",
      accountSubtype: "checking",
      bankName: "Your Bank",
      connectedAt: new Date().toISOString()
    };

    return (
      <div className="p-6">
        <div className="text-center py-6 mb-4">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Bank Connected Successfully!
          </h3>
          <p className="text-sm text-gray-600">
            Your bank account has been connected for automatic payments.
          </p>
        </div>

        {/* Connection Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Connected Account Details
          </h4>
          <ul className="space-y-3">
            <li className="flex justify-between text-sm">
              <span className="text-gray-500">Bank</span>
              <span className="font-medium">{connectionDetails.bankName}</span>
            </li>
            <li className="flex justify-between text-sm">
              <span className="text-gray-500">Account</span>
              <span className="font-medium">
                {connectionDetails.accountName || `${connectionDetails.accountType} Account`}
              </span>
            </li>
            <li className="flex justify-between text-sm">
              <span className="text-gray-500">Account Number</span>
              <span className="font-medium">
                {connectionDetails.accountMask ? `****${connectionDetails.accountMask}` : "********"}
              </span>
            </li>
            <li className="flex justify-between text-sm">
              <span className="text-gray-500">Connected On</span>
              <span className="font-medium">
                {new Date(connectionDetails.connectedAt).toLocaleDateString()}
              </span>
            </li>
          </ul>
        </div>

        {/* Button to reconnect if needed */}
        <div className="mt-4 flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Close
          </Button>
          <Button 
            variant="outline" 
            onClick={handleConnectBank}
            disabled={!ready || isLoadingToken}
          >
            {isLoadingToken ? (
              <>Loading...</>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconnect Bank
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
