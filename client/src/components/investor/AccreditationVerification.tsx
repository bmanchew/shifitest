import React, { useState } from 'react';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { UploadDropzone } from "@/components/ui/upload";
import { format } from "date-fns";

// Accreditation verification methods
type VerificationMethod = 'income' | 'net_worth' | 'professional' | 'third_party';

// Props for the accreditation verification component
interface AccreditationVerificationProps {
  investorId?: number;
  onComplete?: (method: VerificationMethod) => void;
  onCancel?: () => void;
}

// Income verification schema
const incomeVerificationSchema = z.object({
  method: z.enum(['tax_returns', 'w2', 'pay_stubs', 'cpa_letter']),
  income: z.string().min(1).transform(val => Number(val.replace(/[^0-9.]/g, ''))),
  jointIncome: z.string().optional().transform(val => val ? Number(val.replace(/[^0-9.]/g, '')) : undefined),
  currentYearEstimate: z.string().min(1).transform(val => Number(val.replace(/[^0-9.]/g, ''))),
  cpaProfessionalName: z.string().optional(),
  cpaProfessionalEmail: z.string().email().optional(),
  cpaProfessionalPhone: z.string().optional(),
  notes: z.string().optional(),
});

// Net worth verification schema
const netWorthVerificationSchema = z.object({
  method: z.enum(['bank_statements', 'brokerage_statements', 'retirement_statements', 'cpa_letter', 'appraisals']),
  totalAssets: z.string().min(1).transform(val => Number(val.replace(/[^0-9.]/g, ''))),
  totalLiabilities: z.string().min(1).transform(val => Number(val.replace(/[^0-9.]/g, ''))),
  primaryResidenceValue: z.string().optional().transform(val => val ? Number(val.replace(/[^0-9.]/g, '')) : undefined),
  primaryResidenceMortgage: z.string().optional().transform(val => val ? Number(val.replace(/[^0-9.]/g, '')) : undefined),
  calculatedNetWorth: z.number().optional(),
  cpaProfessionalName: z.string().optional(),
  cpaProfessionalEmail: z.string().email().optional(),
  cpaProfessionalPhone: z.string().optional(),
  notes: z.string().optional(),
});

// Professional certification verification schema
const professionalVerificationSchema = z.object({
  certType: z.enum(['series_7', 'series_65', 'series_82', 'other']),
  licenseNumber: z.string().min(1),
  otherCertDescription: z.string().optional(),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional(),
  notes: z.string().optional(),
});

// File upload schema for document verification
const fileUploadSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, "At least one file must be uploaded"),
  documentType: z.string().min(1),
  notes: z.string().optional(),
});

