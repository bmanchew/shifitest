import { useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import React from 'react';
import { AlertCircle, CheckCircle2, Building2, FileCheck, Building as Bank } from 'lucide-react';

interface SignupFormData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  companyName: string;
  industry: string;
  website: string;
  legalBusinessName: string;
  dba: string;
  businessStructure: string;
  stateOfIncorporation: string;
  dateOfIncorporation: string;
  ein: string;
  businessAddress: string;
  mailingAddress: string;
  estimatedMonthlyRevenue: string;
  annualFinancedVolume: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownershipPercentage: string;
  ownerRole: string;
}

const steps = [
  { id: 1, name: 'Business Info', icon: Building2 },
  { id: 2, name: 'Bank Connection', icon: Bank },
  { id: 3, name: 'Identity Verification', icon: FileCheck }
];

export default function MerchantSignup() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<SignupFormData>({} as SignupFormData);
  const [plaidToken, setPlaidToken] = useState("");
  const [files, setFiles] = useState<{[key: string]: File}>({});
  const [isLoading, setIsLoading] = useState(false);

  const { open, ready } = usePlaidLink({
    token: plaidToken,
    onSuccess: async (public_token, metadata) => {
      try {
        console.log("Plaid Link success", { public_token, metadata });
        setIsLoading(true);
        
        // Get the first account from the accounts array
        const accountId = metadata.accounts?.[0]?.id;
        
        const response = await fetch('/api/merchant/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            plaidPublicToken: public_token,
            plaidAccountId: accountId
          })
        });

        const data = await response.json();
        if (data.success) {
          setStep(3);
          window.location.href = data.kycSessionUrl;
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (step === 1) {
        setStep(2);
        setIsLoading(true);
        console.log("Step 1 -> 2: Fetching Plaid link token");
        // Initialize Plaid
        const response = await fetch('/api/plaid/create-link-token');
        const data = await response.json();
        console.log("Plaid link token response:", data);
        
        if (data.success && data.linkToken) {
          setPlaidToken(data.linkToken);
          console.log("Link token set:", data.linkToken);
        } else if (data.link_token) { // Handle legacy response format
          setPlaidToken(data.link_token);
          console.log("Link token set from legacy format:", data.link_token);
        } else {
          console.error("Failed to get link token:", data);
          alert("Failed to connect to bank. Please try again.");
        }
        setIsLoading(false);
      } else if (step === 2) {
        console.log("Step 2: Opening Plaid link with token:", plaidToken);
        if (!plaidToken) {
          console.error("No Plaid token available");
          // Try to get a new token
          const response = await fetch('/api/plaid/create-link-token');
          const data = await response.json();
          if (data.success && data.linkToken) {
            console.log("Got new link token:", data.linkToken);
            setPlaidToken(data.linkToken);
            setTimeout(() => open(), 500); // Give it a moment to update
          } else if (data.link_token) { // Handle legacy response format
            console.log("Got new link token from legacy format:", data.link_token);
            setPlaidToken(data.link_token);
            setTimeout(() => open(), 500); // Give it a moment to update
          } else {
            alert("Could not initialize bank connection. Please try again.");
          }
        } else {
          open();
        }
      }
    } catch (error) {
      console.error("Error in form submission:", error);
      setIsLoading(false);
      alert("An error occurred. Please try again.");
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Legal Business Name"
                value={formData.legalBusinessName}
                onChange={(e) => setFormData({...formData, legalBusinessName: e.target.value})}
                required
              />
              <Input
                placeholder="DBA (if applicable)"
                value={formData.dba}
                onChange={(e) => setFormData({...formData, dba: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                required
              />
              <Input
                placeholder="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
              <Input
                type="tel"
                placeholder="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                required
              />
            </div>
            <Input
              placeholder="Business Address"
              value={formData.businessAddress}
              onChange={(e) => setFormData({...formData, businessAddress: e.target.value})}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="EIN"
                value={formData.ein}
                onChange={(e) => setFormData({...formData, ein: e.target.value})}
                required
              />
              <Input
                placeholder="Business Structure"
                value={formData.businessStructure}
                onChange={(e) => setFormData({...formData, businessStructure: e.target.value})}
                required
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="text-center space-y-4">
            <Bank className="mx-auto h-12 w-12 text-primary" />
            <h3 className="text-lg font-semibold">Connect Your Business Bank Account</h3>
            <p className="text-muted-foreground">
              We'll securely connect to your bank to verify your business revenue.
            </p>
            <Button
              onClick={() => open()}
              disabled={!ready || isLoading}
              className="w-full"
            >
              {isLoading ? "Connecting..." : "Connect Bank Account"}
            </Button>
          </div>
        );
      case 3:
        return (
          <div className="text-center space-y-4">
            <FileCheck className="mx-auto h-12 w-12 text-primary" />
            <h3 className="text-lg font-semibold">Identity Verification</h3>
            <p className="text-muted-foreground">
              Please complete the identity verification process.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          {steps.map((s) => (
            <div key={s.id} className="flex items-center">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full
                ${step >= s.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}
              `}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{s.name}</p>
              </div>
            </div>
          ))}
        </div>
        <Progress value={(step / steps.length) * 100} className="h-2" />
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {renderStep()}
          <div className="flex justify-between mt-6">
            {step > 1 && (
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={isLoading}
              >
                Back
              </Button>
            )}
            <Button 
              type="submit" 
              className="ml-auto"
              disabled={isLoading}
            >
              {step === 1 ? 'Continue' : step === 2 ? 'Connect Bank' : 'Complete'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}