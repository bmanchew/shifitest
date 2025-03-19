import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CalendarRange, Clock, CreditCard, Download, FileText, DollarSign, ExternalLink } from "lucide-react";
import { format, addMonths } from "date-fns";
import { Logo } from "@/components/ui/logo";

export default function CustomerDashboard() {
  const { contractId: contractIdParam } = useParams();
  const contractId = parseInt(contractIdParam || "0");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch contract details
  const { data: contract, isLoading: isLoadingContract } = useQuery({
    queryKey: ["/api/contracts", contractId],
    queryFn: async () => {
      if (!contractId) return null;

      try {
        const res = await fetch(`/api/contracts/${contractId}`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to fetch contract");
        }
        return res.json();
      } catch (error) {
        console.error("Error fetching contract:", error);
        return null;
      }
    },
  });

  //Fetch points data -  Added to fetch points earned.  Placement is arbitrary due to lack of context in original code.
  const { data: pointsData, isLoading: isLoadingPoints } = useQuery({
    queryKey: ["/api/points", contractId],
    queryFn: async () => {
      if (!contractId) return null;
      try {
        const res = await fetch(`/api/points/${contractId}`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to fetch points");
        }
        return res.json();
      } catch (error) {
        console.error("Error fetching points:", error);
        return null;
      }
    },
  });


  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  // Generate payment schedule
  const generatePaymentSchedule = () => {
    if (!contract) return [];

    const startDate = new Date();
    return Array.from({ length: contract.termMonths }, (_, i) => ({
      paymentNumber: i + 1,
      dueDate: addMonths(startDate, i + 1),
      amount: contract.monthlyPayment,
      status: i === 0 ? "upcoming" : "scheduled",
    }));
  };

  // Payment schedule
  const paymentSchedule = generatePaymentSchedule();

  // Calculate remaining balance
  const calculateRemainingBalance = () => {
    if (!contract) return 0;

    const totalPayments = paymentSchedule.filter(p => p.status === "paid").length;
    return contract.financedAmount - (totalPayments * contract.monthlyPayment);
  };

  const remainingBalance = calculateRemainingBalance();

  // Handle make payment action
  const handleMakePayment = () => {
    toast({
      title: "Payment Processing",
      description: "Redirecting to payment page...",
    });
    // In a real app, redirect to payment page or open payment modal
  };

  // Handle download contract
  const handleDownloadContract = () => {
    toast({
      title: "Contract Download",
      description: "Your contract is being prepared for download.",
    });
    // In a real app, generate and download contract PDF
  };

  // Handle early payoff
  const handleEarlyPayoff = () => {
    toast({
      title: "Early Payoff",
      description: "Redirecting to early payoff page...",
    });
    // In a real app, redirect to early payoff page
  };

  // Don't show return to merchant screen if we have contract data
  if (!isLoadingContract && !contract) {
    navigate('/');
    return null;
  }

  if (isLoadingContract || isLoadingPoints) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
          <p className="mt-4 text-sm text-gray-600">Loading your contract information...</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Loading Your Dashboard</CardTitle>
              <CardDescription>Please wait while we fetch your information...</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Display points banner if ACH is enabled
  const hasAutoPayment = contract.paymentMethod === 'ach';
  const pointsEarned = hasAutoPayment ? 500 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {hasAutoPayment && (
        <div className="bg-green-100 p-4 text-center mb-6">
          <p className="text-green-800 font-medium">
            Congratulations! You earned {pointsEarned} points for setting up automatic payments!
          </p>
        </div>
      )}
      
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Welcome to Your Dashboard</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Contract Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm text-gray-500">Monthly Payment</dt>
                  <dd className="text-lg font-medium">${contract.monthlyPayment}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Next Payment Date</dt>
                  <dd className="text-lg font-medium">{new Date(contract.nextPaymentDate).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Payment Method</dt>
                  <dd className="text-lg font-medium capitalize">{contract.paymentMethod}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Rewards Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{pointsEarned}</p>
                <p className="text-sm text-gray-500 mt-2">Points Earned</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary-600 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center">
            <Logo size={32} variant="white" className="mr-2" />
            <h1 className="text-2xl font-bold">ShiFi</h1>
          </div>
          <div className="mt-8">
            <h2 className="text-xl font-semibold">Your Financing Contract</h2>
            <p className="text-sm opacity-90 mt-1">
              {contract.merchantName} • Contract #{contract.contractNumber}
            </p>
          </div>
          <div className="mt-4 bg-white/10 p-4 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm opacity-75">Remaining Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(remainingBalance)}</p>
            </div>
            <div>
              <p className="text-sm opacity-75">Next Payment</p>
              <p className="text-2xl font-bold">{formatCurrency(contract.monthlyPayment)}</p>
              <p className="text-xs opacity-75">Due {format(addMonths(new Date(), 1), "MMM d, yyyy")}</p>
            </div>
            <div className="flex justify-end items-center">
              <Button 
                className="bg-white text-primary-600 hover:bg-white/90"
                onClick={handleMakePayment}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Make Payment
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Points Banner */}
      {pointsData?.points > 0 && (
        <div className="bg-green-100 p-4 text-center">
          <p className="text-green-800">
            Congratulations! You earned {pointsData.points} points for setting up automatic payments!
          </p>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        <Tabs defaultValue="overview" className="mt-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">Payment Schedule</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Contract Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Purchase Amount</span>
                      <span className="text-sm font-medium">{formatCurrency(contract.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Down Payment</span>
                      <span className="text-sm font-medium">{formatCurrency(contract.downPayment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Financed Amount</span>
                      <span className="text-sm font-medium">{formatCurrency(contract.financedAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Term</span>
                      <span className="text-sm font-medium">{contract.termMonths} Months</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Interest Rate</span>
                      <span className="text-sm font-medium">{contract.interestRate}%</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-100">
                      <span className="text-sm font-medium">Monthly Payment</span>
                      <span className="text-sm font-medium">{formatCurrency(contract.monthlyPayment)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Payment Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Original Balance</span>
                      <span className="text-sm font-medium">{formatCurrency(contract.financedAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Paid to Date</span>
                      <span className="text-sm font-medium">{formatCurrency(contract.financedAmount - remainingBalance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Remaining Payments</span>
                      <span className="text-sm font-medium">{contract.termMonths - 0}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-100">
                      <span className="text-sm font-medium">Current Balance</span>
                      <span className="text-sm font-medium">{formatCurrency(remainingBalance)}</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={handleEarlyPayoff}
                    >
                      <DollarSign className="mr-2 h-4 w-4" />
                      Pay Off Early
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Merchant Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-500 block">Merchant</span>
                      <span className="text-sm font-medium">{contract.merchantName}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">Contract Number</span>
                      <span className="text-sm font-medium">{contract.contractNumber}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">Status</span>
                      <Badge variant="success" className="mt-1">Active</Badge>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => window.open('https://techsolutionsinc.com', '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Visit Merchant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Next Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center">
                  <div className="mb-4 sm:mb-0">
                    <p className="text-sm text-gray-500">Payment Amount</p>
                    <p className="text-xl font-medium">{formatCurrency(contract.monthlyPayment)}</p>
                  </div>
                  <div className="mb-4 sm:mb-0">
                    <p className="text-sm text-gray-500">Due Date</p>
                    <p className="text-xl font-medium">{format(addMonths(new Date(), 1), "MMMM d, yyyy")}</p>
                  </div>
                  <div className="mb-4 sm:mb-0">
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge variant="warning" className="mt-1">Upcoming</Badge>
                  </div>
                  <div>
                    <Button onClick={handleMakePayment}>
                      Make Payment
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Schedule</CardTitle>
                <CardDescription>
                  Your complete payment schedule for the contract term
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3">
                    <div className="grid grid-cols-5 text-sm font-medium text-gray-500">
                      <div>Payment #</div>
                      <div>Due Date</div>
                      <div>Amount</div>
                      <div>Status</div>
                      <div></div>
                    </div>
                  </div>
                  <div className="divide-y">
                    {paymentSchedule.map((payment) => (
                      <div key={payment.paymentNumber} className="px-4 py-3">
                        <div className="grid grid-cols-5 text-sm items-center">
                          <div>{payment.paymentNumber}</div>
                          <div>{format(payment.dueDate, "MMM d, yyyy")}</div>
                          <div>{formatCurrency(payment.amount)}</div>
                          <div>
                            {payment.status === "paid" && (
                              <Badge variant="success">Paid</Badge>
                            )}
                            {payment.status === "upcoming" && (
                              <Badge variant="warning">Upcoming</Badge>
                            )}
                            {payment.status === "scheduled" && (
                              <Badge variant="secondary">Scheduled</Badge>
                            )}
                          </div>
                          <div className="text-right">
                            {payment.status === "upcoming" && (
                              <Button size="sm" onClick={handleMakePayment}>Pay Now</Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Contract Documents</CardTitle>
                <CardDescription>
                  View and download your contract documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 flex justify-between items-center">
                    <div className="flex items-center">
                      <FileText className="h-8 w-8 text-gray-400 mr-3" />
                      <div>
                        <p className="font-medium">Retail Installment Contract</p>
                        <p className="text-sm text-gray-500">Signed on {format(new Date(), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handleDownloadContract}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4 flex justify-between items-center">
                    <div className="flex items-center">
                      <FileText className="h-8 w-8 text-gray-400 mr-3" />
                      <div>
                        <p className="font-medium">Terms & Conditions</p>
                        <p className="text-sm text-gray-500">General contract terms</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handleDownloadContract}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4 flex justify-between items-center">
                    <div className="flex items-center">
                      <CalendarRange className="h-8 w-8 text-gray-400 mr-3" />
                      <div>
                        <p className="font-medium">Payment Schedule</p>
                        <p className="text-sm text-gray-500">Full payment schedule</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handleDownloadContract}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}