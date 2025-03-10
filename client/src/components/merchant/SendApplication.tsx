import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { calculateMonthlyPayment, calculateDownPayment, calculateFinancedAmount } from "@/lib/utils";
import { SendHorizontal, Calculator, RefreshCw } from "lucide-react";

export default function SendApplication() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationUrl, setApplicationUrl] = useState('');

  // Fixed financing terms for ShiFi
  const termMonths = 24;
  const interestRate = 0; // 0% APR
  const downPaymentPercent = 15; // 15% down

  // Calculate financing details
  const purchaseAmount = parseFloat(amount) || 0;
  const downPayment = calculateDownPayment(purchaseAmount, downPaymentPercent);
  const financedAmount = calculateFinancedAmount(purchaseAmount, downPayment);
  const monthlyPayment = calculateMonthlyPayment(financedAmount, termMonths, interestRate);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber || !amount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Make API call to send the application via SMS
      const response = await apiRequest("POST", "/api/send-sms", {
        phoneNumber: phoneNumber,
        merchantId: user?.merchantId || 1, // Fall back to ID 1 if not available
        amount: parseFloat(amount),
      });

      // Get the contract ID from the response
      const contractId = response.contractId;

      if (!contractId) {
        console.error("Contract ID is missing from API response:", response);
        toast({
          title: "Warning",
          description: "Application sent, but contract tracking may be unavailable.",
          variant: "warning",
        });
      }

      // Generate the application URL (would normally come from server)
      const applicationUrl = contractId 
        ? `${window.location.origin}/apply/${contractId}`
        : "Application link was generated";
      setApplicationUrl(applicationUrl);

      console.log('SendApplication - Details:', {
        contractId,
        applicationUrl,
        phoneNumber,
        contractNumber: `SHI-${Math.floor(1000 + Math.random() * 9000)}` // This is simulated - actual number is generated on server
      });

      toast({
        title: "Application Sent",
        description: `ShiFi financing application sent to ${phoneNumber}. Application link: ${applicationUrl}`,
      });

      setPhoneNumber("");
      setAmount("");
      setShowCalculator(false);
    } catch (error) {
      console.error("Failed to send application:", error);
      toast({
        title: "Error",
        description: "Failed to send the application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center">
          <SendHorizontal className="h-5 w-5 mr-2 text-primary" />
          Send Financing Application
        </CardTitle>
        <CardDescription>
          Send a 24-month 0% APR financing application to your customer via SMS
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="customer-phone">Customer Phone Number</Label>
                <Input
                  id="customer-phone"
                  type="tel"
                  placeholder="(123) 456-7890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="h-10"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The customer will receive a text message with a link to apply
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="amount">Purchase Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (parseFloat(e.target.value) > 0) {
                      setShowCalculator(true);
                    }
                  }}
                  className="h-10"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-1">
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending..." : "Send Application"}
                </Button>

                <Button 
                  type="button" 
                  variant="outline" 
                  className="px-3" 
                  onClick={() => setShowCalculator(!showCalculator)}
                >
                  <Calculator className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </div>

          {showCalculator && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium flex items-center">
                  <Calculator className="h-4 w-4 mr-2 text-primary" />
                  Payment Calculator
                </h3>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 w-7 p-0" 
                  onClick={() => setShowCalculator(false)}
                >
                  <span className="sr-only">Close</span>
                  ×
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Financing Term:</span>
                  <span className="font-medium">{termMonths} months</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Interest Rate:</span>
                  <span className="font-medium">{interestRate}% APR</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Purchase Amount:</span>
                  <span className="font-medium">{formatCurrency(purchaseAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Down Payment (15%):</span>
                  <span className="font-medium">{formatCurrency(downPayment)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Amount Financed:</span>
                  <span className="font-medium">{formatCurrency(financedAmount)}</span>
                </div>
                <div className="flex justify-between py-2 mt-1 font-semibold">
                  <span>Monthly Payment:</span>
                  <span className="text-primary">{formatCurrency(monthlyPayment)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}