import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { usePlaidLink } from 'react-plaid-link';
import { CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from "@/hooks/use-toast";
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// Define form schema with validation
const formSchema = z.object({
  businessName: z.string().min(2, {
    message: "Business name must be at least 2 characters.",
  }),
  businessType: z.string({
    required_error: "Please select a business type.",
  }),
  taxId: z.string().min(9, {
    message: "Tax ID must be at least 9 characters.",
  }),
  monthlyRevenue: z.string().min(1, {
    message: "Please enter your monthly revenue.",
  }),
  yearsInBusiness: z.string().min(1, {
    message: "Please enter years in business.",
  }),
  streetAddress: z.string().min(5, {
    message: "Street address must be at least 5 characters.",
  }),
  city: z.string().min(2, {
    message: "City must be at least 2 characters.",
  }),
  state: z.string().length(2, {
    message: "Please enter a valid state code (e.g., CA, NY).",
  }),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, {
    message: "Please enter a valid ZIP code.",
  }),
  contactName: z.string().min(2, {
    message: "Contact name must be at least 2 characters.",
  }),
  contactEmail: z.string().email({
    message: "Please enter a valid email address.",
  }),
  contactPhone: z.string().regex(/^\d{10}$/, {
    message: "Please enter a valid 10-digit phone number.",
  }),
  termsAgreed: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions.",
  }),
});

type BusinessFormValues = z.infer<typeof formSchema>;

// Define the steps of the merchant signup process
enum SignupStep {
  BusinessInformation = 0,
  BankConnection = 1,
  IdentityVerification = 2,
  Complete = 3,
}

// Business types - simplified to three main options
const businessTypes = [
  { label: "Corporation", value: "corporation" },
  { label: "Limited Liability Company (LLC)", value: "llc" },
  { label: "Sole Proprietorship", value: "sole_proprietorship" },
];

