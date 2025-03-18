
import React, { useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

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

export default function MerchantSignup() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<SignupFormData>({} as SignupFormData);
  const [plaidToken, setPlaidToken] = useState("");
  const [files, setFiles] = useState<{[key: string]: File}>({});

  const { open, ready } = usePlaidLink({
    token: plaidToken,
    onSuccess: (public_token, metadata) => {
      handlePlaidSuccess(public_token, metadata);
    }
  });

  const handlePlaidSuccess = async (public_token: string, metadata: any) => {
    try {
      const response = await fetch('/api/plaid/merchant/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicToken: public_token,
          accountId: metadata.account_id,
          merchantData: formData
        })
      });
      
      if (!response.ok) throw new Error('Failed to complete merchant onboarding');
      
      // Move to next step after successful Plaid connection
      setStep(step + 1);
    } catch (error) {
      console.error('Error completing Plaid onboarding:', error);
    }
  };

  const initiatePlaidLink = async () => {
    try {
      const response = await fetch('/api/plaid/merchant/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: formData.companyName,
          legalName: formData.legalBusinessName,
          email: formData.email
        })
      });

      const data = await response.json();
      if (data.success) {
        setPlaidToken(data.data.linkToken);
        open();
      }
    } catch (error) {
      console.error('Error initiating Plaid:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step < 4) {
      setStep(step + 1);
      return;
    }

    // Create form data for file upload
    const formDataWithFiles = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formDataWithFiles.append(key, value);
    });
    
    Object.entries(files).forEach(([key, file]) => {
      formDataWithFiles.append(key, file);
    });

    try {
      const response = await fetch('/api/merchants/signup', {
        method: 'POST',
        body: formDataWithFiles
      });

      if (!response.ok) throw new Error('Signup failed');
      
      // Handle successful signup
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="text"
                placeholder="First Name"
                className="input"
                value={formData.firstName}
                onChange={e => setFormData({...formData, firstName: e.target.value})}
              />
              <input 
                type="text"
                placeholder="Last Name"
                className="input"
                value={formData.lastName}
                onChange={e => setFormData({...formData, lastName: e.target.value})}
              />
              <input 
                type="email"
                placeholder="Email"
                className="input"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
              <input 
                type="tel"
                placeholder="Phone"
                className="input"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
              <input 
                type="text"
                placeholder="Company Name"
                className="input"
                value={formData.companyName}
                onChange={e => setFormData({...formData, companyName: e.target.value})}
              />
              <input 
                type="text"
                placeholder="Industry"
                className="input"
                value={formData.industry}
                onChange={e => setFormData({...formData, industry: e.target.value})}
              />
              <input 
                type="url"
                placeholder="Website"
                className="input"
                value={formData.website}
                onChange={e => setFormData({...formData, website: e.target.value})}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Business Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="text"
                placeholder="Legal Business Name"
                className="input"
                value={formData.legalBusinessName}
                onChange={e => setFormData({...formData, legalBusinessName: e.target.value})}
              />
              <input 
                type="text"
                placeholder="DBA"
                className="input"
                value={formData.dba}
                onChange={e => setFormData({...formData, dba: e.target.value})}
              />
              <select 
                className="input"
                value={formData.businessStructure}
                onChange={e => setFormData({...formData, businessStructure: e.target.value})}
              >
                <option value="">Select Business Structure</option>
                <option value="llc">LLC</option>
                <option value="corporation">Corporation</option>
                <option value="soleProprietor">Sole Proprietor</option>
              </select>
              <input 
                type="text"
                placeholder="EIN"
                className="input"
                value={formData.ein}
                onChange={e => setFormData({...formData, ein: e.target.value})}
              />
              {/* Add more business detail fields */}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Financial Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="number"
                placeholder="Estimated Monthly Revenue"
                className="input"
                value={formData.estimatedMonthlyRevenue}
                onChange={e => setFormData({...formData, estimatedMonthlyRevenue: e.target.value})}
              />
              <input 
                type="number"
                placeholder="Annual Financed Volume"
                className="input"
                value={formData.annualFinancedVolume}
                onChange={e => setFormData({...formData, annualFinancedVolume: e.target.value})}
              />
              <button 
                type="button"
                onClick={initiatePlaidLink}
                className="btn btn-primary col-span-2"
                disabled={!ready}
              >
                Connect Bank Account
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Document Upload</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label>Voided Check</label>
                <input 
                  type="file"
                  className="input"
                  onChange={e => setFiles({...files, voidedCheck: e.target.files?.[0]})}
                />
              </div>
              <div>
                <label>Bank Statements</label>
                <input 
                  type="file"
                  multiple
                  className="input"
                  onChange={e => setFiles({...files, bankStatements: e.target.files?.[0]})}
                />
              </div>
              {/* Add more file upload fields */}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Merchant Signup</h1>
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        {renderStep()}
        <div className="mt-8 flex justify-between">
          {step > 1 && (
            <button 
              type="button" 
              onClick={() => setStep(step - 1)}
              className="btn"
            >
              Previous
            </button>
          )}
          <button 
            type="submit" 
            className="btn btn-primary"
          >
            {step === 4 ? 'Submit' : 'Next'}
          </button>
        </div>
      </form>
    </div>
  );
}
