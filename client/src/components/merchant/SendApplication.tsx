import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function SendApplication(props) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get the merchant ID from props or user context
      const currentMerchantId = props?.merchantId || (user?.merchantId as number);

      // Validate merchantId exists before sending request
      if (!currentMerchantId) {
        throw new Error("Merchant ID is required but not available");
      }

      console.log("Sending application with merchantId:", currentMerchantId);

      // Ensure amount is a valid number
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      const response = await fetch("/api/send-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
          email,
          merchantId: currentMerchantId,
          amount: parsedAmount
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to send application");
      }

      // Clear form fields on success
      setPhoneNumber("");
      setEmail("");
      setAmount("");

      toast({
        title: "Application Sent!",
        description: `Financing application sent to ${phoneNumber}`
      });
    } catch (error) {
            // Enhanced error logging
            console.error("Error sending application:", error);

            // Log detailed error information
            console.error("Error details:", {
                errorType: error.constructor.name,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined,
                requestData: {
                    phoneNumber,
                    email,
                    merchantId: currentMerchantId, 
                    amount: parsedAmount || parseFloat(amount)
                }
            });

            // Create user-friendly error message
            const o = error instanceof Error ? error.message : "An unknown error occurred";

            // Show error toast to user
            toast({
                title: "Error Sending Application",
                description: o,
                variant: "destructive"
            });
        } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center">
          <Send className="h-5 w-5 mr-2 text-primary" />
          Send Financing Application
        </CardTitle>
        <CardDescription>
          Send a 24-month 0% APR financing application to your customer via SMS
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Customer Phone Number</Label>
            <Input 
              id="phone" 
              type="tel" 
              placeholder="(555) 123-4567" 
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Customer Email (Optional)</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="customer@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input 
              id="amount" 
              type="number" 
              min="1"
              step="0.01"
              placeholder="1000.00" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Send Application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}