export function MerchantSignup() {
  const [currentStep, setCurrentStep] = useState<SignupStep>(SignupStep.BusinessInformation);
  const [linkToken, setLinkToken] = useState<string>("");
  const [merchantId, setMerchantId] = useState<string>("");
  const [businessInfo, setBusinessInfo] = useState<BusinessFormValues | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [kycSessionUrl, setKycSessionUrl] = useState<string>("");
  const [kycSessionId, setKycSessionId] = useState<string>("");
  
  const { toast } = useToast();
  
  // Initialize form
  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      businessName: "",
      businessType: "",
      taxId: "",
      monthlyRevenue: "",
      yearsInBusiness: "",
      streetAddress: "",
      city: "",
      state: "",
      zipCode: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      termsAgreed: false,
    },
  });
  
  // Progress indicator calculation
  const getProgress = () => {
    return ((currentStep + 1) / 4) * 100;
  };
  
  // Step 1: Submit business information
  const onSubmitBusinessInfo = async (values: BusinessFormValues) => {
    setIsLoading(true);
    setBusinessInfo(values);
    
    try {
      // Request a link token from your server
      const response = await fetch('/api/plaid/merchant-signup-link-token');
      const data = await response.json();
      
      if (data.success) {
        setLinkToken(data.linkToken);
        setMerchantId(data.merchant_id);
        setCurrentStep(SignupStep.BankConnection);
      } else {
        setErrorMessage(data.message || "Failed to prepare bank connection");
        toast({
          title: "Error",
          description: data.message || "Failed to prepare bank connection",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error getting link token:', error);
      setErrorMessage("Network error. Please try again later.");
      toast({
        title: "Error",
        description: "Network error. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle Plaid Link success
  const onPlaidSuccess = async (publicToken: string, metadata: any) => {
    setIsLoading(true);
    
    try {
      // Exchange the public token for an access token
      const response = await fetch('/api/plaid/merchant-signup-exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicToken,
          merchantId,
          businessInfo,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAccounts(data.accounts || []);
        setVerificationStatus(data.verification_status || "pending");
        
        // Store KYC session information if available
        if (data.kycSessionUrl) {
          setKycSessionUrl(data.kycSessionUrl);
          setKycSessionId(data.kycSessionId || "");
        }
        
        setCurrentStep(SignupStep.IdentityVerification);
        
        toast({
          title: "Success",
          description: "Bank account connected successfully!",
        });
      } else {
        setErrorMessage(data.message || "Failed to connect bank account");
        toast({
          title: "Error",
          description: data.message || "Failed to connect bank account",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error exchanging public token:', error);
      setErrorMessage("Network error. Please try again later.");
      toast({
        title: "Error",
        description: "Network error. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Configure Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      onPlaidSuccess(public_token, metadata);
    },
    onExit: (err, metadata) => {
      if (err) {
        setErrorMessage(err.display_message || err.error_message || "An error occurred");
        toast({
          title: "Error",
          description: err.display_message || err.error_message || "An error occurred",
          variant: "destructive",
        });
      }
    },
  });
  
  // Start the DiDit identity verification process
  const startIdentityVerification = () => {
    if (kycSessionUrl) {
      // Open DiDit verification in a new tab
      window.open(kycSessionUrl, '_blank');
      
      toast({
        title: "Identity verification started",
        description: "Complete the verification process in the new tab. Once finished, return here to continue.",
      });
    } else {
      toast({
        title: "Error",
        description: "Identity verification session not available. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Check verification status
  const checkVerificationStatus = async () => {
    if (!kycSessionId || !merchantId) {
      toast({
        title: "Error",
        description: "Unable to check verification status. Missing session information.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/didit/session-status?sessionId=${kycSessionId}&merchantId=${merchantId}`);
      const data = await response.json();
      
      if (data.success) {
        setVerificationStatus(data.status);
        
        if (data.status === "approved") {
          toast({
            title: "Verification Approved",
            description: "Your identity has been successfully verified!",
          });
          
          // Move to the complete step
          setCurrentStep(SignupStep.Complete);
        } else if (data.status === "rejected") {
          toast({
            title: "Verification Failed",
            description: "Your identity verification was not successful. Please try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Verification Pending",
            description: "Your identity verification is still being processed. Please check back later.",
          });
        }
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to check verification status",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
      toast({
        title: "Error",
        description: "Network error. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Complete the merchant signup process
  const completeIdentityVerification = () => {
    // Only complete if the verification is approved or we're bypassing the check
    if (verificationStatus === "approved" || process.env.NODE_ENV === "development") {
      setCurrentStep(SignupStep.Complete);
    } else {
      toast({
        title: "Verification Required",
        description: "Please complete the identity verification before proceeding.",
        variant: "destructive",
      });
    }
  };
  
  // Render the appropriate step
  const renderStep = () => {
    switch (currentStep) {
      case SignupStep.BusinessInformation:
        return (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitBusinessInfo)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your business name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="businessType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select business type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {businessTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID (EIN/SSN)</FormLabel>
                      <FormControl>
                        <Input placeholder="Tax ID number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="monthlyRevenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Revenue</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          placeholder="Average monthly revenue" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum $100,000/month required
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="yearsInBusiness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Years in Business</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          step="0.1" 
                          placeholder="Years in operation" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum 2 years required
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="streetAddress"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Business Address</FormLabel>
                      <FormControl>
                        <AddressAutocomplete
                          value={field.value}
                          onChange={(address, placeDetails) => {
                            if (placeDetails) {
                              // Extract address components
                              const streetNumber = placeDetails.address_components?.find(
                                (component) => component.types.includes("street_number")
                              )?.long_name || "";
                              
                              const route = placeDetails.address_components?.find(
                                (component) => component.types.includes("route")
                              )?.long_name || "";
                              
                              const city = placeDetails.address_components?.find(
                                (component) => component.types.includes("locality")
                              )?.long_name || "";
                              
                              const state = placeDetails.address_components?.find(
                                (component) => component.types.includes("administrative_area_level_1")
                              )?.short_name || "";
                              
                              const zipCode = placeDetails.address_components?.find(
                                (component) => component.types.includes("postal_code")
                              )?.long_name || "";
                              
                              // Update form fields
                              field.onChange(streetNumber + " " + route);
                              form.setValue("city", city);
                              form.setValue("state", state);
                              form.setValue("zipCode", zipCode);
                            } else {
                              field.onChange(address);
                            }
                          }}
                          placeholder="Enter business address"
                          required
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="State (e.g., CA)" maxLength={2} {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code</FormLabel>
                      <FormControl>
                        <Input placeholder="ZIP Code" {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Email address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number (10 digits)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="termsAgreed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        I agree to the terms and conditions
                      </FormLabel>
                      <FormDescription>
                        By checking this box, you acknowledge that you've read and agreed to our
                        <a href="/terms" className="text-blue-600 hover:underline ml-1">
                          Terms of Service
                        </a>
                        {" "}and{" "}
                        <a href="/privacy" className="text-blue-600 hover:underline">
                          Privacy Policy
                        </a>.
                      </FormDescription>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              
              {errorMessage && (
                <div className="bg-red-50 text-red-800 p-3 rounded-md">
                  {errorMessage}
                </div>
              )}
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Processing..." : "Continue to Bank Verification"}
              </Button>
            </form>
          </Form>
        );
        
      case SignupStep.BankConnection:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">Connect Your Business Bank Account</h3>
              <p className="text-gray-500">
                We need to verify your business revenue meets our requirements.
              </p>
            </div>
            
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md mb-6">
              <p className="font-medium">Requirements:</p>
              <ul className="list-disc pl-5 mt-2">
                <li>Minimum revenue of $100,000 per month</li>
                <li>At least 2 years in business</li>
                <li>Business bank account (not personal)</li>
              </ul>
            </div>
            
            {errorMessage && (
              <div className="bg-red-50 text-red-800 p-3 rounded-md">
                {errorMessage}
              </div>
            )}
            
            <Button
              onClick={() => open()}
              disabled={!ready || isLoading}
              className="w-full"
            >
              {isLoading ? "Processing..." : "Connect Bank Account"}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setCurrentStep(SignupStep.BusinessInformation)}
              disabled={isLoading}
              className="w-full mt-2"
            >
              Back to Business Information
            </Button>
          </div>
        );
        
      case SignupStep.IdentityVerification:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">Identity Verification</h3>
              <p className="text-gray-500">
                We need to verify your identity to complete the merchant signup process.
              </p>
            </div>
            
            {accounts.length > 0 && (
              <div className="bg-green-50 text-green-800 p-4 rounded-md mb-6">
                <p className="font-medium">Bank Account Connected:</p>
                <div className="mt-2">
                  {accounts.map((account) => (
                    <div 
                      key={account.id} 
                      className={cn(
                        "p-3 border rounded-md mt-2 cursor-pointer",
                        selectedAccountId === account.id ? "border-blue-500 bg-blue-50" : "border-gray-200"
                      )}
                      onClick={() => setSelectedAccountId(account.id)}
                    >
                      <div className="font-medium">{account.name}</div>
                      <div className="text-sm text-gray-500">
                        {account.type} •••• {account.mask}
                      </div>
                      <div className="text-sm mt-1">
                        Balance: ${account.balance.toFixed(2)} {account.currency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 text-blue-800 p-4 rounded-md mb-6">
              <p className="font-medium">Identity Verification Instructions:</p>
              <ul className="list-disc pl-5 mt-2">
                <li>Complete identity verification using a government ID</li>
                <li>Verification typically takes 1-2 minutes</li>
                <li>You'll need a valid driver's license or passport</li>
                <li>We'll also verify your business ownership</li>
                <li>You'll be redirected to our secure verification partner (DiDit)</li>
              </ul>
            </div>
            
            {verificationStatus === "pending" && (
              <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5" />
                  <p className="font-medium">Verification Status: Pending</p>
                </div>
                <p>Your verification is in progress. If you've already completed the verification process, click "Check Verification Status" below.</p>
              </div>
            )}
            
            {verificationStatus === "approved" && (
              <div className="bg-green-50 text-green-800 p-4 rounded-md mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5" />
                  <p className="font-medium">Verification Status: Approved</p>
                </div>
                <p>Your identity has been successfully verified! You can now proceed to the next step.</p>
              </div>
            )}
            
            {verificationStatus === "rejected" && (
              <div className="bg-red-50 text-red-800 p-4 rounded-md mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-5 w-5" />
                  <p className="font-medium">Verification Status: Rejected</p>
                </div>
                <p>Your identity verification was unsuccessful. Please try again or contact support for assistance.</p>
              </div>
            )}
            
            {errorMessage && (
              <div className="bg-red-50 text-red-800 p-3 rounded-md">
                {errorMessage}
              </div>
            )}
            
            <div className="space-y-3">
              {!kycSessionUrl ? (
                <div className="text-amber-500 p-3 border border-amber-200 rounded-md bg-amber-50 mb-4">
                  <p className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Verification session not available
                  </p>
                  <p className="text-sm mt-1">
                    There was an issue preparing your verification session. Please try again or contact support.
                  </p>
                </div>
              ) : verificationStatus !== "approved" ? (
                <>
                  <Button
                    onClick={startIdentityVerification}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? "Processing..." : "Start Identity Verification"}
                  </Button>
                  
                  <Button
                    onClick={checkVerificationStatus}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full"
                  >
                    Check Verification Status
                  </Button>
                </>
              ) : (
                <Button
                  onClick={completeIdentityVerification}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Continue to Next Step
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={() => setCurrentStep(SignupStep.BankConnection)}
                disabled={isLoading}
                className="w-full"
              >
                Back to Bank Connection
              </Button>
            </div>
          </div>
        );
        
      case SignupStep.Complete:
        return (
          <div className="text-center space-y-6">
            <div className="bg-green-100 text-green-800 p-8 rounded-lg inline-flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold">Application Submitted!</h2>
            
            <p className="text-gray-600">
              Thank you for applying to become a ShiFi merchant. Our team will review your application and be in touch shortly.
            </p>
            
            <div className="bg-blue-50 text-blue-800 p-4 rounded-md">
              <p className="font-medium">Next Steps:</p>
              <ol className="list-decimal pl-5 mt-2 text-left">
                <li>Our underwriting team will review your application</li>
                <li>You'll receive an email with our decision within 1-2 business days</li>
                <li>If approved, we'll help you complete the onboarding process</li>
              </ol>
            </div>
            
            <Button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full mt-4"
            >
              Go to Dashboard
            </Button>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Merchant Application</h1>
        <p className="text-gray-500">Complete the steps below to apply for a ShiFi merchant account</p>
      </div>
      
      <div className="mb-8">
        <Progress value={getProgress()} className="h-2" />
        <div className="flex justify-between mt-2 text-sm">
          <div className={cn(
            "font-medium",
            currentStep >= SignupStep.BusinessInformation ? "text-blue-600" : "text-gray-400"
          )}>
            Business Info
          </div>
          <div className={cn(
            "font-medium",
            currentStep >= SignupStep.BankConnection ? "text-blue-600" : "text-gray-400"
          )}>
            Bank Verification
          </div>
          <div className={cn(
            "font-medium",
            currentStep >= SignupStep.IdentityVerification ? "text-blue-600" : "text-gray-400"
          )}>
            Identity Verification
          </div>
          <div className={cn(
            "font-medium",
            currentStep >= SignupStep.Complete ? "text-blue-600" : "text-gray-400"
          )}>
            Complete
          </div>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/2">
          <Card>
            <CardContent className="pt-6">
              {renderStep()}
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:w-1/2 flex items-center justify-center p-8">
          <img 
            src="/ShiFiMidesk.png" 
            alt="Unlock More Revenue With ShiFi Financing" 
            className="h-auto max-w-full w-4/5 rounded-lg shadow-lg" 
            onError={(e) => {
              console.error("Image failed to load:", e);
              const imgElement = e.currentTarget;
              // Try alternative paths if the image fails to load
              if (imgElement.src === '/ShiFiMidesk.png') {
                imgElement.src = '/images/ShiFiMidesk.png';
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default MerchantSignup;