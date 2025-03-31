import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const personalInfoSchema = z.object({
  legalName: z.string().min(2, 'Full legal name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, 'SSN must be in format XXX-XX-XXXX'),
  taxId: z.string().optional(),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(5, 'Zip code is required'),
  country: z.string().min(1, 'Country is required'),
});

const documentUploadSchema = z.object({
  idFront: z.string().min(1, 'Front of ID is required'),
  idBack: z.string().min(1, 'Back of ID is required'),
  addressProof: z.string().min(1, 'Proof of address is required'),
});

type PersonalInfoValues = z.infer<typeof personalInfoSchema>;
type DocumentUploadValues = z.infer<typeof documentUploadSchema>;

export default function KYCVerification() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<'personal' | 'documents' | 'review'>('personal');
  const [progress, setProgress] = useState(0);
  const [personalData, setPersonalData] = useState<PersonalInfoValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const personalForm = useForm<PersonalInfoValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      legalName: '',
      dateOfBirth: '',
      ssn: '',
      taxId: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'United States',
    },
  });

  const documentForm = useForm<DocumentUploadValues>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: {
      idFront: '',
      idBack: '',
      addressProof: '',
    },
  });

  const onPersonalInfoSubmit = (data: PersonalInfoValues) => {
    setPersonalData(data);
    setStep('documents');
    setProgress(50);
  };

  const onDocumentUploadSubmit = async (data: DocumentUploadValues) => {
    setStep('review');
    setProgress(80);
  };

  const onFinalSubmit = async () => {
    if (!personalData) return;
    
    setIsSubmitting(true);
    try {
      // Combine all data and submit to the backend
      const combinedData = {
        ...personalData,
        verificationDocuments: [
          {type: 'id_front', url: documentForm.getValues('idFront')},
          {type: 'id_back', url: documentForm.getValues('idBack')},
          {type: 'address_proof', url: documentForm.getValues('addressProof')},
        ]
      };
      
      await apiRequest('POST', '/api/investor/profile', combinedData);
      
      toast({
        title: "KYC Verification Submitted",
        description: "Your KYC information has been submitted for review. You'll be notified once it's approved.",
      });
      
      setProgress(100);
      
      // Navigate to connect bank account page
      setTimeout(() => {
        setLocation('/investor/verify/bank');
      }, 1500);
    } catch (error) {
      console.error('Error submitting KYC verification:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your KYC information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const backToPersonalInfo = () => {
    setStep('personal');
    setProgress(0);
  };

  const backToDocuments = () => {
    setStep('documents');
    setProgress(50);
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">KYC Verification</h1>
        <p className="text-muted-foreground mt-2">
          To comply with regulations, we need to verify your identity before you can access the investor portal.
        </p>
      </div>

      <div className="mb-8">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground mt-2">
          <span>Personal Information</span>
          <span>Document Upload</span>
          <span>Review & Submit</span>
        </div>
      </div>

      {step === 'personal' && (
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Please provide your personal details for identity verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...personalForm}>
              <form onSubmit={personalForm.handleSubmit(onPersonalInfoSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={personalForm.control}
                    name="legalName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Robert Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={personalForm.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={personalForm.control}
                    name="ssn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Social Security Number</FormLabel>
                        <FormControl>
                          <Input placeholder="XXX-XX-XXXX" {...field} />
                        </FormControl>
                        <FormDescription>
                          Format: XXX-XX-XXXX
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={personalForm.control}
                    name="taxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Tax ID Number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Residential Address</h3>

                  <FormField
                    control={personalForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St, Apt 4B" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={personalForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="New York" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={personalForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="NY" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={personalForm.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zip Code</FormLabel>
                          <FormControl>
                            <Input placeholder="10001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={personalForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="United States" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <CardFooter className="flex justify-end px-0 pb-0">
                  <Button type="submit">
                    Continue to Document Upload
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {step === 'documents' && (
        <Card>
          <CardHeader>
            <CardTitle>Document Upload</CardTitle>
            <CardDescription>
              Please upload clear photos or scans of the following documents for verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...documentForm}>
              <form onSubmit={documentForm.handleSubmit(onDocumentUploadSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <FormField
                    control={documentForm.control}
                    name="idFront"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID Front (Driver's License or Passport)</FormLabel>
                        <FormControl>
                          <Input 
                            type="file" 
                            accept="image/*,.pdf" 
                            onChange={(e) => {
                              // For demo, we'll just use the filename
                              if (e.target.files?.[0]) {
                                field.onChange(e.target.files[0].name);
                              }
                            }} 
                          />
                        </FormControl>
                        <FormDescription>
                          Upload a clear photo or scan of the front of your ID.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={documentForm.control}
                    name="idBack"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID Back</FormLabel>
                        <FormControl>
                          <Input 
                            type="file" 
                            accept="image/*,.pdf" 
                            onChange={(e) => {
                              // For demo, we'll just use the filename
                              if (e.target.files?.[0]) {
                                field.onChange(e.target.files[0].name);
                              }
                            }} 
                          />
                        </FormControl>
                        <FormDescription>
                          Upload a clear photo or scan of the back of your ID.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={documentForm.control}
                    name="addressProof"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proof of Address</FormLabel>
                        <FormControl>
                          <Input 
                            type="file" 
                            accept="image/*,.pdf" 
                            onChange={(e) => {
                              // For demo, we'll just use the filename
                              if (e.target.files?.[0]) {
                                field.onChange(e.target.files[0].name);
                              }
                            }} 
                          />
                        </FormControl>
                        <FormDescription>
                          Upload a utility bill, bank statement, or other official document that shows your address (dated within the last 3 months).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <CardFooter className="flex justify-between px-0 pb-0">
                  <Button type="button" variant="outline" onClick={backToPersonalInfo}>
                    Back
                  </Button>
                  <Button type="submit">
                    Continue to Review
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {step === 'review' && personalData && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
            <CardDescription>
              Please review your information before submitting. Once submitted, our team will verify your identity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Full Legal Name</p>
                    <p>{personalData.legalName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date of Birth</p>
                    <p>{personalData.dateOfBirth}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">SSN</p>
                    <p>XXX-XX-{personalData.ssn.slice(-4)}</p>
                  </div>
                  {personalData.taxId && (
                    <div>
                      <p className="text-sm text-muted-foreground">Tax ID</p>
                      <p>{personalData.taxId}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-2">Residential Address</h3>
                <p>{personalData.address}</p>
                <p>{personalData.city}, {personalData.state} {personalData.zipCode}</p>
                <p>{personalData.country}</p>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-2">Uploaded Documents</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>ID Front: {documentForm.getValues('idFront')}</li>
                  <li>ID Back: {documentForm.getValues('idBack')}</li>
                  <li>Proof of Address: {documentForm.getValues('addressProof')}</li>
                </ul>
              </div>
            </div>

            <CardFooter className="flex justify-between px-0 pb-0 mt-6">
              <Button type="button" variant="outline" onClick={backToDocuments}>
                Back
              </Button>
              <Button 
                type="button" 
                onClick={onFinalSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit KYC Verification'}
              </Button>
            </CardFooter>
          </CardContent>
        </Card>
      )}
    </div>
  );
}