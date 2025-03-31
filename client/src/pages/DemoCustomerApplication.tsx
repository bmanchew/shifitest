import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  ArrowLeft, 
  ChevronRight, 
  Building2, 
  CreditCard, 
  FileCheck,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, 
} from '@/components/ui/select';

// Define application steps
enum ApplicationStep {
  BusinessInfo = 1,
  BankConnection = 2,
  IdentityVerification = 3,
  Complete = 4
}

// Schema for business info form
const businessInfoSchema = z.object({
  businessName: z.string().min(2, { message: 'Business name must be at least 2 characters' }),
  businessType: z.string().min(1, { message: 'Please select a business type' }),
  website: z.string().url({ message: 'Please enter a valid URL' }).or(z.string().length(0)),
  address: z.string().min(5, { message: 'Please enter a valid address' }),
  city: z.string().min(2, { message: 'Please enter a valid city' }),
  state: z.string().min(2, { message: 'Please enter a valid state' }),
  zipCode: z.string().min(5, { message: 'Please enter a valid ZIP code' }),
  annualRevenue: z.string().min(1, { message: 'Please enter your annual revenue' }),
  yearsInBusiness: z.string().min(1, { message: 'Please select years in business' }),
  industry: z.string().min(1, { message: 'Please select your industry' }),
  description: z.string().min(10, { message: 'Please provide a brief description of your business' }),
});

type BusinessInfoFormValues = z.infer<typeof businessInfoSchema>;

// Define steps
const steps = [
  { id: ApplicationStep.BusinessInfo, name: 'Business Info', icon: Building2 },
  { id: ApplicationStep.BankConnection, name: 'Bank Connection', icon: CreditCard },
  { id: ApplicationStep.IdentityVerification, name: 'Identity Verification', icon: FileCheck },
];

