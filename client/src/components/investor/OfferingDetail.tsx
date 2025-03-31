import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Download,
  FileText,
  Info,
  LineChart,
  PieChart,
  Wallet,
} from "lucide-react";
import { InvestorLayout } from "./InvestorLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

// Types
interface Offering {
  id: number;
  name: string;
  description: string;
  status: "available" | "fully_funded" | "completed" | "upcoming";
  offeringType: "fixed_term_15_2yr" | "fixed_term_18_4yr";
  interestRate: number;
  termMonths: number;
  minimumInvestment: number;
  totalTarget: number;
  totalRaised: number;
  riskLevel: "low" | "moderate" | "high";
  expectedYield: number;
  contractCount: number;
  averageContractSize: number;
  createdAt: string;
  startDate: string;
  endDate: string | null;
  fundingDeadline: string;
  detailedDescription?: string;
  investmentTerms?: string;
  riskFactors?: string[];
  historicalPerformance?: {
    period: string;
    return: number;
  }[];
  projectedReturns?: {
    year: number;
    amount: number;
  }[];
  contractDetails?: {
    industry: string;
    averageTermLength: number;
    merchantCount: number;
    defaultRate: number;
  };
}

interface RelatedDocument {
  id: number;
  title: string;
  description: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  requiresNda: boolean;
  canAccess: boolean;
}

interface InvestorProfile {
  isVerified: boolean;
  kycStatus: "not_started" | "pending" | "verified" | "rejected";
  hasBankAccount: boolean;
  availableBalance: number;
}

// Helper functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getRiskLabel = (risk: Offering["riskLevel"]) => {
  switch (risk) {
    case "low":
      return "Low Risk";
    case "moderate":
      return "Moderate Risk";
    case "high":
      return "High Risk";
    default:
      return "Unknown";
  }
};

const getOfferingTypeLabel = (type: Offering["offeringType"]) => {
  switch (type) {
    case "fixed_term_15_2yr":
      return "Fixed 15% - 2 Year Term";
    case "fixed_term_18_4yr":
      return "Fixed 18% - 4 Year Term";
    default:
      return "Custom Offering";
  }
};

