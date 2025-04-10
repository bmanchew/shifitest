import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import React from 'react';
import { AlertCircle, CheckCircle2, Building2, FileCheck, Building as Bank } from 'lucide-react';
import { getCsrfToken, addCsrfHeader } from '@/lib/csrf';

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
  termsOfServiceUrl: string;
  privacyPolicyUrl: string;
  primaryProgramName: string;
  primaryProgramDescription: string;
  primaryProgramDurationMonths: string;
}

const steps = [
  { id: 1, name: 'Business Info', icon: Building2 },
  { id: 2, name: 'Bank Connection', icon: Bank },
  { id: 3, name: 'Identity Verification', icon: FileCheck }
];

export default function MerchantSignup() {
  const [step, setStep] = useState(1);
  // Initialize form data with empty strings to avoid uncontrolled to controlled warnings
  const [formData, setFormData] = useState<SignupFormData>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    companyName: '',
    industry: '',
    website: '',
    legalBusinessName: '',
    dba: '',
    businessStructure: '',
    stateOfIncorporation: '',
    dateOfIncorporation: '',
    ein: '',
    businessAddress: '',
    mailingAddress: '',
    estimatedMonthlyRevenue: '',
    annualFinancedVolume: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    ownershipPercentage: '',
    ownerRole: '',
    termsOfServiceUrl: '',
    privacyPolicyUrl: '',
    primaryProgramName: '',
    primaryProgramDescription: '',
    primaryProgramDurationMonths: '12', // Initialize with default value to prevent uncontrolled to controlled warning
  });
  const [plaidToken, setPlaidToken] = useState("");
  const [files, setFiles] = useState<{[key: string]: File}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  
  // Fetch CSRF token when component mounts
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        // First ensure we have a fresh CSRF token
        await fetch('/api/csrf-token', {
          method: 'GET',
          credentials: 'include'
        });
        
        // Then get the token from the cookie
        const token = await getCsrfToken();
        console.log("Fetched CSRF token for signup flow");
        setCsrfToken(token);
      } catch (error) {
        console.error("Error fetching CSRF token:", error);
      }
    };
    
    fetchCsrfToken();
  }, []);

  const { open, ready } = usePlaidLink({
    token: plaidToken,
    onSuccess: async (public_token, metadata) => {
      try {
        console.log("Plaid Link success", { public_token, metadata });
        setIsLoading(true);
        
        // Get the first account from the accounts array
        const accountId = metadata.accounts?.[0]?.id;
        
        // Check if we have the CSRF token from our component state
        if (!csrfToken) {
          // Fetch a fresh CSRF token if we don't have one
          await fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'include'
          });
        }
        
        // Get the most up-to-date token
        const token = csrfToken || await getCsrfToken();
        console.log("Using CSRF token for form submission:", token);
        
        const response = await fetch('/api/merchant/signup', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-CSRF-Token': token, 
            'CSRF-Token': token
          },
          credentials: 'include', // Include cookies in the request
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
        } else {
          console.error("API Error:", data);
          alert("Error submitting form: " + (data.message || "Unknown error"));
        }
      } catch (error) {
        console.error('Error:', error);
        alert("Error processing bank connection. Please try again.");
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
        
        // Check if we have the CSRF token from our component state
        if (!csrfToken) {
          // Fetch a fresh CSRF token if we don't have one
          await fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'include'
          });
        }
        
        // Get the most up-to-date token
        const token = csrfToken || await getCsrfToken();
        console.log("Using CSRF token for Plaid link token request:", token);
        
        // Use GET request for unauthenticated Plaid link token request during signup flow
        const response = await fetch('/api/plaid/create-link-token', {
          method: 'GET',
          credentials: 'include' // Include cookies in the request
        });
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
          // Try to get a new token with signup flag
          
          // Check if we have the CSRF token from our component state
          if (!csrfToken) {
            // Fetch a fresh CSRF token if we don't have one
            await fetch('/api/csrf-token', {
              method: 'GET',
              credentials: 'include'
            });
          }
          
          // Get the most up-to-date token
          const token = csrfToken || await getCsrfToken();
          console.log("Using CSRF token for Plaid link token refresh:", token);
          
          // Use GET request for unauthenticated Plaid link token request during signup flow
          const response = await fetch('/api/plaid/create-link-token', {
            method: 'GET',
            credentials: 'include' // Include cookies in the request
          });
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
            
            {/* Program Information */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-md font-semibold mb-3">Financing Program Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Program Name"
                  value={formData.primaryProgramName}
                  onChange={(e) => setFormData({...formData, primaryProgramName: e.target.value})}
                  required
                />
                <Input
                  placeholder="Program Duration (months)"
                  type="number"
                  min="1"
                  max="60"
                  value={formData.primaryProgramDurationMonths}
                  onChange={(e) => setFormData({...formData, primaryProgramDurationMonths: e.target.value})}
                  required
                />
              </div>
              <div className="mt-3">
                <Input
                  placeholder="Program Description"
                  value={formData.primaryProgramDescription}
                  onChange={(e) => setFormData({...formData, primaryProgramDescription: e.target.value})}
                />
              </div>
            </div>
            
            {/* Legal Links */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-md font-semibold mb-3">Legal Document Links</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Terms of Service URL"
                  type="url"
                  value={formData.termsOfServiceUrl}
                  onChange={(e) => setFormData({...formData, termsOfServiceUrl: e.target.value})}
                  required
                />
                <Input
                  placeholder="Privacy Policy URL"
                  type="url"
                  value={formData.privacyPolicyUrl}
                  onChange={(e) => setFormData({...formData, privacyPolicyUrl: e.target.value})}
                  required
                />
              </div>
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
    <div className="container max-w-6xl mx-auto px-4 py-8">
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

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="p-6 lg:w-1/2">
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
        
        <div className="lg:w-1/2 flex items-center justify-center p-8">
          <img 
            src="/ShiFiMidesk.png" 
            alt="Unlock More Revenue With ShiFi Financing" 
            className="h-auto max-w-full w-4/5 rounded-lg shadow-lg" 
            onError={(e) => {
              console.error("Image failed to load:", e);
              const imgElement = e.currentTarget;
              // Try using the absolute URL if the relative path fails
              if (imgElement.src.endsWith('/ShiFiMidesk.png')) {
                const baseUrl = window.location.origin;
                imgElement.src = `${baseUrl}/ShiFiMidesk.png`;
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}