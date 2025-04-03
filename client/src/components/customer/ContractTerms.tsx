import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InfoIcon, Shield } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ContractTermsProps {
  contractId: number;
  progressId: number;
  merchantName: string;
  amount: number;
  downPayment: number;
  financedAmount: number;
  termMonths: number;
  interestRate: number;
  monthlyPayment: number;
  onComplete: () => void;
  onBack: () => void;
}

export default function ContractTerms({
  contractId,
  progressId,
  merchantName,
  amount,
  downPayment,
  financedAmount,
  termMonths,
  interestRate,
  monthlyPayment,
  onComplete,
  onBack,
}: ContractTermsProps) {
  const { toast } = useToast();
  const [fcraConsentAccepted, setFcraConsentAccepted] = useState(false);
  const [privacyPolicyAccepted, setPrivacyPolicyAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ipAddress, setIpAddress] = useState("");

  // Get user IP address (for FCRA consent documentation)
  useEffect(() => {
    const getIpAddress = async () => {
      try {
        // Use a service to get the user's IP address
        const response = await fetch("https://api.ipify.org?format=json");
        const data = await response.json();
        setIpAddress(data.ip);
      } catch (error) {
        console.error("Failed to get IP address:", error);
        // Fallback if we can't get the IP
        setIpAddress("Unknown");
      }
    };

    getIpAddress();
  }, []);

  const handleAccept = async () => {
    if (!fcraConsentAccepted || !privacyPolicyAccepted) {
      toast({
        title: "Consent Required",
        description: "Please accept both the FCRA consent and privacy policy to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const consentData = {
        fcraConsentAccepted: fcraConsentAccepted,
        privacyPolicyAccepted: privacyPolicyAccepted,
        consentTimestamp: new Date().toISOString(),
        consentIpAddress: ipAddress
      };

      await apiRequest("PATCH", `/api/application-progress/${progressId}`, {
        completed: true,
        data: JSON.stringify(consentData),
      });

      toast({
        title: "Consent Accepted",
        description: "Your consent has been recorded. We'll check what financing offer you qualify for.",
      });

      onComplete();
    } catch (error) {
      console.error("Failed to record consent:", error);
      toast({
        title: "Error",
        description: "Failed to process your consent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Pre-Qualification for Financing</h3>
      <p className="text-sm text-gray-600 mb-4">
        Before we can show you your personalized financing options for your purchase from{" "}
        <span className="font-medium text-gray-800">{merchantName}</span>, we need to check your eligibility.
      </p>

      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <InfoIcon className="h-5 w-5 text-blue-600" />
        <AlertTitle className="text-blue-700">What happens next?</AlertTitle>
        <AlertDescription className="text-blue-600">
          After you provide consent, we'll guide you through the application process. Once we've verified your information and 
          connected to your bank account, we'll present your personalized financing offer.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border border-gray-200 p-4 mb-6 bg-gray-50">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">FCRA Disclosure</h4>
        <div className="text-sm text-gray-700 space-y-3">
          <p>
            I am providing written instructions authorizing {merchantName} and affiliates to obtain my personal credit profile or other
            information from credit reporting agencies under the FCRA solely to conduct a credit pre-qualification.
          </p>
          <p>
            I further understand that this is a soft pull and will not harm my credit in any way whatsoever.
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-start space-x-2">
          <Checkbox 
            id="fcra-consent" 
            checked={fcraConsentAccepted}
            onCheckedChange={(checked) => setFcraConsentAccepted(checked === true)}
            className="mt-1"
          />
          <label
            htmlFor="fcra-consent"
            className="text-sm leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            I authorize {merchantName} to obtain my credit information to determine what financing options I qualify for.
            This will not affect my credit score.
          </label>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox 
            id="privacy-policy" 
            checked={privacyPolicyAccepted}
            onCheckedChange={(checked) => setPrivacyPolicyAccepted(checked === true)}
            className="mt-1"
          />
          <label
            htmlFor="privacy-policy"
            className="text-sm leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            I agree to the <a href="#" className="text-primary-600 hover:text-primary-700">terms and conditions</a> and{" "}
            <a href="#" className="text-primary-600 hover:text-primary-700">privacy policy</a>.
          </label>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          onClick={handleAccept} 
          disabled={isSubmitting || !fcraConsentAccepted || !privacyPolicyAccepted}
        >
          {isSubmitting ? "Processing..." : "PreQualify Me!"}
        </Button>
      </div>
    </div>
  );
}
