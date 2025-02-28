import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Clock, DollarSign, CreditCard, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ContractOffer() {
  const { contractId: contractIdParam } = useParams();
  const contractId = parseInt(contractIdParam || "0");
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  
  // Fetch contract details
  const { data: contract, isLoading } = useQuery({
    queryKey: ["/api/contracts", contractId],
    queryFn: async () => {
      if (!contractId) return null;
      
      try {
        const res = await fetch(`/api/contracts/${contractId}`, {
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
  });

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const handleAcceptOffer = () => {
    // Navigate to the application flow to begin the onboarding process
    setLocation(`/apply/${contractId}`);
  };

  const handleDeclineOffer = () => {
    toast({
      title: "Offer Declined",
      description: "The financing offer has been declined.",
    });
    // In a real app, would send API call to update contract status
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
          <p className="mt-4 text-sm text-gray-600">Loading your financing offer...</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4">
          <Card>
            <CardHeader>
              <CardTitle>Offer Not Found</CardTitle>
              <CardDescription>We couldn't find the financing offer you're looking for.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <p className="text-sm text-gray-600 mb-6">
                The offer may have expired or the link might be incorrect.
              </p>
              <Button onClick={() => window.location.href = "/"}>
                Return Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary-600 text-white py-6">
        <div className="max-w-6xl mx-auto px-4 flex items-center">
          <div className="bg-white rounded-md p-1 mr-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">ShiFi</h1>
        </div>
      </header>

      <main className="flex-1 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <Badge 
                variant="outline" 
                className="mb-3 bg-primary-50 text-primary-700 border-primary-200 py-1 px-3"
              >
                Exclusive Financing Offer
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                0% Interest Financing for Your Purchase
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {contract.merchantName} has offered you 24-month interest-free financing for your purchase. Accept this offer to begin your easy monthly payments.
              </p>
            </div>

            <Card className="mb-8 shadow-lg border-t-4 border-t-primary">
              <CardHeader>
                <CardTitle className="text-2xl">Your Financing Offer</CardTitle>
                <CardDescription>
                  Review your personalized financing terms below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-medium mb-4 text-gray-900">Offer Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Purchase Amount:</span>
                        <span className="font-medium">{formatCurrency(contract.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Down Payment:</span>
                        <span className="font-medium">{formatCurrency(contract.downPayment)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Financed Amount:</span>
                        <span className="font-medium">{formatCurrency(contract.financedAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Term Length:</span>
                        <span className="font-medium">{contract.termMonths} Months</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Interest Rate:</span>
                        <span className="font-medium">{contract.interestRate}%</span>
                      </div>
                      <div className="flex justify-between pt-3 border-t">
                        <span className="font-medium text-gray-900">Monthly Payment:</span>
                        <span className="font-bold text-xl text-primary-600">{formatCurrency(contract.monthlyPayment)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h3 className="text-lg font-medium mb-4 text-gray-900">Key Benefits</h3>
                    <ul className="space-y-4">
                      <li className="flex">
                        <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                        <span>0% interest for the entire 24-month term</span>
                      </li>
                      <li className="flex">
                        <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                        <span>Quick and easy 5-step application process</span>
                      </li>
                      <li className="flex">
                        <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                        <span>Instant approval with simple verification</span>
                      </li>
                      <li className="flex">
                        <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                        <span>Automatic monthly payments from your bank account</span>
                      </li>
                      <li className="flex">
                        <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                        <span>No early payment penalties</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="border-t border-gray-200 mt-8 pt-6">
                  <h3 className="text-lg font-medium mb-4 text-gray-900">What to Expect</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex justify-center mb-3">
                        <div className="bg-primary-50 p-2 rounded-full">
                          <CreditCard className="h-6 w-6 text-primary-500" />
                        </div>
                      </div>
                      <h4 className="text-center font-medium mb-1">Review Terms</h4>
                      <p className="text-sm text-gray-500 text-center">
                        Accept offer & review contract details
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex justify-center mb-3">
                        <div className="bg-primary-50 p-2 rounded-full">
                          <Shield className="h-6 w-6 text-primary-500" />
                        </div>
                      </div>
                      <h4 className="text-center font-medium mb-1">Verify Identity</h4>
                      <p className="text-sm text-gray-500 text-center">
                        Quick ID verification via DiDit
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex justify-center mb-3">
                        <div className="bg-primary-50 p-2 rounded-full">
                          <DollarSign className="h-6 w-6 text-primary-500" />
                        </div>
                      </div>
                      <h4 className="text-center font-medium mb-1">Link Bank</h4>
                      <p className="text-sm text-gray-500 text-center">
                        Connect your bank account via Plaid
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex justify-center mb-3">
                        <div className="bg-primary-50 p-2 rounded-full">
                          <Clock className="h-6 w-6 text-primary-500" />
                        </div>
                      </div>
                      <h4 className="text-center font-medium mb-1">Start Payments</h4>
                      <p className="text-sm text-gray-500 text-center">
                        First payment due in 30 days
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  className="w-full sm:w-auto"
                  size="lg"
                  onClick={handleAcceptOffer}
                >
                  Accept Offer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  size="lg"
                  onClick={handleDeclineOffer}
                >
                  Decline
                </Button>
              </CardFooter>
            </Card>

            <div className="text-center text-sm text-gray-500">
              <p>Offer expires in 7 days. Subject to terms and conditions.</p>
              <p className="mt-2">
                By accepting, you agree to our{" "}
                <a href="#" className="text-primary-600 hover:underline">Terms of Service</a> and{" "}
                <a href="#" className="text-primary-600 hover:underline">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-gray-100 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-600">
          <p>© {new Date().getFullYear()} ShiFi Financial, Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}