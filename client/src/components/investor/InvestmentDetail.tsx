import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  PieChart,
  TrendingUp,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Types
interface Investment {
  id: number;
  offeringId: number;
  offeringName: string;
  amount: number;
  status: "active" | "completed" | "pending";
  interestRate: number;
  termMonths: number;
  startDate: string;
  endDate: string | null;
  maturityDate: string | null;
  expectedReturn: number;
  currentValue: number;
  principalRemaining: number;
  interestEarned: number;
  nextPaymentAmount: number | null;
  nextPaymentDate: string | null;
  paymentsMade: number;
  totalPayments: number;
  createdAt: string;
  offeringType: "fixed_term_15_2yr" | "fixed_term_18_4yr";
  paymentSchedule?: {
    date: string;
    amount: number;
    type: "principal" | "interest" | "combined";
    status: "paid" | "pending" | "missed";
    balance: number;
  }[];
  activity?: {
    date: string;
    description: string;
    amount: number;
    type: "payment" | "investment" | "fee" | "other";
  }[];
  documents?: {
    id: number;
    title: string;
    description: string;
    fileType: string;
    uploadedAt: string;
  }[];
}

// Helper functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "N/A";
  
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getOfferingTypeLabel = (type: string) => {
  switch (type) {
    case "fixed_term_15_2yr":
      return "Fixed 15% - 2 Year Term";
    case "fixed_term_18_4yr":
      return "Fixed 18% - 4 Year Term";
    default:
      return "Custom Offering";
  }
};

const getStatusBadge = (status: Investment["status"]) => {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Active</Badge>;
    case "completed":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Completed</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Pending</Badge>;
    default:
      return null;
  }
};

