import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, CheckCircle, AlertCircle, Building, ChevronRight, ShieldCheck } from "lucide-react";

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
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  // Sample bank options
  const popularBanks = [
    { id: "chase", name: "Chase", logo: "chase-logo" },
    { id: "bankofamerica", name: "Bank of America", logo: "boa-logo" },
    { id: "wellsfargo", name: "Wells Fargo", logo: "wells-logo" },
    { id: "citibank", name: "Citibank", logo: "citi-logo" },
    { id: "usbank", name: "US Bank", logo: "usbank-logo" },
    { id: "pnc", name: "PNC", logo: "pnc-logo" },
  ];

  // Handle bank selection
  const handleBankSelect = (bankId: string) => {
    setSelectedBank(bankId);
  };

  // Launch Plaid Link to connect bank account
  const handleConnectBank = async () => {
    if (!selectedBank) {
      toast({
        title: "Bank Selection Required",
        description: "Please select your bank to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsConnecting(true);
      setStep("connecting");
      
      // Simulate API integration with Plaid
      const plaidResponse = await apiRequest<{
        success: boolean;
        accountId: string;
        accountMask: string;
        accountName: string;
      }>("POST", "/api/mock/plaid-link", {
        contractId,
        bankId: selectedBank,
      });
      
      if (!plaidResponse.success) {
        throw new Error("Bank connection failed");
      }
      
      // Update application progress
      await apiRequest("PATCH", `/api/application-progress/${progressId}`, {
        completed: true,
        data: JSON.stringify({
          bankConnectedAt: new Date().toISOString(),
          bankAccount: {
            id: plaidResponse.accountId || "acc_12345",
            mask: plaidResponse.accountMask || "1234",
            type: "checking",
            name: plaidResponse.accountName || "Checking Account",
          },
        }),
      });
      
      // Show success state
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
  };

  // Intro step with bank selection
  if (step === "intro") {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Bank Account</h3>
        <p className="text-sm text-gray-600 mb-4">
          Connect your bank account to set up automatic monthly payments for your financing.
        </p>

        <div className="rounded-lg bg-blue-50 p-4 mb-6 flex">
          <ShieldCheck className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800 mb-1">Secure Connection</p>
            <p className="text-sm text-blue-700">
              We use Plaid to securely connect to your bank. Your credentials are never stored on our servers.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select your bank
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {popularBanks.map((bank) => (
              <div
                key={bank.id}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  selectedBank === bank.id
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => handleBankSelect(bank.id)}
              >
                <div className="flex items-center">
                  <div className="bg-gray-100 rounded-md p-2 mr-3">
                    <Building className="h-5 w-5 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium">{bank.name}</span>
                  {selectedBank === bank.id && (
                    <CheckCircle className="h-4 w-4 text-primary-500 ml-auto" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-lg p-3 mt-3 text-center cursor-pointer hover:bg-gray-100">
            <div className="flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">Search for other banks</span>
              <ChevronRight className="h-4 w-4 text-gray-500 ml-1" />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">What You Need to Know</h4>
          <ul className="space-y-2">
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">Your monthly payment of ${contractId ? "99.17" : "TBD"} will be automatically debited</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">You'll receive a notification 3 days before each payment</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">You can update your payment method at any time</span>
            </li>
          </ul>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button
            onClick={handleConnectBank}
            disabled={!selectedBank}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Connect Bank
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Connecting to Your Bank</h3>
          <p className="text-sm text-gray-600">
            Please wait while we establish a secure connection with your bank. This may take a moment.
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Bank Connected Successfully!</h3>
          <p className="text-sm text-gray-600">
            Your bank account has been successfully connected for automatic payments.
          </p>
        </div>
      </div>
    );
  }

  return null;
}