import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import CustomerLayout from "@/components/layout/CustomerLayout";

export default function ContractLookup() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    // Clear any previous errors and set loading state
    setError(null);
    setLoading(true);

    // Start the lookup process
    lookupContractByPhone(phoneNumber.trim());
  };

  const lookupContractByPhone = async (phone: string) => {
    try {
      console.log(`Looking up contract by phone: ${phone}`);

      // Normalize the phone number to remove any non-digit characters
      const normalizedPhone = phone.replace(/\D/g, "");
      
      if (normalizedPhone.length < 10) {
        setError("Please enter a valid 10-digit phone number.");
        setLoading(false);
        return;
      }

      // Fetch the contract by phone number
      try {
        const response = await apiRequest<{
          success: boolean;
          contract?: any;
          message?: string;
        }>("GET", `/contracts/by-phone/${normalizedPhone}`);

        console.log("Contract lookup response:", response);

        if (!response || !response.success || !response.contract) {
          setError(response?.message || "No contract found with this phone number. Please check your phone number and try again.");
          setLoading(false);
          return;
        }

        // Contract found, navigate to the application page
        const contractId = response.contract.id;
        
        toast({
          title: "Contract Found",
          description: `Loading your application...`,
        });

        // Use the numeric ID for consistency
        navigate(`/apply/${contractId}`);
      } catch (apiError) {
        console.error("API Error in contract lookup:", apiError);
        setError("We couldn't find a contract with this phone number. Please check and try again.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error in contract lookup:", error);
      setError("Something went wrong. Please try again later.");
      setLoading(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="container mx-auto flex flex-col items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Find Your Application</CardTitle>
            <CardDescription>
              Enter your phone number to continue with your financing application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="tel"
                  placeholder="Enter your phone number (e.g. 555-123-4567)"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={loading}
                  className="w-full"
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Finding your application..." : "Continue Application"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-gray-500">
              Need help? Contact customer support at (555) 123-4567
            </p>
          </CardFooter>
        </Card>
      </div>
    </CustomerLayout>
  );
}
