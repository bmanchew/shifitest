import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function SendApplication() {
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
      // Make sure we have a merchantId, even if user is not available
      const merchantId = (user?.merchantId || 49); // Default to Shiloh Finance ID

      console.log("Sending application with merchantId:", merchantId);

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
          merchantId,
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
      console.error("Error sending application:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";

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