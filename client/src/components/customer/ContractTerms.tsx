import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
// import { apiRequest } from "@/lib/queryClient"; // Removed as we are using fetch directly
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const handleAccept = async () => {
    try {
      setIsSubmitting(true);

      // Direct fetch implementation to avoid response handling issues
      try {
        console.log(`Attempting to update progress with ID: ${progressId}`);

        if (progressId && progressId > 0) {
          // Try to update existing progress
          const updateResponse = await fetch(`/api/application-progress/${progressId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              completed: true, 
              data: JSON.stringify({ termsAccepted: true, acceptedAt: new Date().toISOString() }),
            }),
          });

          if (updateResponse.ok) {
            await updateResponse.json(); // Read and discard the response
            console.log('Successfully updated progress item');
            return; // Success, exit the try block
          }

          // If update fails, fall through to create
          console.log(`Update failed with status: ${updateResponse.status}, falling back to create`);
        } else {
          console.log('No valid progressId provided, creating new progress item');
        }

        // Create new progress item
        console.log('Creating new progress item...');
        const createResponse = await fetch('/api/application-progress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contractId: contractId,
            step: 'terms',
            completed: true,
            data: JSON.stringify({ termsAccepted: true, acceptedAt: new Date().toISOString() }),
          }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error('Create response error:', errorText);
          throw new Error(`Failed to create progress: ${createResponse.status}, details: ${errorText}`);
        }

        const newProgress = await createResponse.json();
        console.log('Created progress item:', newProgress);
      } catch (error) {
        console.error('Error in progress update/create:', error);

        // Show error toast instead of throwing
        toast({
          title: "Error",
          description: `Failed to save progress: ${error instanceof Error ? error.message : String(error)}`,
          variant: "destructive",
        });

        setIsSubmitting(false);
        return; // Exit the function early
      }

      toast({
        title: "Terms Accepted",
        description: "You have successfully accepted the contract terms.",
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

      <div className="mb-6">
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
            <a href="#" className="text-primary-600 hover:text-primary-700">privacy policy</a>. By checking this box, I agree to the terms and conditions of this financing agreement, including permission for ShiFi to obtain my credit report and other financial information. I understand this may include information from credit bureaus, income verification services, and bank account analysis. This process will not affect my credit score, and my information will be handled according to ShiFi's privacy policy.
          </label>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleAccept} disabled={isSubmitting || !termsAccepted}>
          {isSubmitting ? "Processing..." : "Accept & Continue"}
        </Button>
      </div>
    </div>
  );
}