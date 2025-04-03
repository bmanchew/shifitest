import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";

interface FinancingOfferProps {
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

export default function FinancingOffer({
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
}: FinancingOfferProps) {
  const { toast } = useToast();
  const [isAccepted, setIsAccepted] = useState(false);

  // Mutation to update the progress when accepting the offer
  const { mutate: updateProgress, isPending } = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/application-progress/${progressId}`, {
        completed: true,
        data: JSON.stringify({
          acceptedAt: new Date().toISOString(),
          status: "accepted",
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Offer Accepted",
        description: "Your financing offer has been accepted.",
      });
      onComplete();
    },
    onError: (error) => {
      console.error("Error accepting offer:", error);
      toast({
        title: "Error",
        description: "There was a problem accepting your offer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAcceptOffer = () => {
    setIsAccepted(true);
    updateProgress();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Your Financing Offer</h1>
      <p className="text-gray-600 mb-8">
        Based on your provided information and verified credit profile, we are pleased to present you with the following financing offer from ShiFi:
      </p>

      <Card className="mb-8 border-primary/20">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-xl flex items-center">
            <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
            Pre-Qualified Financing Offer
          </CardTitle>
          <CardDescription>
            From {merchantName} in partnership with ShiFi
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-gray-600">Purchase Amount:</div>
            <div className="font-medium text-gray-900">${amount.toFixed(2)}</div>

            <div className="text-gray-600">Down Payment:</div>
            <div className="font-medium text-gray-900">${downPayment.toFixed(2)}</div>

            <div className="text-gray-600">Amount Financed:</div>
            <div className="font-medium text-gray-900">${financedAmount.toFixed(2)}</div>

            <div className="text-gray-600">Term Length:</div>
            <div className="font-medium text-gray-900">{termMonths} months</div>

            <div className="text-gray-600">Annual Percentage Rate (APR):</div>
            <div className="font-medium text-gray-900">{interestRate}%</div>

            <div className="text-gray-600 font-semibold text-lg">Monthly Payment:</div>
            <div className="font-bold text-primary text-lg">${monthlyPayment.toFixed(2)}</div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-md p-4">
            <h4 className="font-medium text-blue-800 mb-2">ShiFi Zero-Interest Program</h4>
            <p className="text-sm text-blue-700">
              Your credit profile qualifies you for our ShiFi Zero-Interest Program, which allows you to make 
              affordable monthly payments with 0% interest for the full 24-month term.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="bg-gray-50 rounded-lg p-4 mb-8">
        <h3 className="font-medium mb-2">What happens next?</h3>
        <p className="text-sm text-gray-600 mb-4">
          After accepting this offer, you'll set up your payment schedule and sign your financing agreement.
          Your first payment will be due 30 days after signing.
        </p>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack} disabled={isPending || isAccepted}>
          Back
        </Button>
        <Button onClick={handleAcceptOffer} disabled={isPending || isAccepted}>
          {isPending ? "Processing..." : "Accept Offer & Continue"}
        </Button>
      </div>
    </div>
  );
}