const AccreditationVerification: React.FC<AccreditationVerificationProps> = ({ 
  investorId, 
  onComplete,
  onCancel 
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<VerificationMethod>('income');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentType, setDocumentType] = useState('income_verification');
  
  // Income verification form
  const incomeForm = useForm<z.infer<typeof incomeVerificationSchema>>({
    resolver: zodResolver(incomeVerificationSchema),
    defaultValues: {
      method: 'tax_returns',
      income: '',
      jointIncome: '',
      currentYearEstimate: '',
      notes: '',
    },
  });

  // Net worth verification form
  const netWorthForm = useForm<z.infer<typeof netWorthVerificationSchema>>({
    resolver: zodResolver(netWorthVerificationSchema),
    defaultValues: {
      method: 'bank_statements',
      totalAssets: '',
      totalLiabilities: '',
      primaryResidenceValue: '',
      primaryResidenceMortgage: '',
      notes: '',
    },
  });

  // Professional certification verification form
  const professionalForm = useForm<z.infer<typeof professionalVerificationSchema>>({
    resolver: zodResolver(professionalVerificationSchema),
    defaultValues: {
      certType: 'series_7',
      licenseNumber: '',
      notes: '',
    },
  });

  // File upload form
  const uploadForm = useForm<z.infer<typeof fileUploadSchema>>({
    resolver: zodResolver(fileUploadSchema),
    defaultValues: {
      files: [],
      documentType: 'income_verification',
      notes: '',
    },
  });

  // Calculate net worth when assets or liabilities change
  React.useEffect(() => {
    const subscription = netWorthForm.watch((value, { name }) => {
      if (name === 'totalAssets' || name === 'totalLiabilities') {
        const assets = value.totalAssets ? parseFloat(String(value.totalAssets)) : 0;
        const liabilities = value.totalLiabilities ? parseFloat(String(value.totalLiabilities)) : 0;
        
        if (!isNaN(assets) && !isNaN(liabilities)) {
          netWorthForm.setValue('calculatedNetWorth', assets - liabilities);
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [netWorthForm]);

  // Submit income verification
  const onIncomeSubmit = async (data: z.infer<typeof incomeVerificationSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await axios.post('/api/investor/accreditation/verify', {
        method: 'income',
        investorId: investorId || undefined,
        ...data
      });

      if (response.data.success) {
        toast({
          title: "Verification submitted",
          description: "Your income verification has been submitted successfully.",
        });
        
        // If documents need to be uploaded, show document upload tab
        if (uploadedFiles.length === 0) {
          setDocumentType('income_verification');
          setActiveTab('third_party');
        } else {
          // Submit documents along with verification
          await handleDocumentUpload('income');
        }
        
        onComplete?.('income');
      }
    } catch (error) {
      console.error("Error submitting income verification:", error);
      toast({
        title: "Submission failed",
        description: "There was an error submitting your verification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit net worth verification
  const onNetWorthSubmit = async (data: z.infer<typeof netWorthVerificationSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await axios.post('/api/investor/accreditation/verify', {
        method: 'net_worth',
        investorId: investorId || undefined,
        ...data
      });

      if (response.data.success) {
        toast({
          title: "Verification submitted",
          description: "Your net worth verification has been submitted successfully.",
        });
        
        // If documents need to be uploaded, show document upload tab
        if (uploadedFiles.length === 0) {
          setDocumentType('net_worth_verification');
          setActiveTab('third_party');
        } else {
          // Submit documents along with verification
          await handleDocumentUpload('net_worth');
        }
        
        onComplete?.('net_worth');
      }
    } catch (error) {
      console.error("Error submitting net worth verification:", error);
      toast({
        title: "Submission failed",
        description: "There was an error submitting your verification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit professional certification verification
  const onProfessionalSubmit = async (data: z.infer<typeof professionalVerificationSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await axios.post('/api/investor/accreditation/verify', {
        method: 'professional',
        investorId: investorId || undefined,
        ...data
      });

      if (response.data.success) {
        toast({
          title: "Verification submitted",
          description: "Your professional certification has been submitted successfully.",
        });
        
        // If documents need to be uploaded, show document upload tab
        if (uploadedFiles.length === 0) {
          setDocumentType('professional_certification');
          setActiveTab('third_party');
        } else {
          // Submit documents along with verification
          await handleDocumentUpload('professional');
        }
        
        onComplete?.('professional');
      }
    } catch (error) {
      console.error("Error submitting professional certification:", error);
      toast({
        title: "Submission failed",
        description: "There was an error submitting your verification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle file uploads
  const handleFileUpload = (files: File[]) => {
    setUploadedFiles(files);
    uploadForm.setValue('files', files);
    uploadForm.clearErrors('files');
  };

  // Submit document upload
  const handleDocumentUpload = async (method?: string) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      
      // Add files to form data
      uploadedFiles.forEach((file, index) => {
        formData.append('files', file);
      });
      
      // Add other form data
      formData.append('documentType', documentType);
      formData.append('method', method || activeTab);
      
      if (investorId) {
        formData.append('investorId', investorId.toString());
      }

      const notes = uploadForm.getValues('notes');
      if (notes) {
        formData.append('notes', notes);
      }

      const response = await axios.post('/api/investor/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        toast({
          title: "Documents uploaded",
          description: `${response.data.documents.length} document(s) uploaded successfully.`,
        });
        
        // Clear the uploaded files
        setUploadedFiles([]);
        uploadForm.reset();
        
        onComplete?.(activeTab);
      }
    } catch (error) {
      console.error("Error uploading documents:", error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit document upload form
  const onDocumentSubmit = async (data: z.infer<typeof fileUploadSchema>) => {
    await handleDocumentUpload();
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Investor Accreditation Verification</CardTitle>
        <CardDescription>
          Please complete the verification process to confirm your accredited investor status. 
          Select the verification method that best applies to you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as VerificationMethod)}>
          <TabsList className="grid grid-cols-4 mb-8">
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="net_worth">Net Worth</TabsTrigger>
            <TabsTrigger value="professional">Professional</TabsTrigger>
            <TabsTrigger value="third_party">Documents</TabsTrigger>
          </TabsList>
          
          {/* Income Verification Tab */}
          <TabsContent value="income">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Income Verification</h3>
                <p className="text-sm text-muted-foreground">
                  To qualify as an accredited investor based on income, you must have earned income that exceeded $200,000 (or $300,000 together with a spouse) in each of the prior two years, and reasonably expect the same for the current year.
                </p>
              </div>
              
              <Form {...incomeForm}>
                <form onSubmit={incomeForm.handleSubmit(onIncomeSubmit)} className="space-y-6">
                  <FormField
                    control={incomeForm.control}
                    name="method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Method</FormLabel>
                        <FormControl>
                          <RadioGroup 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="tax_returns" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Tax Returns (Past 2 Years)
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="w2" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                W-2 Statements (Past 2 Years)
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="pay_stubs" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Pay Stubs (Past 2 Years)
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="cpa_letter" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                CPA or Attorney Letter
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={incomeForm.control}
                      name="income"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annual Income (Previous Year)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$" />
                          </FormControl>
                          <FormDescription>
                            Your individual income for the previous year
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={incomeForm.control}
                      name="jointIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Joint Income with Spouse (if applicable)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$" />
                          </FormControl>
                          <FormDescription>
                            Combined income with spouse (if applicable)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={incomeForm.control}
                    name="currentYearEstimate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Year Income Expectation</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="$" />
                        </FormControl>
                        <FormDescription>
                          Your reasonable expectation of income for the current year
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {incomeForm.watch('method') === 'cpa_letter' && (
                    <div className="space-y-6">
                      <Separator />
                      <h4 className="text-md font-medium">CPA or Attorney Information</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={incomeForm.control}
                          name="cpaProfessionalName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPA/Attorney Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={incomeForm.control}
                          name="cpaProfessionalEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPA/Attorney Email</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={incomeForm.control}
                          name="cpaProfessionalPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPA/Attorney Phone</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <FormField
                    control={incomeForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any additional information you would like to provide"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 flex justify-between">
                    <Button variant="outline" onClick={onCancel} type="button">
                      Cancel
                    </Button>
                    
                    {uploadedFiles.length > 0 ? (
                      <div className="flex items-center">
                        <p className="text-sm mr-2">
                          {uploadedFiles.length} file(s) selected
                        </p>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? "Submitting..." : "Submit with Documents"}
                        </Button>
                      </div>
                    ) : (
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit"}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>

              <div className="mt-6">
                <h4 className="text-sm font-medium text-muted-foreground">Supporting Documentation</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  You'll need to upload supporting documents to verify your income after completing this form.
                </p>
                <div className="mt-3">
                  <UploadDropzone 
                    onDrop={handleFileUpload}
                    maxSize={10 * 1024 * 1024} // 10MB
                    accept={{
                      'application/pdf': ['.pdf'],
                      'image/jpeg': ['.jpg', '.jpeg'],
                      'image/png': ['.png']
                    }}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Net Worth Verification Tab */}
          <TabsContent value="net_worth">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Net Worth Verification</h3>
                <p className="text-sm text-muted-foreground">
                  To qualify as an accredited investor based on net worth, your net worth must exceed $1 million, either individually or together with a spouse (excluding the value of your primary residence).
                </p>
              </div>
              
              <Form {...netWorthForm}>
                <form onSubmit={netWorthForm.handleSubmit(onNetWorthSubmit)} className="space-y-6">
                  <FormField
                    control={netWorthForm.control}
                    name="method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Method</FormLabel>
                        <FormControl>
                          <RadioGroup 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="bank_statements" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Bank Statements
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="brokerage_statements" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Brokerage Account Statements
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="retirement_statements" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Retirement Account Statements
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="appraisals" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Property/Asset Appraisals
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="cpa_letter" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                CPA or Attorney Letter
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={netWorthForm.control}
                      name="totalAssets"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Assets</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$" />
                          </FormControl>
                          <FormDescription>
                            Sum of all your assets
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={netWorthForm.control}
                      name="totalLiabilities"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Liabilities</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$" />
                          </FormControl>
                          <FormDescription>
                            Sum of all your debts and obligations
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Calculated Net Worth Display */}
                  <div className="bg-muted p-4 rounded-md">
                    <div className="font-medium">Calculated Net Worth</div>
                    <div className="text-2xl font-bold text-primary">
                      ${netWorthForm.watch('calculatedNetWorth')?.toLocaleString() || '0'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Must exceed $1,000,000 to qualify (excluding primary residence)
                    </div>
                  </div>

                  <Separator />
                  <h4 className="text-md font-medium">Primary Residence Information (Optional)</h4>
                  <p className="text-sm text-muted-foreground">
                    The value of your primary residence is excluded from the net worth calculation.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={netWorthForm.control}
                      name="primaryResidenceValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Residence Value</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={netWorthForm.control}
                      name="primaryResidenceMortgage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Residence Mortgage</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {netWorthForm.watch('method') === 'cpa_letter' && (
                    <div className="space-y-6">
                      <Separator />
                      <h4 className="text-md font-medium">CPA or Attorney Information</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={netWorthForm.control}
                          name="cpaProfessionalName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPA/Attorney Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={netWorthForm.control}
                          name="cpaProfessionalEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPA/Attorney Email</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={netWorthForm.control}
                          name="cpaProfessionalPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPA/Attorney Phone</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <FormField
                    control={netWorthForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any additional information you would like to provide"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 flex justify-between">
                    <Button variant="outline" onClick={onCancel} type="button">
                      Cancel
                    </Button>
                    
                    {uploadedFiles.length > 0 ? (
                      <div className="flex items-center">
                        <p className="text-sm mr-2">
                          {uploadedFiles.length} file(s) selected
                        </p>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? "Submitting..." : "Submit with Documents"}
                        </Button>
                      </div>
                    ) : (
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit"}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>

              <div className="mt-6">
                <h4 className="text-sm font-medium text-muted-foreground">Supporting Documentation</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  You'll need to upload supporting documents to verify your net worth after completing this form.
                </p>
                <div className="mt-3">
                  <UploadDropzone 
                    onDrop={handleFileUpload}
                    maxSize={10 * 1024 * 1024} // 10MB
                    accept={{
                      'application/pdf': ['.pdf'],
                      'image/jpeg': ['.jpg', '.jpeg'],
                      'image/png': ['.png']
                    }}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Professional Certification Tab */}
          <TabsContent value="professional">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Professional Certification</h3>
                <p className="text-sm text-muted-foreground">
                  Certain professional certifications automatically qualify you as an accredited investor. These include Series 7, Series 65, and Series 82 licenses.
                </p>
              </div>
              
              <Form {...professionalForm}>
                <form onSubmit={professionalForm.handleSubmit(onProfessionalSubmit)} className="space-y-6">
                  <FormField
                    control={professionalForm.control}
                    name="certType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certification Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a certification" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="series_7">Series 7 - General Securities Representative</SelectItem>
                            <SelectItem value="series_65">Series 65 - Investment Adviser Representative</SelectItem>
                            <SelectItem value="series_82">Series 82 - Private Securities Offerings Representative</SelectItem>
                            <SelectItem value="other">Other (specify in notes)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the certification you hold
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={professionalForm.control}
                    name="licenseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License/Registration Number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {professionalForm.watch('certType') === 'other' && (
                    <FormField
                      control={professionalForm.control}
                      name="otherCertDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Certification Description</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormDescription>
                            Please provide details about your certification
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={professionalForm.control}
                      name="issueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Issue Date</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="date" 
                              max={format(new Date(), "yyyy-MM-dd")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={professionalForm.control}
                      name="expirationDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiration Date (if applicable)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="date" 
                              min={format(new Date(), "yyyy-MM-dd")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={professionalForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any additional information you would like to provide"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 flex justify-between">
                    <Button variant="outline" onClick={onCancel} type="button">
                      Cancel
                    </Button>
                    
                    {uploadedFiles.length > 0 ? (
                      <div className="flex items-center">
                        <p className="text-sm mr-2">
                          {uploadedFiles.length} file(s) selected
                        </p>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? "Submitting..." : "Submit with Documents"}
                        </Button>
                      </div>
                    ) : (
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit"}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>

              <div className="mt-6">
                <h4 className="text-sm font-medium text-muted-foreground">Supporting Documentation</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Please upload documentation proving your certification status.
                </p>
                <div className="mt-3">
                  <UploadDropzone 
                    onDrop={handleFileUpload}
                    maxSize={10 * 1024 * 1024} // 10MB
                    accept={{
                      'application/pdf': ['.pdf'],
                      'image/jpeg': ['.jpg', '.jpeg'],
                      'image/png': ['.png']
                    }}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Document Upload Tab */}
          <TabsContent value="third_party">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Document Upload</h3>
                <p className="text-sm text-muted-foreground">
                  Upload supporting documentation to verify your accredited investor status. 
                  Documents may include tax returns, bank statements, investment account statements, 
                  or a verification letter from a CPA, attorney, or other professional.
                </p>
              </div>
              
              <Form {...uploadForm}>
                <form onSubmit={uploadForm.handleSubmit(onDocumentSubmit)} className="space-y-6">
                  <FormField
                    control={uploadForm.control}
                    name="documentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Type</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            setDocumentType(value);
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select document type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="income_verification">Income Verification Documents</SelectItem>
                            <SelectItem value="net_worth_verification">Net Worth Verification Documents</SelectItem>
                            <SelectItem value="professional_certification">Professional Certification Documents</SelectItem>
                            <SelectItem value="identity_verification">Identity Verification Documents</SelectItem>
                            <SelectItem value="cpa_attorney_letter">CPA or Attorney Letter</SelectItem>
                            <SelectItem value="other">Other Supporting Documents</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the type of document you are uploading
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={uploadForm.control}
                    name="files"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Upload Documents</FormLabel>
                        <FormControl>
                          <UploadDropzone 
                            onDrop={handleFileUpload}
                            maxFiles={5}
                            maxSize={10 * 1024 * 1024} // 10MB
                            accept={{
                              'application/pdf': ['.pdf'],
                              'image/jpeg': ['.jpg', '.jpeg'],
                              'image/png': ['.png']
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Accepted formats: PDF, JPG, PNG (Max 10MB per file, up to 5 files)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {uploadedFiles.length > 0 && (
                    <div className="bg-muted p-4 rounded-md">
                      <h4 className="font-medium mb-2">Selected Files</h4>
                      <ul className="space-y-1">
                        {uploadedFiles.map((file, index) => (
                          <li key={index} className="text-sm flex items-center">
                            <FileCheck className="h-4 w-4 mr-2 text-green-500" />
                            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <FormField
                    control={uploadForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any additional information about the uploaded documents"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 flex justify-between">
                    <Button variant="outline" onClick={onCancel} type="button">
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || uploadedFiles.length === 0}
                    >
                      {isSubmitting ? "Uploading..." : "Upload Documents"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex flex-col items-start">
        <p className="text-sm text-muted-foreground">
          The information provided will be reviewed by our team to confirm your accredited investor status. 
          This process typically takes 1-3 business days. You will receive email notifications about your verification status.
        </p>
      </CardFooter>
    </Card>
  );
};

export default AccreditationVerification;