// Investment Information Card
function InvestmentInfoCard({ investment }: { investment: Investment }) {
  // Calculate progress through term
  const calculateProgress = () => {
    if (investment.status === "completed") return 100;
    if (investment.status === "pending") return 0;
    
    if (investment.startDate && investment.maturityDate) {
      const start = new Date(investment.startDate).getTime();
      const end = new Date(investment.maturityDate).getTime();
      const now = Date.now();
      
      if (now >= end) return 100;
      if (now <= start) return 0;
      
      return Math.round(((now - start) / (end - start)) * 100);
    }
    
    return 0;
  };
  
  const progress = calculateProgress();
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">Investment Details</CardTitle>
            <CardDescription>Information about your investment</CardDescription>
          </div>
          <div>{getStatusBadge(investment.status)}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Offering</div>
            <div className="font-medium">{investment.offeringName}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Type</div>
            <div className="font-medium">{getOfferingTypeLabel(investment.offeringType)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Principal Invested</div>
            <div className="font-medium">{formatCurrency(investment.amount)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Interest Rate</div>
            <div className="font-medium">{investment.interestRate}%</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Term Length</div>
            <div className="font-medium">{investment.termMonths} months</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Investment Date</div>
            <div className="font-medium">{formatDate(investment.createdAt)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Start Date</div>
            <div className="font-medium">{formatDate(investment.startDate)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Maturity Date</div>
            <div className="font-medium">{formatDate(investment.maturityDate)}</div>
          </div>
        </div>
        
        {investment.status === "active" && (
          <div className="pt-2">
            <div className="flex justify-between items-center text-sm mb-1">
              <span>Term Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Start: {formatDate(investment.startDate)}</span>
              <span>Maturity: {formatDate(investment.maturityDate)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Financial Summary Card
function FinancialSummaryCard({ investment }: { investment: Investment }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Financial Summary</CardTitle>
        <CardDescription>Overview of your investment performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-muted/50 p-4 rounded-md">
            <div className="text-sm text-muted-foreground">Current Value</div>
            <div className="text-2xl font-semibold mt-1">{formatCurrency(investment.currentValue)}</div>
            {investment.status === "active" && (
              <div className="flex items-center text-sm text-green-600 mt-1">
                <TrendingUp className="h-4 w-4 mr-1" />
                {formatCurrency(investment.currentValue - investment.amount)} gain
              </div>
            )}
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground">Principal Remaining</div>
            <div className="font-medium">{formatCurrency(investment.principalRemaining)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Interest Earned</div>
            <div className="font-medium">{formatCurrency(investment.interestEarned)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Expected Total Return</div>
            <div className="font-medium">{formatCurrency(investment.expectedReturn)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Final Value at Maturity</div>
            <div className="font-medium">{formatCurrency(investment.amount + investment.expectedReturn)}</div>
          </div>
        </div>
        
        {investment.nextPaymentDate && (
          <div className="mt-4 border rounded-md p-3 bg-primary/5">
            <div className="flex items-start">
              <CalendarDays className="h-5 w-5 mt-0.5 mr-3 text-primary" />
              <div>
                <div className="font-medium">Next Payment</div>
                <div className="text-sm mt-1">
                  {formatCurrency(investment.nextPaymentAmount || 0)} on {formatDate(investment.nextPaymentDate)}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Payment History Card
function PaymentScheduleCard({ investment }: { investment: Investment }) {
  const paymentSchedule = investment.paymentSchedule || [];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Schedule</CardTitle>
        <CardDescription>
          {investment.paymentsMade} of {investment.totalPayments} payments made
        </CardDescription>
      </CardHeader>
      <CardContent>
        {paymentSchedule.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Remaining Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentSchedule.map((payment, index) => (
                <TableRow key={index}>
                  <TableCell>{formatDate(payment.date)}</TableCell>
                  <TableCell className="capitalize">{payment.type}</TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>{formatCurrency(payment.balance)}</TableCell>
                  <TableCell>
                    {payment.status === "paid" ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                      </Badge>
                    ) : payment.status === "pending" ? (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                        <Clock className="h-3 w-3 mr-1" /> Pending
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        <AlertCircle className="h-3 w-3 mr-1" /> Missed
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Payment Schedule Available</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              The payment schedule for this investment is not available yet.
              It will be updated once the investment is active.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Transaction History Card
function TransactionHistoryCard({ investment }: { investment: Investment }) {
  const activity = investment.activity || [];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>
          Record of all activity related to this investment
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.map((transaction, index) => (
                <TableRow key={index}>
                  <TableCell>{formatDate(transaction.date)}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell className="capitalize">{transaction.type}</TableCell>
                  <TableCell className="text-right">
                    <span className={transaction.type === "investment" ? "text-red-600" : "text-green-600"}>
                      {transaction.type === "investment" ? "-" : "+"}{formatCurrency(transaction.amount)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Transactions Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              There are no transactions recorded for this investment yet.
              Check back after your investment has been active for a while.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Documents Card
function DocumentsCard({ investment }: { investment: Investment }) {
  const documents = investment.documents || [];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>
          Important documents related to your investment
        </CardDescription>
      </CardHeader>
      <CardContent>
        {documents.length > 0 ? (
          <div className="divide-y">
            {documents.map((doc) => (
              <div key={doc.id} className="py-3 flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">{doc.title}</h4>
                    <div className="flex items-center text-xs text-muted-foreground mt-1 space-x-3">
                      <span>{doc.fileType}</span>
                      <span>Uploaded {formatDate(doc.uploadedAt)}</span>
                    </div>
                  </div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(`/api/documents/${doc.id}/download`, "_blank")}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Documents Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              There are no documents available for this investment at the moment.
              Any important documents will appear here when available.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button variant="outline" asChild className="w-full">
          <Link href="/investor/documents">View All Documents</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// Main InvestmentDetail Component
export default function InvestmentDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const investmentId = parseInt(params.id);
  const [activeTab, setActiveTab] = useState("summary");
  
  // Fetch investment data
  const investmentQuery = useQuery({
    queryKey: [`/api/investor/investments/${investmentId}`],
    retry: false,
    enabled: !isNaN(investmentId)
  });
  
  // Loading states
  const isLoading = investmentQuery.isLoading;
  
  // Handle errors
  if (investmentQuery.isError) {
    return (
      <InvestorLayout>
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/investor/investments")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Investments
          </Button>
        </div>
        
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-xl font-semibold mb-2">Investment Not Found</h3>
            <p className="text-muted-foreground mb-6">
              The investment you're looking for could not be found or you don't have access to it.
            </p>
            <Button onClick={() => navigate("/investor/investments")}>
              View All Investments
            </Button>
          </div>
        </Card>
      </InvestorLayout>
    );
  }
  
  // Extract data
  const investment = investmentQuery.data?.investment as Investment | undefined;
  
  if (isLoading || !investment) {
    return (
      <InvestorLayout>
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/investor/investments")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Investments
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Loading Investment...</h1>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-[200px] bg-muted animate-pulse rounded-md"></div>
            <div className="h-[200px] bg-muted animate-pulse rounded-md"></div>
          </div>
          <div className="h-[300px] bg-muted animate-pulse rounded-md"></div>
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
            onClick={() => navigate("/investor/investments")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Investments
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{investment.offeringName}</h1>
            <p className="text-muted-foreground">
              Investment ID: {investment.id} • {getOfferingTypeLabel(investment.offeringType)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/investor/offerings/${investment.offeringId}`}>
              <ArrowRight className="h-4 w-4 mr-2" /> View Offering
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <InvestmentInfoCard investment={investment} />
        <FinancialSummaryCard investment={investment} />
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Investment Summary</CardTitle>
              <CardDescription>
                Overview of your investment in {investment.offeringName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="shadow-none border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Principal Invested
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(investment.amount)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Invested on {formatDate(investment.createdAt)}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="shadow-none border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Current Value
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(investment.currentValue)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(investment.currentValue - investment.amount)} in returns
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="shadow-none border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {investment.status === "completed" ? "Total Return" : "Expected Return"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(investment.expectedReturn)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      At {investment.interestRate}% over {investment.termMonths} months
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-lg font-medium mb-3">Investment Progress</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Interest Earned</span>
                      <span>
                        {formatCurrency(investment.interestEarned)} of {formatCurrency(investment.expectedReturn)}
                      </span>
                    </div>
                    <Progress
                      value={(investment.interestEarned / investment.expectedReturn) * 100}
                      className="h-2"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Term Completed</span>
                      <span>
                        {investment.paymentsMade} of {investment.totalPayments} payments
                      </span>
                    </div>
                    <Progress
                      value={(investment.paymentsMade / investment.totalPayments) * 100}
                      className="h-2"
                    />
                  </div>
                </div>
              </div>
              
              {investment.nextPaymentDate && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-start">
                    <CalendarDays className="h-8 w-8 mr-4 text-primary" />
                    <div>
                      <h3 className="font-medium text-lg">Next Payment</h3>
                      <p className="mt-1">
                        Your next payment of {formatCurrency(investment.nextPaymentAmount || 0)} is scheduled
                        for <strong>{formatDate(investment.nextPaymentDate)}</strong>.
                      </p>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Payments are automatically deposited to your wallet balance or connected bank account.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {investment.status === "completed" && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Investment Completed</AlertTitle>
                  <AlertDescription className="text-green-700">
                    This investment has reached its maturity date and all payments have been processed.
                    The principal and interest have been fully paid.
                  </AlertDescription>
                </Alert>
              )}
              
              {investment.status === "pending" && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800">Investment Pending</AlertTitle>
                  <AlertDescription className="text-yellow-700">
                    Your investment is currently being processed. It may take 1-2 business days
                    for the investment to become active and appear in your portfolio.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="payments">
          <PaymentScheduleCard investment={investment} />
        </TabsContent>
        
        <TabsContent value="transactions">
          <TransactionHistoryCard investment={investment} />
        </TabsContent>
        
        <TabsContent value="documents">
          <DocumentsCard investment={investment} />
        </TabsContent>
      </Tabs>
    </InvestorLayout>
  );
}