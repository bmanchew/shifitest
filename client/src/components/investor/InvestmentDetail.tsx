import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Info,
  Percent,
  Receipt,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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

export default function InvestmentDetail({ id }: { id: string }) {
  // Fetch investment details
  const investmentQuery = useQuery({
    queryKey: ["/api/investor/investments", id],
    retry: false,
  });
  
  // Fetch payment history
  const paymentsQuery = useQuery({
    queryKey: ["/api/investor/investments", id, "payments"],
    retry: false,
  });
  
  // Fetch token details (blockchain info)
  const tokenQuery = useQuery({
    queryKey: ["/api/investor/investments", id, "token"],
    retry: false,
  });
  
  // Fetch investment documents
  const documentsQuery = useQuery({
    queryKey: ["/api/investor/investments", id, "documents"],
    retry: false,
  });
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  // Format percentage
  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };
  
  // Calculate the progress of the investment term
  const calculateTermProgress = (investment: any) => {
    const startDate = new Date(investment.createdAt);
    const endDate = new Date(startDate.getTime());
    endDate.setMonth(endDate.getMonth() + investment.termMonths);
    
    const now = new Date();
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsedDuration = now.getTime() - startDate.getTime();
    
    return Math.min(Math.max(0, Math.floor((elapsedDuration / totalDuration) * 100)), 100);
  };
  
  // Generate payment schedule
  const generatePaymentSchedule = (investment: any) => {
    const payments = [];
    const quarterlyInterest = investment.amount * (investment.interestRate / 100) * (3 / 12);
    const startDate = new Date(investment.createdAt);
    
    for (let i = 0; i < Math.ceil(investment.termMonths / 3); i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(startDate.getMonth() + (i + 1) * 3);
      
      const isLast = i === Math.ceil(investment.termMonths / 3) - 1;
      const isPast = paymentDate <= new Date();
      
      payments.push({
        quarter: i + 1,
        date: paymentDate,
        interest: quarterlyInterest,
        principal: isLast ? investment.amount : 0,
        total: quarterlyInterest + (isLast ? investment.amount : 0),
        isPast,
        isPaid: isPast && investment.status === "active",
      });
    }
    
    return payments;
  };
  
  // Get investment status text and color
  const getStatusDetails = (status: string) => {
    switch (status) {
      case "active":
        return { label: "Active", color: "bg-green-100 text-green-800 border-green-200" };
      case "completed":
        return { label: "Completed", color: "bg-blue-100 text-blue-800 border-blue-200" };
      case "pending":
        return { label: "Pending", color: "bg-yellow-100 text-yellow-800 border-yellow-200" };
      case "cancelled":
        return { label: "Cancelled", color: "bg-red-100 text-red-800 border-red-200" };
      default:
        return { label: status, color: "bg-gray-100 text-gray-800 border-gray-200" };
    }
  };
  
  // Calculate total return on investment
  const calculateTotalReturn = (investment: any) => {
    const annualInterest = investment.amount * (investment.interestRate / 100);
    const totalInterest = annualInterest * (investment.termMonths / 12);
    return totalInterest + investment.amount;
  };
  
  // Loading state
  if (investmentQuery.isLoading) {
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
  if (investmentQuery.isError || !investmentQuery.data?.investment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/investor/investments">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Investments
            </Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              There was an error loading the investment details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/investor/investments">View All Investments</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const investment = investmentQuery.data.investment;
  const tokenDetails = tokenQuery.data?.tokenDetails || {};
  const documents = documentsQuery.data?.documents || [];
  const payments = paymentsQuery.data?.payments || [];
  const paymentSchedule = generatePaymentSchedule(investment);
  const statusDetails = getStatusDetails(investment.status);
  const termProgress = calculateTermProgress(investment);
  const totalReturn = calculateTotalReturn(investment);
  const profit = totalReturn - investment.amount;
  
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <Link href="/investor/investments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Investments
          </Button>
        </Link>
      </div>
      
      {/* Main investment detail card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">{investment.offeringName}</CardTitle>
                <Badge className={statusDetails.color}>
                  {statusDetails.label}
                </Badge>
              </div>
              <CardDescription className="text-base mt-1">
                Investment #{investment.id} • Created on {formatDate(investment.createdAt)}
              </CardDescription>
            </div>
            {investment.status === "active" && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3.5 w-3.5" />
                {termProgress}% of term completed
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Investment summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-muted/30 border">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5" />
                    Principal Amount
                  </span>
                  <span className="text-lg font-medium mt-1">{formatCurrency(investment.amount)}</span>
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
                  <span className="text-lg font-medium mt-1">{formatPercent(investment.interestRate)} APY</span>
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
                  <span className="text-lg font-medium mt-1">{investment.termMonths} months</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-muted/30 border">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Receipt className="h-3.5 w-3.5" />
                    Expected Return
                  </span>
                  <span className="text-lg font-medium mt-1">{formatCurrency(totalReturn)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Investment maturity info */}
          {investment.status === "active" && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-blue-600" />
                  <div>
                    <h3 className="font-medium text-blue-800">Investment Maturity</h3>
                    <p className="text-sm text-blue-700">
                      This investment matures on {formatDate(paymentSchedule[paymentSchedule.length - 1].date.toISOString())}
                    </p>
                  </div>
                </div>
                <div className="text-blue-800">
                  <p className="text-sm">Expected profit at maturity</p>
                  <p className="text-lg font-semibold">{formatCurrency(profit)}</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Tabs for different sections */}
          <Tabs defaultValue="payments" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="payments">Payment Schedule</TabsTrigger>
              <TabsTrigger value="details">Investment Details</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            
            {/* Payment Schedule Tab */}
            <TabsContent value="payments" className="space-y-4 pt-4">
              <h3 className="text-lg font-semibold">Payment Schedule</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quarter</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
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
                      <TableCell>
                        {payment.isPaid ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Paid
                          </Badge>
                        ) : payment.isPast ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Processing
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                            Upcoming
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Payment Information</AlertTitle>
                <AlertDescription>
                  Interest payments are made quarterly to your connected bank account. 
                  The principal amount will be returned at the end of the {investment.termMonths}-month term.
                </AlertDescription>
              </Alert>
            </TabsContent>
            
            {/* Investment Details Tab */}
            <TabsContent value="details" className="space-y-4 pt-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">Investment Summary</h3>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Investment ID</span>
                      <span className="font-medium">{investment.id}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Investment Date</span>
                      <span className="font-medium">{formatDate(investment.createdAt)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className={statusDetails.color}>{statusDetails.label}</Badge>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Offering Name</span>
                      <span className="font-medium">{investment.offeringName}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Principal Amount</span>
                      <span className="font-medium">{formatCurrency(investment.amount)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Interest Rate</span>
                      <span className="font-medium">{formatPercent(investment.interestRate)} APY</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Term Length</span>
                      <span className="font-medium">{investment.termMonths} months</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Payment Frequency</span>
                      <span className="font-medium">Quarterly</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Expected Total Return</span>
                      <span className="font-medium">{formatCurrency(totalReturn)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Expected Profit</span>
                      <span className="font-medium text-green-600">{formatCurrency(profit)}</span>
                    </div>
                    {investment.status === "active" && (
                      <>
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Expected Maturity Date</span>
                          <span className="font-medium">
                            {formatDate(paymentSchedule[paymentSchedule.length - 1].date.toISOString())}
                          </span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Term Progress</span>
                          <span className="font-medium">{termProgress}%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {tokenDetails && tokenDetails.smartContractAddress && (
                  <>
                    <Separator />
                    
                    <div>
                      <h3 className="text-lg font-semibold">Blockchain Information</h3>
                      <div className="mt-3 grid grid-cols-1 gap-y-3">
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Token ID</span>
                          <span className="font-medium font-mono text-sm">
                            {tokenDetails.tokenId}
                          </span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Smart Contract</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="font-medium font-mono text-sm truncate max-w-[200px]">
                                  {tokenDetails.smartContractAddress}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-mono text-xs break-all max-w-[300px]">
                                  {tokenDetails.smartContractAddress}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        {tokenDetails.blockchainExplorerUrl && (
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-muted-foreground">Blockchain Explorer</span>
                            <a
                              href={tokenDetails.blockchainExplorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              View on Explorer
                            </a>
                          </div>
                        )}
                        {tokenDetails.tokenizationDate && (
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-muted-foreground">Tokenization Date</span>
                            <span className="font-medium">
                              {formatDate(tokenDetails.tokenizationDate)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <Alert className="mt-4 bg-blue-50 border-blue-200">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-800">Blockchain Security</AlertTitle>
                        <AlertDescription className="text-blue-700">
                          Your investment is secured through blockchain technology. 
                          This provides an immutable record of ownership and ensures 
                          the integrity of your investment.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </>
                )}
                
                {investment.notes && (
                  <>
                    <Separator />
                    
                    <div>
                      <h3 className="text-lg font-semibold">Investment Notes</h3>
                      <p className="mt-2">{investment.notes}</p>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
            
            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-4 pt-4">
              <h3 className="text-lg font-semibold">Investment Documents</h3>
              
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
                    There are currently no documents available for this investment.
                  </p>
                </div>
              )}
              
              <Separator />
              
              <div>
                <h3 className="text-lg font-semibold">Tax Documents</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Tax documents will be made available here after the end of each tax year.
                </p>
                
                <div className="mt-4 flex flex-col items-center justify-center py-8 text-center border rounded-md">
                  <Receipt className="h-12 w-12 text-muted-foreground mb-3" />
                  <h3 className="text-lg font-medium">No Tax Documents Available</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    Tax documents for this investment will be available after the end of the tax year.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        
        <CardFooter className="flex-col space-y-2 items-start sm:flex-row sm:items-center sm:space-y-0 sm:justify-between border-t pt-6">
          <div className="text-sm text-muted-foreground">
            Investment ID: {investment.id} • Created on {formatDate(investment.createdAt)}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/investor/investments">
                View All Investments
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/investor/offerings">
                View New Offerings
              </Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}