export default function DemoCustomerApplication() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<ApplicationStep>(ApplicationStep.BusinessInfo);
  const [isLoading, setIsLoading] = useState(false);
  const [mockBankAccounts, setMockBankAccounts] = useState<any[]>([]);
  const [kycSessionUrl, setKycSessionUrl] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>('pending');

  // Initialize business info form
  const businessInfoForm = useForm<BusinessInfoFormValues>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: {
      businessName: '',
      businessType: '',
      website: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      annualRevenue: '',
      yearsInBusiness: '',
      industry: '',
      description: '',
    },
  });

  // Calculate progress percentage
  const getProgress = () => {
    return ((currentStep - 1) / (steps.length)) * 100;
  };

  // Handle business info submission
  const onBusinessInfoSubmit = async (data: BusinessInfoFormValues) => {
    setIsLoading(true);
    
    // Simulate API request delay
    setTimeout(() => {
      console.log('Business info submitted:', data);
      setCurrentStep(ApplicationStep.BankConnection);
      
      // Mock bank accounts data
      setMockBankAccounts([
        {
          id: 'acct_123456',
          name: 'Business Checking',
          mask: '1234',
          type: 'checking',
          subtype: 'business',
          balance: 24750.55,
          currency: 'USD'
        },
        {
          id: 'acct_654321',
          name: 'Business Savings',
          mask: '5678',
          type: 'savings',
          subtype: 'business',
          balance: 105250.42,
          currency: 'USD'
        }
      ]);
      
      setIsLoading(false);
      
      toast({
        title: 'Business information saved',
        description: 'Please connect your bank account in the next step.',
      });
    }, 1500);
  };

  // Simulate Plaid link connection
  const connectBankAccount = () => {
    setIsLoading(true);
    
    // Simulate API request delay
    setTimeout(() => {
      console.log('Bank account connected');
      setCurrentStep(ApplicationStep.IdentityVerification);
      
      // Mock KYC session URL - in a real implementation, this would come from the backend
      setKycSessionUrl('/demo/mock-kyc-verification');
      
      setIsLoading(false);
      
      toast({
        title: 'Bank account connected',
        description: 'Please complete identity verification in the next step.',
      });
    }, 1500);
  };

  // Start identity verification
  const startIdentityVerification = () => {
    // Open mock KYC verification UI in a new tab
    // For demo purposes, we'll just show a modal and simulate completion
    setIsLoading(true);
    
    // Simulate API request delay
    setTimeout(() => {
      console.log('Identity verification completed');
      setVerificationStatus('approved');
      
      toast({
        title: 'Identity verified',
        description: 'Your identity has been successfully verified.',
      });
      
      // Move to completed step
      setTimeout(() => {
        setCurrentStep(ApplicationStep.Complete);
        setIsLoading(false);
      }, 1000);
    }, 2000);
  };

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case ApplicationStep.BusinessInfo:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Tell us about your business to begin the application process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...businessInfoForm}>
                <form onSubmit={businessInfoForm.handleSubmit(onBusinessInfoSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={businessInfoForm.control}
                      name="businessName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC Company" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={businessInfoForm.control}
                      name="businessType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Type</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select business type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                              <SelectItem value="llc">LLC</SelectItem>
                              <SelectItem value="corporation">Corporation</SelectItem>
                              <SelectItem value="partnership">Partnership</SelectItem>
                              <SelectItem value="nonprofit">Non-profit</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={businessInfoForm.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://www.example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={businessInfoForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <FormField
                      control={businessInfoForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="San Francisco" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={businessInfoForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="CA" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={businessInfoForm.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl>
                            <Input placeholder="94103" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={businessInfoForm.control}
                      name="annualRevenue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annual Revenue</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select annual revenue" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0-100k">$0 - $100,000</SelectItem>
                              <SelectItem value="100k-500k">$100,000 - $500,000</SelectItem>
                              <SelectItem value="500k-1m">$500,000 - $1,000,000</SelectItem>
                              <SelectItem value="1m-5m">$1,000,000 - $5,000,000</SelectItem>
                              <SelectItem value="5m+">$5,000,000+</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={businessInfoForm.control}
                      name="yearsInBusiness"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Years in Business</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select years in business" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0-1">Less than 1 year</SelectItem>
                              <SelectItem value="1-3">1-3 years</SelectItem>
                              <SelectItem value="3-5">3-5 years</SelectItem>
                              <SelectItem value="5-10">5-10 years</SelectItem>
                              <SelectItem value="10+">10+ years</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={businessInfoForm.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="technology">Technology</SelectItem>
                            <SelectItem value="healthcare">Healthcare</SelectItem>
                            <SelectItem value="education">Education & Training</SelectItem>
                            <SelectItem value="financial">Financial Services</SelectItem>
                            <SelectItem value="retail">Retail</SelectItem>
                            <SelectItem value="manufacturing">Manufacturing</SelectItem>
                            <SelectItem value="construction">Construction</SelectItem>
                            <SelectItem value="hospitality">Hospitality</SelectItem>
                            <SelectItem value="professional">Professional Services</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={businessInfoForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Briefly describe your business and how you plan to use funding..." 
                            {...field} 
                            rows={3}
                          />
                        </FormControl>
                        <FormDescription>
                          Provide a brief description of your business and how you plan to use the funding.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Continue to Bank Connection
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        );
        
      case ApplicationStep.BankConnection:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Connect Your Bank Account</CardTitle>
              <CardDescription>
                Securely connect your business bank account to verify your financial information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-muted p-4">
                <h3 className="text-lg font-medium mb-2">Why we need your bank information</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Verify your business revenue and transaction history</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Ensure eligibility for ShiFi financing</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Secure and encrypted - we never store your login credentials</span>
                  </li>
                </ul>
              </div>
              
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-6">
                  Click the button below to securely connect your bank account through our trusted partner, Plaid.
                </p>
                
                <Button 
                  size="lg" 
                  onClick={connectBankAccount}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect Bank Account
                      <CreditCard className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
              
              {mockBankAccounts.length > 0 && !isLoading && (
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-4">Connected Accounts</h3>
                  <div className="space-y-3">
                    {mockBankAccounts.map(account => (
                      <div key={account.id} className="flex justify-between items-center p-3 border rounded-md">
                        <div>
                          <div className="font-medium">{account.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {account.type.charAt(0).toUpperCase() + account.type.slice(1)} •••• {account.mask}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-sm text-muted-foreground">{account.currency}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
        
      case ApplicationStep.IdentityVerification:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Identity Verification</CardTitle>
              <CardDescription>
                Complete the verification process to confirm your identity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-muted p-4">
                <h3 className="text-lg font-medium mb-2">What to expect</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>You'll need a valid government ID (passport, driver's license, or state ID)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Takes approximately 2-3 minutes to complete</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Secure and encrypted verification process</span>
                  </li>
                </ul>
              </div>
              
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-6">
                  Click the button below to begin the identity verification process.
                </p>
                
                {verificationStatus === 'pending' ? (
                  <Button 
                    size="lg" 
                    onClick={startIdentityVerification}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Begin Verification
                        <FileCheck className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    <span>Identity verification complete! Your application is now being processed.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
        
      case ApplicationStep.Complete:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Application Complete!</CardTitle>
              <CardDescription>
                Thank you for applying to ShiFi
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-6 space-y-6">
              <div className="mx-auto bg-green-100 rounded-full p-3 w-16 h-16 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              
              <h2 className="text-2xl font-bold">Application Submitted!</h2>
              
              <p className="text-gray-600">
                Thank you for applying to ShiFi. Our team will review your application and be in touch shortly.
              </p>
              
              <div className="bg-blue-50 text-blue-800 p-4 rounded-md">
                <p className="font-medium">Next Steps:</p>
                <ol className="list-decimal pl-5 mt-2 text-left">
                  <li>Our underwriting team will review your application</li>
                  <li>You'll receive an email with our decision within 1-2 business days</li>
                  <li>If approved, we'll help you complete the onboarding process</li>
                </ol>
              </div>
            </CardContent>
            <CardFooter className="justify-center">
              <Button 
                variant="default" 
                className="w-full max-w-xs"
                onClick={() => navigate('/investor')}
              >
                Return to Investor Portal
              </Button>
            </CardFooter>
          </Card>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          className="mb-4 gap-1"
          onClick={() => navigate('/investor')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Investor Portal
        </Button>
        
        <h1 className="text-3xl font-bold mb-2">Demo: Customer Application</h1>
        <p className="text-muted-foreground">
          Experience the customer application flow that businesses go through when applying for ShiFi financing.
          This is a simulated experience for demonstration purposes.
        </p>
      </div>
      
      <div className="mb-8">
        <Progress value={getProgress()} className="h-2" />
        <div className="flex justify-between mt-4">
          {steps.map((step) => (
            <div key={step.id} className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center
                ${currentStep >= step.id 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : 'border-muted-foreground/30 text-muted-foreground'}`}
              >
                {step.icon && <step.icon className="h-5 w-5" />}
              </div>
              <span className={`text-sm mt-2 ${currentStep >= step.id ? 'font-medium' : 'text-muted-foreground'}`}>
                {step.name}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {renderStepContent()}
    </div>
  );
}