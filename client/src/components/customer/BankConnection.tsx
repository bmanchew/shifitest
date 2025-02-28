import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ShieldCheck, CreditCard, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface BankConnectionProps {
  contractId: number;
  progressId: number;
  onComplete: () => void;
  onBack: () => void;
}

export default function BankConnection({
  contractId,
  progressId,
  onComplete,
  onBack,
}: BankConnectionProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [bankSelected, setBankSelected] = useState<string | null>(null);
  
  // In a real implementation, we would use Plaid Link here
  // For demo purposes, we'll simulate the bank connection flow
  const mockBanks = [
    { id: "chase", name: "Chase", logo: "chase" },
    { id: "bofa", name: "Bank of America", logo: "bofa" },
    { id: "wells", name: "Wells Fargo", logo: "wells" },
    { id: "citi", name: "Citibank", logo: "citi" },
  ];

  const handleBankSelect = (bankId: string) => {
    setBankSelected(bankId);
  };

  const handleConnectBank = async () => {
    if (!bankSelected) {
      toast({
        title: "Select a Bank",
        description: "Please select a bank to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsConnecting(true);
      
      // Simulate Plaid Link flow with our mock API
      const plaidResponse = await apiRequest("POST", "/api/mock/plaid-link", {
        publicToken: `public-sandbox-${Math.random().toString(36).substring(2, 15)}`,
        accountId: `acc_${Math.random().toString(36).substring(2, 15)}`,
      });
      
      // Update application progress
      await apiRequest("PATCH", `/api/application-progress/${progressId}`, {
        completed: true,
        data: JSON.stringify({
          bank: bankSelected,
          plaidData: plaidResponse,
          connectedAt: new Date().toISOString(),
        }),
      });
      
      toast({
        title: "Bank Connected",
        description: "Your bank account has been successfully connected.",
      });
      
      onComplete();
    } catch (error) {
      console.error("Bank connection failed:", error);
      toast({
        title: "Connection Failed",
        description: "Unable to connect to your bank. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Bank Account</h3>
      <p className="text-sm text-gray-600 mb-4">
        Connect your bank account to set up automatic payments for your financing.
      </p>

      <div className="mb-6">
        <div className="grid grid-cols-2 gap-3">
          {mockBanks.map((bank) => (
            <Card 
              key={bank.id}
              className={`cursor-pointer border-2 transition-all ${
                bankSelected === bank.id ? "border-primary-500" : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => handleBankSelect(bank.id)}
            >
              <CardContent className="flex items-center justify-center p-4">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                    <CreditCard className="h-6 w-6 text-gray-500" />
                  </div>
                  <span className="text-sm font-medium">{bank.name}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="bg-green-50 border border-green-100 rounded-lg p-4 mb-6">
        <div className="flex">
          <ShieldCheck className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-green-800 mb-1">Secure Connection</h4>
            <p className="text-sm text-green-700">
              We use bank-level security to protect your information. Your credentials are never stored on our servers.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 mb-6">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-yellow-800 mb-1">Important Note</h4>
            <p className="text-sm text-yellow-700">
              By connecting your account, you authorize ShiFi to debit your account for scheduled payments according to the terms of your contract.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          onClick={handleConnectBank} 
          disabled={isConnecting || !bankSelected}
        >
          {isConnecting ? "Connecting..." : "Connect Bank Account"}
        </Button>
      </div>
    </div>
  );
}
