import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export default function SendApplication() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // In a real app, this would be handled based on the authenticated user
      const merchantId = user?.merchantId || 1;

      await apiRequest("POST", "/api/send-sms", {
        phoneNumber,
        merchantId,
        amount: parseFloat(amount),
      });

      toast({
        title: "Application Sent",
        description: `Financing application sent to ${phoneNumber}.`,
      });

      setPhoneNumber("");
      setAmount("");
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
      <CardHeader>
        <CardTitle>Send Financing Application</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="sm:flex space-y-3 sm:space-y-0 sm:items-end">
          <div className="grid gap-2 flex-1 mr-0 sm:mr-3">
            <Label htmlFor="customer-phone">Customer Phone Number</Label>
            <Input
              id="customer-phone"
              type="tel"
              placeholder="(123) 456-7890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2 flex-1 mr-0 sm:mr-3">
            <Label htmlFor="amount">Purchase Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0"
              required
            />
          </div>
          <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send Application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
