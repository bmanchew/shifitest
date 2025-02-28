import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileSignature, CheckCircle2 } from "lucide-react";

interface ContractSigningProps {
  contractId: number;
  progressId: number;
  contractNumber: string;
  customerName: string;
  onComplete: () => void;
  onBack: () => void;
}

export default function ContractSigning({
  contractId,
  progressId,
  contractNumber,
  customerName,
  onComplete,
  onBack,
}: ContractSigningProps) {
  const { toast } = useToast();
  const [isSigning, setIsSigning] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState(customerName || "");
  const [signatureConsent, setSignatureConsent] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !fullName || !signatureConsent) {
      toast({
        title: "Missing Information",
        description: "Please fill out all fields and accept the electronic signature consent.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSigning(true);
      
      // Call Thanks Roger API (mock)
      const signingResponse = await apiRequest("POST", "/api/mock/thanks-roger-signing", {
        contractId,
        signerName: fullName,
        signerEmail: email,
      });
      
      // Update application progress
      await apiRequest("PATCH", `/api/application-progress/${progressId}`, {
        completed: true,
        data: JSON.stringify({
          signing: signingResponse,
          signedAt: new Date().toISOString(),
        }),
      });
      
      // Update contract status
      await apiRequest("PATCH", `/api/contracts/${contractId}/status`, {
        status: "active",
      });
      
      setIsCompleted(true);
      
      // Wait a bit before triggering completion to show success state
      setTimeout(() => {
        toast({
          title: "Contract Signed",
          description: "Your contract has been successfully signed.",
        });
        onComplete();
      }, 2000);
      
    } catch (error) {
      console.error("Contract signing failed:", error);
      toast({
        title: "Signing Failed",
        description: "Unable to sign the contract. Please try again.",
        variant: "destructive",
      });
      setIsSigning(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-10">
          <div className="bg-green-100 rounded-full p-3 mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Contract Signed!</h3>
          <p className="text-sm text-gray-600 text-center mb-6">
            Your contract has been successfully signed and processed.
            A copy has been sent to your email.
          </p>
          <Button onClick={onComplete}>
            Complete Application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign Your Contract</h3>
      <p className="text-sm text-gray-600 mb-4">
        Please review and electronically sign your retail installment contract.
      </p>

      <div className="bg-gray-50 rounded-lg p-4 mb-6 flex">
        <FileSignature className="h-5 w-5 text-gray-500 mr-3 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-800 mb-1">Contract: {contractNumber}</p>
          <p className="text-sm text-gray-600">
            By signing this contract, you agree to all terms and conditions outlined in the
            retail installment agreement.
          </p>
        </div>
      </div>

      <form onSubmit={handleSign}>
        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email for the signed contract"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Legal Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full legal name"
              required
            />
          </div>
          
          <div className="pt-2">
            <div className="flex items-start space-x-2">
              <Checkbox 
                id="consent"
                checked={signatureConsent}
                onCheckedChange={(checked) => setSignatureConsent(checked === true)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="consent"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Electronic Signature Consent
                </label>
                <p className="text-sm text-gray-500">
                  I agree to sign this document electronically and acknowledge that my electronic signature is legally binding.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" disabled={isSigning}>
            {isSigning ? "Signing..." : "Sign Contract"}
          </Button>
        </div>
      </form>
    </div>
  );
}
