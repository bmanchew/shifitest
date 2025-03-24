import { useState, FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface SendApplicationProps {
  merchantId?: number;
}

// Helper function to format phone number to E.164 format
function formatPhoneNumberE164(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, "");
  
  // If the number starts with "1" and has 11 digits, it's already a US number with country code
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return `+${digitsOnly}`;
  }
  
  // If the number has 10 digits, assume it's a US number and add +1
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  
  // Otherwise, just add + (might not be valid but let Twilio validate it)
  return `+${digitsOnly}`;
}

export default function SendApplication(props: SendApplicationProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get the merchant ID from props or user context
      const merchantId = props?.merchantId || (user?.merchantId as number);

      // Validate merchantId exists before sending request
      if (!merchantId) {
        throw new Error("Merchant ID is required but not available");
      }

      console.log("Sending application with merchantId:", merchantId);

      // Ensure amount is a valid number
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid amount");
      }
      
      // Validate phone number
      if (!phoneNumber.trim()) {
        throw new Error("Phone number is required");
      }
      
      // Format the phone number properly for Twilio (E.164 format)
      const formattedPhoneNumber = formatPhoneNumberE164(phoneNumber);
      
      // Make sure we have at least 10 digits
      if (formattedPhoneNumber.replace(/\D/g, "").length < 10) {
        throw new Error("Please enter a valid phone number with at least 10 digits");
      }

      const response = await fetch("/api/send-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: formattedPhoneNumber,
          email,
          merchantId: merchantId,
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
    } catch (error: unknown) {
      // Enhanced error logging
      console.error("Error sending application:", error);

      // Log detailed error information
      const merchantId = props?.merchantId || (user?.merchantId as number);
      // Get parsedAmount safely
      let parsedAmountValue: number;
      try {
        parsedAmountValue = parseFloat(amount);
        if (isNaN(parsedAmountValue)) parsedAmountValue = 0;
      } catch {
        parsedAmountValue = 0;
      }
      
      console.error("Error details:", {
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        requestData: {
          phoneNumber,
          email,
          merchantId: merchantId, 
          amount: parsedAmountValue
        }
      });

      // Create user-friendly error message
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";

      // Show error toast to user
      toast({
        title: "Error Sending Application",
        description: errorMessage,
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