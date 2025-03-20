import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  calculateMonthlyPayment,
  calculateDownPayment,
  calculateFinancedAmount,
} from "@/lib/utils";
import { SendHorizontal, Calculator, RefreshCw } from "lucide-react";

export default function SendApplication() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState(""); // New state for email
  const [amount, setAmount] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fixed financing terms for ShiFi
  const termMonths = 24;
  const interestRate = 0; // 0% APR
  const downPaymentPercent = 15; // 15% down

  // Calculate financing details
  const purchaseAmount = parseFloat(amount) || 0;
  const downPayment = calculateDownPayment(purchaseAmount, downPaymentPercent);
  const financedAmount = calculateFinancedAmount(purchaseAmount, downPayment);
  const monthlyPayment = calculateMonthlyPayment(
    financedAmount,
    termMonths,
    interestRate,
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !amount) {
      toast({
        title: "Error",
        description: "Please enter both phone number and amount",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      // Get merchant ID based on current user
      const merchantId = user?.merchantId || 1;

      const response = await fetch("/api/send-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
          email, // Include email in the request
          merchantId,
          amount: parseFloat(amount),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      toast({
        title: "Application Sent",
        description: data.message || "The application has been sent to the customer.",
      });

      console.log("Application sent successfully:", data);

      // Reset form fields
      setPhoneNumber("");
      setEmail(""); // Reset email field
      setAmount("");
      setShowCalculator(false);
    } catch (error) {
      console.error("Failed to send application:", error);

      // Try to extract more detailed error information
      let errorMessage = "Failed to send the application. Please try again.";

      if (error instanceof Error) {
        // Try to parse the error message as JSON for more details
        try {
          const errorData = JSON.parse(error.message);
          errorMessage = errorData.message || error.message;
        } catch {
          // If parsing fails, use the original error message
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
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
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                // First send SMS
                const smsResponse = await fetch('/api/send-application', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phoneNumber })
                });

                if (!smsResponse.ok) throw new Error('Failed to send SMS');

                // Then initiate NLPearl call
                const nlpearlResponse = await fetch('/api/initiate-call', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    phoneNumber,
                    applicationUrl: window.location.origin + '/apply'
                  })
                });

                if (!nlpearlResponse.ok) throw new Error('Failed to initiate call');

                toast.success('Application sent and call initiated');
              } catch (error) {
                console.error('Error:', error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to send application"
                  });
              }
            }} className="space-y-4">
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

              {/* New Email Field */}
              <div className="grid gap-2">
                <Label htmlFor="customer-email">Customer Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  placeholder="customer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">
                  Optional: The customer will also receive an email with the application
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
                  <span className="sr-only">Close</span>×
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
                  <span className="font-medium">
                    {formatCurrency(purchaseAmount)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Down Payment (15%):</span>
                  <span className="font-medium">
                    {formatCurrency(downPayment)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Amount Financed:</span>
                  <span className="font-medium">
                    {formatCurrency(financedAmount)}
                  </span>
                </div>
                <div className="flex justify-between py-2 mt-1 font-semibold">
                  <span>Monthly Payment:</span>
                  <span className="text-primary">
                    {formatCurrency(monthlyPayment)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}