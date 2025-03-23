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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.merchantId) {
      toast({
        title: "Error",
        description: "Merchant ID not found",
        variant: "destructive",
      });
      return;
    }

    if (!phoneNumber) {
      toast({
        title: "Error",
        description: "Phone number is required",
        variant: "destructive",
      });
      return;
    }

    if (!purchaseAmount || isNaN(purchaseAmount) || purchaseAmount <= 0) {
      toast({
        title: "Error",
        description: "Valid purchase amount is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Format phone number to ensure consistency
      const formattedPhone = phoneNumber.replace(/\D/g, '');

      // Make sure we have a valid phone number with at least 10 digits
      if (formattedPhone.length < 10) {
        throw new Error("Please enter a valid phone number with at least 10 digits");
      }

      const response = await apiRequest("/api/send-sms", {
        method: "POST",
        data: {
          phoneNumber: formattedPhone,
          email: email || undefined, // Only include email if provided
          merchantId: user.merchantId,
          amount: purchaseAmount.toString(), // Ensure amount is sent as string to prevent precision issues
        },
      });

      if (response.data && response.data.success) {
        toast({
          title: "Success",
          description: response.data.isSimulated 
            ? "Application would be sent (simulation mode)" 
            : "Application sent successfully",
        });

        // Clear form fields
        setPhoneNumber("");
        setEmail("");
        setAmount("");
        setShowCalculator(false);
      } else {
        throw new Error(
          (response.data && response.data.message) || 
          (response.data && response.data.error) || 
          "Failed to send application"
        );
      }
    } catch (error: any) {
      console.error("Error sending application:", error);

      // Extract the most useful error message
      const errorMessage = 
        (error.response && error.response.data && error.response.data.message) ||
        (error.response && error.response.data && error.response.data.error) ||
        (error.message) ||
        "Failed to send application. Please try again.";

      toast({
        title: "Error Sending Application",
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
                  body: JSON.stringify({ 
                    phoneNumber,
                    merchantId: user?.merchantId || 49, // Use merchant ID, not user ID
                    amount: purchaseAmount || 0
                  })
                });

                if (!smsResponse.ok) throw new Error('Failed to send SMS');

                // Get the response data from SMS send to get the contract ID
                const smsResponseData = await smsResponse.json();

                // Then initiate NLPearl call with the correct application URL that includes contract ID and merchant ID
                const nlpearlResponse = await fetch('/api/initiate-call', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    phoneNumber,
                    applicationUrl: smsResponseData.applicationUrl || `${window.location.origin}/apply`,
                    merchantName: user?.name || "ShiFi Financing",
                    merchantId: user?.merchantId || 49 // Pass the merchant ID to the API
                  })
                });

                if (!nlpearlResponse.ok) throw new Error('Failed to initiate call');

                toast({
                  title: "Success",
                  description: "Application sent and call initiated"
                });
              } catch (error) {
                console.error('Error:', error);
                toast({
                  title: "Error",
                  description: "Failed to send application",
                  variant: "destructive"
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
                  {/*Removed optional email message*/}
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
                  onClick={handleSubmit}
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