// Investment form component
function InvestmentForm({
  offering,
  investorProfile,
  onSuccess,
}: {
  offering: Offering;
  investorProfile: InvestorProfile;
  onSuccess: () => void;
}) {
  const [investmentAmount, setInvestmentAmount] = useState<string>(
    offering.minimumInvestment.toString()
  );
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "balance">("bank");
  const [step, setStep] = useState<"amount" | "review" | "complete">("amount");
  const queryClient = useQueryClient();

  // Calculate projected returns
  const calculatedReturns = () => {
    const amount = parseFloat(investmentAmount) || 0;
    const annualReturn = amount * (offering.interestRate / 100);
    const totalReturn = annualReturn * (offering.termMonths / 12);
    const totalAmount = amount + totalReturn;

    return {
      annualReturn,
      totalReturn,
      totalAmount,
    };
  };

  // Investment mutation
  const investMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        offeringId: offering.id,
        amount: parseFloat(investmentAmount),
        paymentMethod,
      };
      return apiRequest("/api/investor/investments", "POST", payload);
    },
    onSuccess: () => {
      toast.success("Investment successful!");
      queryClient.invalidateQueries({ queryKey: ["/api/investor/offerings"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/investor/offerings/${offering.id}`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/investor/investments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/investor/profile"] });
      setStep("complete");
    },
    onError: (error: any) => {
      toast.error(`Investment failed: ${error.message || "Unknown error"}`);
    },
  });

  // Validation
  const amountValue = parseFloat(investmentAmount) || 0;
  const isAmountValid =
    amountValue >= offering.minimumInvestment &&
    amountValue <= offering.totalTarget - offering.totalRaised;

  // Handle investment submission
  const handleInvest = () => {
    investMutation.mutate();
  };

  // Check if the investor can invest
  const canInvest =
    investorProfile.isVerified &&
    investorProfile.kycStatus === "verified" &&
    (paymentMethod === "balance"
      ? investorProfile.availableBalance >= amountValue
      : investorProfile.hasBankAccount);

  // Get status text based on investor profile
  const getInvestorStatusText = () => {
    if (!investorProfile.isVerified) {
      return "Your investor profile is not verified. Please complete verification to invest.";
    }
    if (investorProfile.kycStatus === "pending") {
      return "Your KYC verification is pending. Please wait for approval to invest.";
    }
    if (investorProfile.kycStatus === "rejected") {
      return "Your KYC verification was rejected. Please contact support.";
    }
    if (
      paymentMethod === "bank" &&
      !investorProfile.hasBankAccount
    ) {
      return "You need to link a bank account to invest. Please add one in your profile.";
    }
    if (
      paymentMethod === "balance" &&
      investorProfile.availableBalance < amountValue
    ) {
      return `Insufficient balance (${formatCurrency(
        investorProfile.availableBalance
      )}). Please add funds or select bank account payment.`;
    }
    return "";
  };

  // Reset form when changing payment method
  const handlePaymentMethodChange = (method: "bank" | "balance") => {
    setPaymentMethod(method);
  };

  return (
    <div>
      {step === "amount" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="investment-amount">Investment Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="investment-amount"
                type="number"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(e.target.value)}
                min={offering.minimumInvestment}
                max={offering.totalTarget - offering.totalRaised}
                step={1000}
                className="pl-8"
              />
            </div>
            {amountValue < offering.minimumInvestment && (
              <p className="text-sm text-destructive">
                Minimum investment is {formatCurrency(offering.minimumInvestment)}
              </p>
            )}
            {amountValue > offering.totalTarget - offering.totalRaised && (
              <p className="text-sm text-destructive">
                Maximum investment is {formatCurrency(offering.totalTarget - offering.totalRaised)}
              </p>
            )}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Min: {formatCurrency(offering.minimumInvestment)}</span>
              <span>Available: {formatCurrency(offering.totalTarget - offering.totalRaised)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-2 gap-4">
              <Button
                type="button"
                variant={paymentMethod === "bank" ? "default" : "outline"}
                className="justify-start"
                onClick={() => handlePaymentMethodChange("bank")}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Bank Account
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "balance" ? "default" : "outline"}
                className="justify-start"
                onClick={() => handlePaymentMethodChange("balance")}
                disabled={!investorProfile.availableBalance}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Balance (${investorProfile.availableBalance.toLocaleString()})
              </Button>
            </div>
          </div>

          <div className="border rounded-md p-4 space-y-3 bg-muted/50">
            <h4 className="font-medium">Projected Returns</h4>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Annual Return ({offering.interestRate}%)</span>
                <span>{formatCurrency(calculatedReturns().annualReturn)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Term Return ({offering.termMonths} months)</span>
                <span>{formatCurrency(calculatedReturns().totalReturn)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-medium">
                <span>Total Return</span>
                <span>{formatCurrency(calculatedReturns().totalAmount)}</span>
              </div>
            </div>
          </div>

          {!canInvest && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Cannot proceed with investment</AlertTitle>
              <AlertDescription>{getInvestorStatusText()}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => setStep("review")}
              disabled={!isAmountValid || !canInvest}
            >
              Review Investment
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Review Your Investment</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-muted-foreground">Offering</span>
              <span className="font-medium">{offering.name}</span>
              
              <span className="text-muted-foreground">Investment Amount</span>
              <span className="font-medium">{formatCurrency(amountValue)}</span>
              
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium">
                {paymentMethod === "bank" ? "Bank Account" : "Wallet Balance"}
              </span>
              
              <span className="text-muted-foreground">Interest Rate</span>
              <span className="font-medium">{offering.interestRate}%</span>
              
              <span className="text-muted-foreground">Term Length</span>
              <span className="font-medium">{offering.termMonths} months</span>
              
              <span className="text-muted-foreground">Expected Return</span>
              <span className="font-medium">{formatCurrency(calculatedReturns().totalReturn)}</span>
              
              <span className="text-muted-foreground">Total Value at Maturity</span>
              <span className="font-medium">{formatCurrency(calculatedReturns().totalAmount)}</span>
            </div>
          </div>
          
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Important Information</AlertTitle>
            <AlertDescription>
              By proceeding with this investment, you acknowledge that you have read and understood
              the offering documents and risk disclosures. All investments involve risk, including
              the possible loss of principal.
            </AlertDescription>
          </Alert>
          
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("amount")}>
              Back
            </Button>
            <Button 
              onClick={handleInvest} 
              disabled={investMutation.isPending}
            >
              {investMutation.isPending ? "Processing..." : "Confirm Investment"}
            </Button>
          </div>
        </div>
      )}

      {step === "complete" && (
        <div className="text-center space-y-6 py-4">
          <div className="inline-flex h-20 w-20 rounded-full bg-green-100 p-4 items-center justify-center mx-auto">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Investment Successful!</h3>
            <p className="text-muted-foreground">
              Your investment of {formatCurrency(amountValue)} in {offering.name} has been processed successfully.
            </p>
          </div>
          
          <div className="border rounded-md p-4 bg-muted/50 text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Transaction ID</span>
              <span className="font-medium">#{Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100">Completed</Badge>
            </div>
          </div>
          
          <div className="pt-4">
            <Button onClick={onSuccess} className="mr-4">View My Investments</Button>
            <Button variant="outline" onClick={onSuccess}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Main OfferingDetail component
export default function OfferingDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const offeringId = parseInt(params.id);
  const [investDialogOpen, setInvestDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Fetch offering data
  const offeringQuery = useQuery({
    queryKey: [`/api/investor/offerings/${offeringId}`],
    retry: false,
    enabled: !isNaN(offeringId)
  });
  
  // Fetch related documents
  const documentsQuery = useQuery({
    queryKey: [`/api/investor/offerings/${offeringId}/documents`],
    retry: false,
    enabled: !isNaN(offeringId)
  });
  
  // Fetch investor profile
  const profileQuery = useQuery({
    queryKey: ['/api/investor/profile'],
    retry: false
  });
  
  // Loading states
  const isLoading = offeringQuery.isLoading || documentsQuery.isLoading || profileQuery.isLoading;
  
  // Handle errors
  if (offeringQuery.isError) {
    return (
      <InvestorLayout>
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/investor/offerings")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Offerings
          </Button>
        </div>
        
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-xl font-semibold mb-2">Offering Not Found</h3>
            <p className="text-muted-foreground mb-6">
              The investment offering you're looking for could not be found or may have been removed.
            </p>
            <Button onClick={() => navigate("/investor/offerings")}>
              Browse Available Offerings
            </Button>
          </div>
        </Card>
      </InvestorLayout>
    );
  }
  
  // Extract data
  const offering = offeringQuery.data?.offering as Offering | undefined;
  const relatedDocuments = documentsQuery.data?.documents as RelatedDocument[] | undefined;
  const investorProfile = profileQuery.data?.investorProfile as InvestorProfile | undefined;
  
  // Calculate progress
  const progress = offering 
    ? Math.min(Math.round((offering.totalRaised / offering.totalTarget) * 100), 100) 
    : 0;
  
  // Handle successful investment
  const handleInvestmentSuccess = () => {
    setInvestDialogOpen(false);
    navigate("/investor/investments");
  };
  
  if (isLoading || !offering) {
    return (
      <InvestorLayout>
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/investor/offerings")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Offerings
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Loading Offering...</h1>
        </div>
        
        <div className="space-y-6">
          <div className="h-10 w-2/3 bg-muted animate-pulse rounded-md"></div>
          <div className="h-6 w-full bg-muted animate-pulse rounded-md"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="h-[300px] bg-muted animate-pulse rounded-md"></div>
              <div className="h-[200px] bg-muted animate-pulse rounded-md"></div>
            </div>
            <div className="space-y-6">
              <div className="h-[200px] bg-muted animate-pulse rounded-md"></div>
              <div className="h-[150px] bg-muted animate-pulse rounded-md"></div>
            </div>
          </div>
        </div>
      </InvestorLayout>
    );
  }
  
  return (
    <InvestorLayout>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/investor/offerings")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Offerings
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{offering.name}</h1>
            <p className="text-muted-foreground">
              {getOfferingTypeLabel(offering.offeringType)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {offering.status === "available" ? (
            <Button onClick={() => setInvestDialogOpen(true)}>
              Invest Now
            </Button>
          ) : offering.status === "upcoming" ? (
            <Button disabled>Coming Soon</Button>
          ) : offering.status === "fully_funded" ? (
            <Button disabled>Fully Funded</Button>
          ) : (
            <Button disabled>Completed</Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Offering status card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap justify-between mb-6 gap-y-4">
                <div className="flex items-center space-x-2">
                  <Badge
                    className={
                      offering.status === "available"
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : offering.status === "fully_funded"
                        ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                        : offering.status === "upcoming"
                        ? "bg-purple-100 text-purple-800 hover:bg-purple-200"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {offering.status === "available"
                      ? "Available"
                      : offering.status === "fully_funded"
                      ? "Fully Funded"
                      : offering.status === "upcoming"
                      ? "Upcoming"
                      : "Completed"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      offering.riskLevel === "low"
                        ? "bg-green-50 text-green-700"
                        : offering.riskLevel === "moderate"
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-red-50 text-red-700"
                    }
                  >
                    {getRiskLabel(offering.riskLevel)}
                  </Badge>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                    <span className="text-sm">Start: {formatDate(offering.startDate)}</span>
                  </div>
                  {offering.endDate && (
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-sm">End: {formatDate(offering.endDate)}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Funding Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{formatCurrency(offering.totalRaised)} raised</span>
                    <span>Target: {formatCurrency(offering.totalTarget)}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div>
                    <div className="text-sm text-muted-foreground">Interest Rate</div>
                    <div className="text-xl font-semibold">{offering.interestRate}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Term Length</div>
                    <div className="text-xl font-semibold">{offering.termMonths} months</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Min Investment</div>
                    <div className="text-xl font-semibold">{formatCurrency(offering.minimumInvestment)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Expected Yield</div>
                    <div className="text-xl font-semibold">{offering.expectedYield}%</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Tabs for offering details */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-3 sm:grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="returns">Returns</TabsTrigger>
              <TabsTrigger value="contracts">Contracts</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Offering Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p>{offering.description}</p>
                    
                    {offering.detailedDescription && (
                      <div className="mt-4">
                        <p>{offering.detailedDescription}</p>
                      </div>
                    )}
                    
                    {offering.investmentTerms && (
                      <div className="mt-6">
                        <h4 className="text-lg font-medium mb-2">Investment Terms</h4>
                        <p>{offering.investmentTerms}</p>
                      </div>
                    )}
                    
                    {offering.riskFactors && offering.riskFactors.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-lg font-medium mb-2">Risk Factors</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {offering.riskFactors.map((factor, index) => (
                            <li key={index}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Offering Highlights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">Total Contracts</span>
                        <span className="font-medium">{offering.contractCount}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">Average Contract Size</span>
                        <span className="font-medium">{formatCurrency(offering.averageContractSize)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">Funding Deadline</span>
                        <span className="font-medium">{formatDate(offering.fundingDeadline)}</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {offering.contractDetails && (
                        <>
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Industry Focus</span>
                            <span className="font-medium">{offering.contractDetails.industry}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Merchant Count</span>
                            <span className="font-medium">{offering.contractDetails.merchantCount}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Historical Default Rate</span>
                            <span className="font-medium">{offering.contractDetails.defaultRate}%</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="returns" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Projected Returns</CardTitle>
                  <CardDescription>
                    Estimated returns based on a {formatCurrency(offering.minimumInvestment)} investment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-muted/50 p-4 rounded-md text-center">
                        <div className="text-sm text-muted-foreground">Annual Return</div>
                        <div className="text-2xl font-semibold mt-1">{offering.interestRate}%</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatCurrency(offering.minimumInvestment * (offering.interestRate / 100))} per year
                        </div>
                      </div>
                      <div className="bg-muted/50 p-4 rounded-md text-center">
                        <div className="text-sm text-muted-foreground">Term Return</div>
                        <div className="text-2xl font-semibold mt-1">
                          {(offering.interestRate * (offering.termMonths / 12)).toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatCurrency(
                            offering.minimumInvestment *
                              (offering.interestRate / 100) *
                              (offering.termMonths / 12)
                          )} over {offering.termMonths} months
                        </div>
                      </div>
                      <div className="bg-primary/10 p-4 rounded-md text-center">
                        <div className="text-sm text-muted-foreground">Total Value at Maturity</div>
                        <div className="text-2xl font-semibold mt-1">
                          {formatCurrency(
                            offering.minimumInvestment +
                              offering.minimumInvestment *
                                (offering.interestRate / 100) *
                                (offering.termMonths / 12)
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Principal + Interest
                        </div>
                      </div>
                    </div>
                    
                    {offering.projectedReturns && offering.projectedReturns.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-md font-medium mb-3">Year-by-Year Projection</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Year</TableHead>
                              <TableHead>Interest Earned</TableHead>
                              <TableHead>Cumulative Return</TableHead>
                              <TableHead>Total Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {offering.projectedReturns.map((year) => {
                              const interestEarned = offering.minimumInvestment * (offering.interestRate / 100);
                              const cumulativeReturn = interestEarned * year.year;
                              const totalValue = offering.minimumInvestment + cumulativeReturn;
                              
                              return (
                                <TableRow key={year.year}>
                                  <TableCell>Year {year.year}</TableCell>
                                  <TableCell>{formatCurrency(interestEarned)}</TableCell>
                                  <TableCell>{formatCurrency(cumulativeReturn)}</TableCell>
                                  <TableCell>{formatCurrency(totalValue)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {offering.historicalPerformance && offering.historicalPerformance.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Historical Performance</CardTitle>
                    <CardDescription>
                      Past performance of similar offerings
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead>Return</TableHead>
                          <TableHead>Vs. Target</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {offering.historicalPerformance.map((period) => (
                          <TableRow key={period.period}>
                            <TableCell>{period.period}</TableCell>
                            <TableCell>{period.return}%</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                {period.return >= offering.interestRate ? (
                                  <span className="text-green-600">+{(period.return - offering.interestRate).toFixed(1)}%</span>
                                ) : (
                                  <span className="text-red-600">-{(offering.interestRate - period.return).toFixed(1)}%</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p>
                        Note: Past performance is not indicative of future results.
                        Historical returns are presented for informational purposes only.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="contracts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Contract Breakdown</CardTitle>
                  <CardDescription>
                    Details about the underlying contracts in this offering
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-muted/50 p-4 rounded-md">
                        <div className="text-sm text-muted-foreground">Total Contracts</div>
                        <div className="text-2xl font-semibold mt-1">{offering.contractCount}</div>
                      </div>
                      <div className="bg-muted/50 p-4 rounded-md">
                        <div className="text-sm text-muted-foreground">Average Contract Size</div>
                        <div className="text-2xl font-semibold mt-1">{formatCurrency(offering.averageContractSize)}</div>
                      </div>
                      {offering.contractDetails && (
                        <>
                          <div className="bg-muted/50 p-4 rounded-md">
                            <div className="text-sm text-muted-foreground">Average Term Length</div>
                            <div className="text-2xl font-semibold mt-1">{offering.contractDetails.averageTermLength} months</div>
                          </div>
                          <div className="bg-muted/50 p-4 rounded-md">
                            <div className="text-sm text-muted-foreground">Default Rate</div>
                            <div className="text-2xl font-semibold mt-1">{offering.contractDetails.defaultRate}%</div>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {offering.contractDetails && (
                      <div className="mt-6">
                        <h4 className="text-md font-medium mb-3">Industry Breakdown</h4>
                        <div className="flex items-center space-x-2">
                          <div className="h-3 w-3 rounded-full bg-primary"></div>
                          <div className="text-sm">
                            {offering.contractDetails.industry}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <Alert className="mt-4">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Contract Diversification</AlertTitle>
                      <AlertDescription>
                        This offering includes a diverse mix of merchant financing contracts
                        to minimize risk exposure to any single merchant or industry. Each contract
                        has been underwritten according to our strict criteria.
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Contract Protection</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger>Underwriting Standards</AccordionTrigger>
                        <AccordionContent>
                          All contracts in this offering have passed our rigorous underwriting process, 
                          which includes verification of merchant financials, business operations, credit history,
                          and payment capacity. Only merchants meeting our strict criteria are included.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-2">
                        <AccordionTrigger>Diversification Strategy</AccordionTrigger>
                        <AccordionContent>
                          This offering contains contracts from {offering.contractDetails?.merchantCount || "multiple"} merchants 
                          across various business sizes and operational histories. This diversification 
                          helps reduce the impact of any single contract defaulting.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-3">
                        <AccordionTrigger>Tokenization Security</AccordionTrigger>
                        <AccordionContent>
                          All contracts in this offering are tokenized on blockchain technology, 
                          providing transparent, immutable records of ownership and payment history.
                          This adds an additional layer of security and auditability to your investment.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-4">
                        <AccordionTrigger>Default Management</AccordionTrigger>
                        <AccordionContent>
                          In the rare event of a merchant default, our experienced collections team 
                          has established protocols to maximize recovery. The historical default rate 
                          for similar offerings has been {offering.contractDetails?.defaultRate || "<5"}%.
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Offering Documents</CardTitle>
                  <CardDescription>
                    Important documents related to this investment offering
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {relatedDocuments && relatedDocuments.length > 0 ? (
                    <div className="divide-y">
                      {relatedDocuments.map((document) => (
                        <div key={document.id} className="py-4 flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
                            <div>
                              <h4 className="font-medium">{document.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {document.description}
                              </p>
                              <div className="flex items-center space-x-3 mt-2">
                                <span className="text-xs text-muted-foreground">
                                  {document.fileType.split('/')[1]?.toUpperCase() || document.fileType}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {(document.fileSize / 1024).toFixed(0)} KB
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(document.uploadedAt)}
                                </span>
                                {document.requiresNda && (
                                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300">
                                    NDA Required
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div>
                            {document.canAccess ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`/api/documents/${document.id}/download`, "_blank")}
                              >
                                <Download className="h-4 w-4 mr-2" /> Download
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate("/investor/documents")}
                              >
                                <Lock className="h-4 w-4 mr-2" /> Access Required
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Documents Available</h3>
                      <p className="text-muted-foreground">
                        There are currently no documents associated with this offering.
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t pt-4 flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/investor/documents")}
                  >
                    View All Documents
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open("/investor/resources/investing-guide", "_blank")}
                  >
                    Investing Guide
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="space-y-6">
          {/* Investment card */}
          <Card>
            <CardHeader>
              <CardTitle>Investment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    className={
                      offering.status === "available"
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : offering.status === "fully_funded"
                        ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                        : offering.status === "upcoming"
                        ? "bg-purple-100 text-purple-800 hover:bg-purple-200"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {offering.status === "available"
                      ? "Available"
                      : offering.status === "fully_funded"
                      ? "Fully Funded"
                      : offering.status === "upcoming"
                      ? "Upcoming"
                      : "Completed"}
                  </Badge>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest Rate</span>
                  <span className="font-medium">{offering.interestRate}%</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Term Length</span>
                  <span className="font-medium">{offering.termMonths} months</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min Investment</span>
                  <span className="font-medium">{formatCurrency(offering.minimumInvestment)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-medium">{formatCurrency(offering.totalTarget - offering.totalRaised)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Funding Deadline</span>
                  <span className="font-medium">{formatDate(offering.fundingDeadline)}</span>
                </div>
              </div>
              
              <div className="pt-2">
                <div className="flex justify-between text-sm mb-2">
                  <span>Funding Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
            <CardFooter>
              {offering.status === "available" ? (
                <Button className="w-full" onClick={() => setInvestDialogOpen(true)}>
                  Invest Now
                </Button>
              ) : offering.status === "upcoming" ? (
                <Button className="w-full" disabled>
                  Coming Soon
                </Button>
              ) : offering.status === "fully_funded" ? (
                <Button className="w-full" disabled>
                  Fully Funded
                </Button>
              ) : (
                <Button className="w-full" disabled>
                  Completed
                </Button>
              )}
            </CardFooter>
          </Card>
          
          {/* Calculator card */}
          <Card>
            <CardHeader>
              <CardTitle>Return Calculator</CardTitle>
              <CardDescription>
                Estimate your potential returns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="calc-amount">Investment Amount</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="calc-amount"
                    type="number"
                    defaultValue={offering.minimumInvestment}
                    min={offering.minimumInvestment}
                    className="pl-8"
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Minimum: {formatCurrency(offering.minimumInvestment)}
                </div>
              </div>
              
              <div className="border rounded-md p-4 space-y-3 bg-muted/50 mt-4">
                <h4 className="font-medium">Projected Returns</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Annual Return ({offering.interestRate}%)</span>
                    <span>{formatCurrency(offering.minimumInvestment * (offering.interestRate / 100))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Term Return ({offering.termMonths} months)</span>
                    <span>
                      {formatCurrency(
                        offering.minimumInvestment *
                          (offering.interestRate / 100) *
                          (offering.termMonths / 12)
                      )}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-medium">
                    <span>Total Value</span>
                    <span>
                      {formatCurrency(
                        offering.minimumInvestment +
                          offering.minimumInvestment *
                            (offering.interestRate / 100) *
                            (offering.termMonths / 12)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Risk level card */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Risk Level</span>
                  <Badge
                    variant="outline"
                    className={
                      offering.riskLevel === "low"
                        ? "bg-green-50 text-green-700"
                        : offering.riskLevel === "moderate"
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-red-50 text-red-700"
                    }
                  >
                    {getRiskLabel(offering.riskLevel)}
                  </Badge>
                </div>
                
                <div className="pt-2">
                  <p className="text-sm">
                    {offering.riskLevel === "low" ? (
                      "This offering consists primarily of contracts with established merchants with strong payment histories and solid financials."
                    ) : offering.riskLevel === "moderate" ? (
                      "This offering contains a balanced mix of established and newer merchants with good credit profiles and payment histories."
                    ) : (
                      "This offering includes contracts with newer merchants and may offer higher returns in exchange for increased risk."
                    )}
                  </p>
                </div>
                
                <Alert className="mt-2">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    All investments involve risk, including the possible loss of principal.
                    Past performance does not guarantee future results.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Investment dialog */}
      <Dialog open={investDialogOpen} onOpenChange={setInvestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invest in {offering.name}</DialogTitle>
            <DialogDescription>
              Complete the form below to invest in this offering
            </DialogDescription>
          </DialogHeader>
          {investorProfile && (
            <InvestmentForm
              offering={offering}
              investorProfile={investorProfile}
              onSuccess={handleInvestmentSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </InvestorLayout>
  );
}