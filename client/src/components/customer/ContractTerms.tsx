import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Check } from "lucide-react";

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fcraAccepted, setFcraAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ipAddress, setIpAddress] = useState<string | null>(null);

  // Fetch IP address for FCRA consent
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(response => response.json())
      .then(data => setIpAddress(data.ip))
      .catch(error => {
        console.error('Error fetching IP:', error);
        // Fallback to local IP if external service fails
        setIpAddress('127.0.0.1');
      });
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const handleAccept = async () => {
    if (!termsAccepted || !fcraAccepted || !privacyAccepted) {
      toast({
        title: "Terms Required",
        description: "Please accept all terms and conditions to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!ipAddress) {
      toast({
        title: "Error",
        description: "Unable to verify your location. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Create application progress update with consent data
      const consentData = {
        termsAccepted: true,
        fcraAccepted: true,
        privacyAccepted: true,
        acceptedAt: new Date().toISOString(),
        consentIp: ipAddress,
      };

      await apiRequest("PATCH", `/api/application-progress/${progressId}`, {
        completed: true,
        data: JSON.stringify(consentData),
      });
      
      // Get user information from session storage to create credit profile
      const firstName = sessionStorage.getItem('firstName') || 'Customer';
      const lastName = sessionStorage.getItem('lastName') || '';
      const email = sessionStorage.getItem('email') || '';
      const phone = sessionStorage.getItem('phone') || '';

      // Create credit profile with FCRA consent details
      await apiRequest("POST", "/api/credit-profile", {
        contractId,
        consentIp: ipAddress,
        consentDate: new Date().toISOString(),
        firstName,
        lastName,
        email,
        phone
      });
      
      toast({
        title: "Terms Accepted",
        description: "You have successfully accepted all terms and conditions.",
      });
      
      onComplete();
    } catch (error) {
      console.error("Failed to accept terms:", error);
      toast({
        title: "Error",
        description: "Failed to accept terms. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Review Contract Terms</h3>
      <p className="text-sm text-gray-600 mb-4">
        Please review the financing terms for your purchase from{" "}
        <span className="font-medium text-gray-800">{merchantName}</span>
      </p>

      <div className="rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex justify-between mb-3">
          <span className="text-sm text-gray-500">Purchase Amount</span>
          <span className="text-sm font-medium text-gray-900">{formatCurrency(amount)}</span>
        </div>
        <div className="flex justify-between mb-3">
          <span className="text-sm text-gray-500">Down Payment (15%)</span>
          <span className="text-sm font-medium text-gray-900">{formatCurrency(downPayment)}</span>
        </div>
        <div className="flex justify-between mb-3">
          <span className="text-sm text-gray-500">Financed Amount</span>
          <span className="text-sm font-medium text-gray-900">{formatCurrency(financedAmount)}</span>
        </div>
        <div className="flex justify-between mb-3">
          <span className="text-sm text-gray-500">Term</span>
          <span className="text-sm font-medium text-gray-900">{termMonths} Months</span>
        </div>
        <div className="flex justify-between mb-3">
          <span className="text-sm text-gray-500">Interest Rate</span>
          <span className="text-sm font-medium text-gray-900">{interestRate}%</span>
        </div>
        <div className="flex justify-between pt-3 border-t border-gray-200">
          <span className="text-sm font-medium text-gray-900">Monthly Payment</span>
          <span className="text-sm font-medium text-gray-900">{formatCurrency(monthlyPayment)}</span>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Key Details</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex">
            <Check className="h-5 w-5 text-primary-500 mr-2" />
            0% interest for the entire 24-month term
          </li>
          <li className="flex">
            <Check className="h-5 w-5 text-primary-500 mr-2" />
            15% down payment required today
          </li>
          <li className="flex">
            <Check className="h-5 w-5 text-primary-500 mr-2" />
            Fixed monthly payments
          </li>
          <li className="flex">
            <Check className="h-5 w-5 text-primary-500 mr-2" />
            No prepayment penalties
          </li>
        </ul>
      </div>

      <div className="mb-6 space-y-4">
        {/* General Terms Agreement */}
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="terms-agreement" 
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
          />
          <label
            htmlFor="terms-agreement"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            I agree to the <a href="#" className="text-primary-600 hover:text-primary-700">terms and conditions</a> and{" "}
            <a href="#" className="text-primary-600 hover:text-primary-700">privacy policy</a>.
          </label>
        </div>

        {/* FCRA Disclaimer */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Credit Report Authorization</h4>
          <p className="text-sm text-gray-600 mb-3">
            I understand that by clicking 'Accept & Continue', I am providing written instructions authorizing {merchantName} and its affiliates to obtain my personal credit profile or other information from credit reporting agencies under the Fair Credit Reporting Act (FCRA) solely to conduct a credit pre-qualification. I further understand that this is a soft pull and will not harm my credit in any way whatsoever.
          </p>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="fcra-agreement" 
              checked={fcraAccepted}
              onCheckedChange={(checked) => setFcraAccepted(checked === true)}
            />
            <label
              htmlFor="fcra-agreement"
              className="text-sm font-medium leading-none"
            >
              I authorize credit report access for pre-qualification
            </label>
          </div>
        </div>

        {/* Privacy Notice Agreement */}
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="privacy-agreement" 
            checked={privacyAccepted}
            onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
          />
          <label
            htmlFor="privacy-agreement"
            className="text-sm font-medium leading-none"
          >
            I acknowledge receipt of the <a href="#" className="text-primary-600 hover:text-primary-700">privacy notice</a> and consent to the use of my information as described.
          </label>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          onClick={handleAccept} 
          disabled={isSubmitting || !termsAccepted || !fcraAccepted || !privacyAccepted}
        >
          {isSubmitting ? "Processing..." : "Accept & Continue"}
        </Button>
      </div>
    </div>
  );
}
