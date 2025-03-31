import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle,
  Download,
  FileText,
  Info,
  Percent,
  RefreshCw,
  Shield,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Investment form schema
const investmentFormSchema = z.object({
  amount: z
    .string()
    .min(1, { message: "Investment amount is required." })
    .refine(
      (value) => !isNaN(Number(value)) && Number(value) > 0,
      { message: "Amount must be a positive number." }
    ),
  terms: z.boolean().refine((value) => value === true, {
    message: "You must agree to the terms and conditions.",
  }),
});

type InvestmentFormValues = z.infer<typeof investmentFormSchema>;

export default function OfferingDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Fetch investor profile to check verification status
  const profileQuery = useQuery({
    queryKey: ["/api/investor/profile"],
    retry: false,
  });
  
  // Fetch offering details
  const offeringQuery = useQuery({
    queryKey: ["/api/investor/offerings", id],
    retry: false,
  });
  
  // Fetch offering documents
  const documentsQuery = useQuery({
    queryKey: ["/api/investor/offerings/documents", id],
    retry: false,
  });
  
  // Create investment mutation
  const investMutation = useMutation({
    mutationFn: (data: InvestmentFormValues) => {
      return apiRequest("/api/investor/investments", {
        method: "POST",
        data: {
          offeringId: id,
          amount: Number(data.amount),
        },
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Investment successful!",
        description: "Your investment has been processed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/investor/investments"] });
      
      // Redirect to the investment detail page
      if (data.investment?.id) {
        navigate(`/investor/investments/${data.investment.id}`);
      } else {
        navigate("/investor/investments");
      }
    },
    onError: (error: any) => {
      console.error("Investment error:", error);
      toast({
        title: "Investment failed",
        description: error.message || "There was an error processing your investment. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Investment form
  const form = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentFormSchema),
    defaultValues: {
      amount: "",
      terms: false,
    },
  });
  
  // Form submission handler
  function onSubmit(data: InvestmentFormValues) {
    investMutation.mutate(data);
  }
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };
  
  // Generate payment schedule preview
  const generatePaymentSchedule = (amount: number, interestRate: number, termMonths: number) => {
    const payments = [];
    const quarterlyInterest = amount * (interestRate / 100) * (3 / 12);
    const startDate = new Date();
    
    for (let i = 0; i < Math.ceil(termMonths / 3); i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(startDate.getMonth() + (i + 1) * 3);
      
      const isLast = i === Math.ceil(termMonths / 3) - 1;
      
      payments.push({
        quarter: i + 1,
        date: paymentDate,
        interest: quarterlyInterest,
        principal: isLast ? amount : 0,
        total: quarterlyInterest + (isLast ? amount : 0),
      });
    }
    
    return payments;
  };
  
  // Check if profile is verified for investing
  const isProfileVerified = () => {
    if (!profileQuery.data?.profile) return false;
    
    const { kycStatus, bankAccountName, ndaSigned } = profileQuery.data.profile;
    return kycStatus === "verified" && !!bankAccountName && !!ndaSigned;
  };
  
  // Get the reason why the user can't invest
  const getInvestmentBlockReason = () => {
    if (!profileQuery.data?.profile) return "profile_missing";
    
    const { kycStatus, bankAccountName, ndaSigned } = profileQuery.data.profile;
    
    if (!ndaSigned) return "nda_missing";
    if (kycStatus !== "verified") {
      if (kycStatus === "pending") return "kyc_pending";
      return "kyc_incomplete";
    }
    if (!bankAccountName) return "bank_missing";
    
    return null;
  };
  
  // Loading state
  if (offeringQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="animate-pulse">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="animate-pulse bg-muted h-8 w-1/2 rounded"></CardTitle>
            <CardDescription className="animate-pulse bg-muted h-4 w-2/3 rounded"></CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="animate-pulse bg-muted h-48 rounded"></div>
            <div className="space-y-2">
              <div className="animate-pulse bg-muted h-4 w-1/4 rounded"></div>
              <div className="animate-pulse bg-muted h-10 w-full rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Error state
  if (offeringQuery.isError || !offeringQuery.data?.offering) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/investor/offerings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Offerings
            </Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              There was an error loading the offering details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/investor/offerings">View All Offerings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const offering = offeringQuery.data.offering;
  const documents = documentsQuery.data?.documents || [];
  
  // Calculate funding percentage
  const fundingPercentage = Math.min(
    Math.round((offering.totalRaised / offering.totalTarget) * 100),
    100
  );
  
  // Calculate expected return for a given investment amount
  const calculateExpectedReturn = (amount: number) => {
    const annualInterest = amount * (offering.interestRate / 100);
    const totalInterest = annualInterest * (offering.termMonths / 12);
    return amount + totalInterest;
  };
  
  // Get investment block reason message
  const getBlockReasonMessage = () => {
    const reason = getInvestmentBlockReason();
    
    switch (reason) {
      case "profile_missing":
        return "Please complete your investor profile to start investing.";
      case "nda_missing":
        return "You need to sign the Non-Disclosure Agreement before investing.";
      case "kyc_incomplete":
        return "You need to complete the KYC verification process to invest.";
      case "kyc_pending":
        return "Your KYC verification is currently being reviewed. You'll be able to invest once approved.";
      case "bank_missing":
        return "You need to connect a bank account to make investments.";
      default:
        return null;
    }
  };
  
  // Calculate investment preview data based on form input
  const investmentAmount = form.watch("amount") ? parseFloat(form.watch("amount")) : 0;
  const isValidAmount = !isNaN(investmentAmount) && investmentAmount >= (offering.minimumInvestment || 0);
  
  // Calculate payment schedule for preview
  const paymentSchedule = isValidAmount
    ? generatePaymentSchedule(investmentAmount, offering.interestRate, offering.termMonths)
    : [];
  
  const totalReturn = isValidAmount
    ? calculateExpectedReturn(investmentAmount)
    : 0;
  
  const totalProfit = isValidAmount
    ? totalReturn - investmentAmount
    : 0;
  
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <Link href="/investor/offerings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Offerings
          </Button>
        </Link>
      </div>
      
      {/* Main investment card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{offering.name}</CardTitle>
              <CardDescription className="text-base">
                {offering.description}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="gap-1">
                <Percent className="h-3.5 w-3.5" />
                {offering.interestRate}% APY
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {offering.termMonths} months
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Funding progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Funding Progress</span>
              <span>{fundingPercentage}%</span>
            </div>
            <Progress value={fundingPercentage} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatCurrency(offering.totalRaised)} raised</span>
              <span>Target: {formatCurrency(offering.totalTarget)}</span>
            </div>
          </div>
          
          {/* Key details cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-muted/30 border">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5" />
                    Minimum Investment
                  </span>
                  <span className="text-lg font-bold mt-1">{formatCurrency(offering.minimumInvestment)}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-muted/30 border">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3.5 w-3.5" />
                    Interest Rate
                  </span>
                  <span className="text-lg font-medium mt-1">{offering.interestRate}% APY</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-muted/30 border">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Term Length
                  </span>
                  <span className="text-lg font-medium mt-1">{offering.termMonths} months</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-muted/30 border">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    Payment Frequency
                  </span>
                  <span className="text-lg font-medium mt-1">Quarterly</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Tabs for different sections */}
          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="investment">Investment</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">About This Offering</h3>
                  <p className="mt-2">{offering.longDescription || offering.description}</p>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-semibold">Investment Details</h3>
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col space-y-1.5">
                        <span className="text-sm font-medium">Interest Rate</span>
                        <span className="text-lg">{offering.interestRate}% APY</span>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <span className="text-sm font-medium">Term Length</span>
                        <span className="text-lg">{offering.termMonths} months</span>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <span className="text-sm font-medium">Payment Frequency</span>
                        <span className="text-lg">Quarterly</span>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <span className="text-sm font-medium">Minimum Investment</span>
                        <span className="text-lg">{formatCurrency(offering.minimumInvestment)}</span>
                      </div>
                    </div>
                    
                    <Alert className="bg-blue-50 border-blue-200">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-800">Return Structure</AlertTitle>
                      <AlertDescription className="text-blue-700">
                        This investment pays quarterly interest at {offering.interestRate}% APY. 
                        Your principal will be returned at the end of the {offering.termMonths}-month term.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-semibold">Key Features</h3>
                  <ul className="mt-2 space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Fixed Interest Rate</p>
                        <p className="text-sm text-muted-foreground">
                          Guaranteed {offering.interestRate}% APY regardless of market conditions
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Quarterly Payments</p>
                        <p className="text-sm text-muted-foreground">
                          Consistent interest payments every three months
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Blockchain-Backed Security</p>
                        <p className="text-sm text-muted-foreground">
                          Each investment is tokenized and recorded on the blockchain for security and transparency
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Principal Protection</p>
                        <p className="text-sm text-muted-foreground">
                          Your original investment amount is returned at maturity
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-semibold">FAQs</h3>
                  <Accordion type="single" collapsible className="mt-2">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>How are my returns calculated?</AccordionTrigger>
                      <AccordionContent>
                        Returns are calculated based on the annual interest rate of {offering.interestRate}%. 
                        Interest payments are made quarterly, with each payment being 1/4 of your annual interest.
                        For example, if you invest $10,000, your annual interest would be ${(10000 * offering.interestRate / 100).toFixed(0)},
                        with quarterly payments of ${(10000 * offering.interestRate / 100 / 4).toFixed(0)}.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>When do I receive my principal back?</AccordionTrigger>
                      <AccordionContent>
                        Your principal investment is returned at the end of the {offering.termMonths}-month term,
                        along with your final interest payment.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                      <AccordionTrigger>Can I withdraw my investment early?</AccordionTrigger>
                      <AccordionContent>
                        Early withdrawals are generally not available for this fixed-term investment.
                        The investment is designed to be held for the full {offering.termMonths}-month term to 
                        maximize returns and maintain the stability of the fund.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-4">
                      <AccordionTrigger>How is my investment secured?</AccordionTrigger>
                      <AccordionContent>
                        All investments are tokenized on the blockchain, providing an immutable record
                        of ownership and transaction history. Additionally, the fund is backed by
                        high-quality merchant financing contracts with strong underwriting standards.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            </TabsContent>
            
            {/* Investment Tab */}
            <TabsContent value="investment" className="space-y-6 pt-4">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Investment Form */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Make an Investment</h3>
                  {!isProfileVerified() && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Action Required</AlertTitle>
                      <AlertDescription>
                        {getBlockReasonMessage()}
                        {getInvestmentBlockReason() === "nda_missing" && (
                          <Button variant="outline" className="mt-2 bg-white" asChild>
                            <Link href="/investor/profile?tab=nda">Complete NDA</Link>
                          </Button>
                        )}
                        {(getInvestmentBlockReason() === "kyc_incomplete" || getInvestmentBlockReason() === "profile_missing") && (
                          <Button variant="outline" className="mt-2 bg-white" asChild>
                            <Link href="/investor/profile?tab=kyc">Complete KYC</Link>
                          </Button>
                        )}
                        {getInvestmentBlockReason() === "bank_missing" && (
                          <Button variant="outline" className="mt-2 bg-white" asChild>
                            <Link href="/investor/profile?tab=bank">Connect Bank Account</Link>
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Investment Amount</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                  $
                                </span>
                                <Input
                                  {...field}
                                  placeholder="10,000"
                                  className="pl-8"
                                  disabled={!isProfileVerified() || investMutation.isPending}
                                />
                              </div>
                            </FormControl>
                            <FormDescription>
                              Minimum investment: {formatCurrency(offering.minimumInvestment)}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Card className="border border-blue-200 bg-blue-50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base text-blue-800">Investment Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2 text-blue-700">
                          <div className="flex justify-between">
                            <span>Principal Amount:</span>
                            <span className="font-medium">{isValidAmount ? formatCurrency(investmentAmount) : '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Term Length:</span>
                            <span className="font-medium">{offering.termMonths} months</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Interest Rate:</span>
                            <span className="font-medium">{offering.interestRate}% APY</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Payment Schedule:</span>
                            <span className="font-medium">Quarterly</span>
                          </div>
                          <Separator className="my-1 bg-blue-200" />
                          <div className="flex justify-between">
                            <span>Total Expected Return:</span>
                            <span className="font-medium">{isValidAmount ? formatCurrency(totalReturn) : '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Expected Profit:</span>
                            <span className="font-medium text-green-600">{isValidAmount ? formatCurrency(totalProfit) : '-'}</span>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <FormField
                        control={form.control}
                        name="terms"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <div className="mt-1">
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={field.onChange}
                                  disabled={!isProfileVerified() || investMutation.isPending}
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                              </div>
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                I agree to the investment terms and conditions
                              </FormLabel>
                              <FormDescription>
                                By checking this box, you confirm that you have read and agree to the
                                investment terms and conditions outlined in the offering documents.
                              </FormDescription>
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={!isProfileVerified() || investMutation.isPending}
                      >
                        {investMutation.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Confirm Investment"
                        )}
                      </Button>
                    </form>
                  </Form>
                </div>
                
                {/* Investment Preview */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Payment Schedule Preview</h3>
                  
                  {isValidAmount ? (
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Quarter</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Interest</TableHead>
                            <TableHead className="text-right">Principal</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentSchedule.map((payment) => (
                            <TableRow key={payment.quarter}>
                              <TableCell>Q{payment.quarter}</TableCell>
                              <TableCell>{formatDate(payment.date.toISOString())}</TableCell>
                              <TableCell className="text-right">{formatCurrency(payment.interest)}</TableCell>
                              <TableCell className="text-right">
                                {payment.principal > 0 ? formatCurrency(payment.principal) : "-"}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(payment.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      <Alert className="bg-green-50 border-green-200">
                        <Info className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-800">Investment Summary</AlertTitle>
                        <AlertDescription className="text-green-700">
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between">
                              <span>Total Investment:</span>
                              <span className="font-medium">{formatCurrency(investmentAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total Interest Earned:</span>
                              <span className="font-medium">{formatCurrency(totalProfit)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total Return:</span>
                              <span className="font-medium">{formatCurrency(totalReturn)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Return on Investment:</span>
                              <span className="font-medium">
                                {((totalProfit / investmentAmount) * 100).toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 border rounded-md">
                      <Calendar className="h-12 w-12 text-muted-foreground mb-3" />
                      <h3 className="text-lg font-medium">Enter an Amount</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        Enter a valid investment amount to see a preview of your payment schedule.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-4 pt-4">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Offering Documents</h3>
                <p className="text-muted-foreground">
                  Review these important documents before investing. These documents contain detailed information about the investment terms, 
                  risk factors, and legal disclosures.
                </p>
                
                {documents.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {documents.map((document) => (
                      <div key={document.id} className="flex flex-col border rounded-md">
                        <div className="border-b p-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {document.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {document.description}
                          </p>
                        </div>
                        <div className="p-3 mt-auto">
                          <Button variant="outline" className="w-full gap-1" asChild>
                            <Link href={document.url} target="_blank">
                              <Download className="h-4 w-4" />
                              Download PDF
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center border rounded-md">
                    <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                    <h3 className="text-lg font-medium">No Documents Available</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                      There are currently no documents available for this offering.
                    </p>
                  </div>
                )}
                
                <Separator />
                
                <h3 className="text-lg font-semibold">Required Legal Disclosures</h3>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Important Investment Information</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-2 text-sm">
                      <p>
                        This investment opportunity is available only to verified investors. Past performance 
                        is not indicative of future results. Investment involves risk, including the possible 
                        loss of principal.
                      </p>
                      <p>
                        Please read all offering documents carefully before investing. By investing, you 
                        acknowledge that you have read and understood all disclosures and agree to the terms 
                        and conditions.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        
        <CardFooter className="flex-col space-y-2 items-start sm:flex-row sm:items-center sm:space-y-0 sm:justify-between border-t pt-6">
          <div className="text-sm text-muted-foreground">
            Offering ID: {offering.id} • Listed on {formatDate(offering.createdAt)}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/investor/offerings">
                View All Offerings
              </Link>
            </Button>
            
            <Button 
              onClick={() => setActiveTab("investment")} 
              disabled={!isProfileVerified()}
            >
              Invest Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}