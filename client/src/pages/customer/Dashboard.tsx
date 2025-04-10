import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  FileText, 
  Gift, 
  CreditCard, 
  DollarSign, 
  CalendarRange, 
  BarChart3, 
  PiggyBank,
  Wallet,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Lightbulb,
  CheckCircle,
  Building,
  User,
  RefreshCw,
  PlayCircle,
  Bot,
  Brain
} from "lucide-react";
import BankConnection from "@/components/customer/BankConnection";
import AIFinancialSherpa from "@/components/customer/AIFinancialSherpa";
import { Logo } from "@/components/ui/logo";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

export default function CustomerDashboard(): React.ReactNode {
  const { contractId: contractIdParam } = useParams();
  const contractId = parseInt(contractIdParam || "0");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [activeBankContractId, setActiveBankContractId] = useState<number | null>(null);
  const [bankConnectionDetails, setBankConnectionDetails] = useState<any>(null);
  const [isCheckingBankConnection, setIsCheckingBankConnection] = useState(false);
  
  // State for Plaid data from connection
  const [plaidAccountData, setPlaidAccountData] = useState<any>(null);
  
  // Handle opening the bank connection dialog
  const handleViewBankConnection = async (contractId: number) => {
    setActiveBankContractId(contractId);
    setIsCheckingBankConnection(true);
    
    try {
      // Check if this contract already has a bank connection
      const response = await fetch(`/api/plaid/bank-connection/${contractId}`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.hasConnection) {
          // We have an existing connection, save the details
          setBankConnectionDetails(data.connectionDetails);
          
          // Also save the Plaid data if available
          if (data.plaidData) {
            setPlaidAccountData(data.plaidData);
            
            // Update the financial data if needed
            if (!financialData || !financialData.hasPlaidData) {
              // Refetch financial data to get complete cash flow and bills information
              if (contract?.customerId) {
                refetchFinancialData();
              }
            }
          }
        } else {
          // No existing connection
          setBankConnectionDetails(null);
          setPlaidAccountData(null);
        }
      } else {
        // Error checking connection status
        console.error("Error checking bank connection status");
        setBankConnectionDetails(null);
        setPlaidAccountData(null);
      }
    } catch (error) {
      console.error("Error checking bank connection:", error);
      setBankConnectionDetails(null);
      setPlaidAccountData(null);
    } finally {
      setIsCheckingBankConnection(false);
      setShowBankDialog(true);
    }
  };

  // Fetch contract details
  const { data: contractData, isLoading: isLoadingContract } = useQuery({
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
        
        // Parse response JSON
        const responseData = await res.json();
        
        // Extract contract data from the response
        // API returns { contract: {...}, progress: [...] }
        if (responseData.contract) {
          return responseData.contract;
        } else if (responseData.message) {
          // API returned an error message
          console.error("API error:", responseData.message);
          return null;
        } else {
          // Unexpected response format
          console.error("Unexpected API response format:", responseData);
          return null;
        }
      } catch (error) {
        console.error("Error fetching contract:", error);
        return null;
      }
    },
  });
  
  // Rename for clarity throughout the component
  const contract = contractData;
  
  // Auto-check for bank connection when contract loads
  useEffect(() => {
    // Only check once contract is loaded and if contractId is valid
    if (contract && contract.id) {
      // Check if we already loaded the bank data
      if (!bankConnectionDetails && !isCheckingBankConnection) {
        (async () => {
          try {
            // Set loading state 
            setIsCheckingBankConnection(true);
            
            // Check for bank connection
            const response = await fetch(`/api/plaid/bank-connection/${contract.id}`, {
              credentials: "include",
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.hasConnection) {
                // Save the connection details
                setBankConnectionDetails(data.connectionDetails);
                
                // Also save the Plaid data if available
                if (data.plaidData) {
                  setPlaidAccountData(data.plaidData);
                  
                  // If we have bank connection but no financial data with Plaid details,
                  // trigger a refresh of financial data to get cash flow and bills information
                  if (!financialData || !financialData.hasPlaidData) {
                    refetchFinancialData();
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error auto-checking bank connection:", error);
          } finally {
            setIsCheckingBankConnection(false);
          }
        })();
      }
    }
  }, [contract, bankConnectionDetails, isCheckingBankConnection]);

  // Fetch customer's financial data (includes points, accounts, transactions, insights)
  const { data: financialData, isLoading: isLoadingFinancialData, refetch: refetchFinancialData } = useQuery({
    queryKey: ["/api/customer/financial-data", contract?.customerId],
    queryFn: async () => {
      if (!contract?.customerId) return null;
      try {
        const res = await fetch(`/api/customer/${contract.customerId}/financial-data`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to fetch financial data");
        }
        const responseData = await res.json();
        return responseData.success ? responseData.data : null;
      } catch (error) {
        console.error("Error fetching financial data:", error);
        return null;
      }
    },
    enabled: !!contract?.customerId,
  });
  
  // Fetch user data for profile section
  const { data: userData, isLoading: isLoadingUserData } = useQuery({
    queryKey: ["/api/users", contract?.customerId],
    queryFn: async () => {
      if (!contract?.customerId) return null;
      try {
        const res = await fetch(`/api/users/${contract.customerId}`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to fetch user data");
        }
        const user = await res.json();
        return user;
      } catch (error) {
        console.error("Error fetching user data:", error);
        return null;
      }
    },
    enabled: !!contract?.customerId,
  });


  // Format currency values with validation for NaN and undefined
  const formatCurrency = (value: number | undefined | null) => {
    // Ensure we have a valid number (handles NaN, null, undefined)
    const validValue = (typeof value === 'number' && !isNaN(value)) ? value : 0;
    
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(validValue);
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

  // Calculate remaining balance with validation for NaN values
  const calculateRemainingBalance = () => {
    if (!contract) return 0;
    
    // Get financed amount with validation
    const financedAmount = (typeof contract.financedAmount === 'number' && !isNaN(contract.financedAmount)) 
      ? contract.financedAmount 
      : 0;
      
    // Get monthly payment with validation
    const monthlyPayment = (typeof contract.monthlyPayment === 'number' && !isNaN(contract.monthlyPayment))
      ? contract.monthlyPayment
      : 0;
    
    const totalPayments = paymentSchedule.filter(p => p.status === "paid").length;
    return financedAmount - (totalPayments * monthlyPayment);
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

  // Fetch contract document
  const { data: documentData, isLoading: isLoadingDocument } = useQuery({
    queryKey: ["/api/contracts/document", contractId],
    queryFn: async () => {
      if (!contractId) return null;
      
      try {
        const res = await fetch(`/api/contracts/${contractId}/document`, {
          credentials: "include",
        });
        
        if (!res.ok) {
          return { success: false, message: "Document not found" };
        }
        
        return res.json();
      } catch (error) {
        console.error("Error fetching document:", error);
        return { success: false, message: "Error retrieving document" };
      }
    },
    enabled: !!contractId,
  });

  // Handle download contract
  const handleDownloadContract = () => {
    if (!documentData || !documentData.success) {
      toast({
        title: "Document Not Available",
        description: documentData?.message || "The signed contract document is not available.",
        variant: "destructive"
      });
      return;
    }
    
    // Open document URL in new tab (or could download directly)
    window.open(documentData.documentUrl, '_blank');
    
    toast({
      title: "Document Opened",
      description: "Your signed contract has been opened in a new tab.",
    });
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
    setLocation('/');
    return null;
  }

  if (isLoadingContract || isLoadingFinancialData || isLoadingUserData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
          <p className="mt-4 text-sm text-gray-600">Loading your dashboard...</p>
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

  // Get rewards points from financial data or fallback to estimated calculation
  const hasAutoPayment = contract.paymentMethod === 'ach';
  const rewardsPoints = financialData?.rewardsPoints || (hasAutoPayment ? 500 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Rewards Points Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <Gift className="h-12 w-12 mr-4" />
              <div>
                <h2 className="text-3xl font-bold">{rewardsPoints}</h2>
                <p className="text-white/80">ShiFi Rewards Points</p>
              </div>
            </div>
            <div className="w-full md:w-2/3 lg:w-1/2">
              <div className="mb-1 flex justify-between text-sm">
                <span>Progress to next reward tier</span>
                <span>{rewardsPoints}/1000 points</span>
              </div>
              <Progress value={(rewardsPoints / 1000) * 100} className="h-3 bg-white/20" />
              <p className="text-white/80 text-sm mt-2">
                Earn {1000 - rewardsPoints} more points to unlock your next reward tier!
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
          <h1 className="text-2xl font-bold">Your Financial Dashboard</h1>
          
          {/* Profile Section */}
          <div className="mt-3 sm:mt-0 bg-white shadow rounded-lg p-3 flex items-center">
            <div className="bg-primary/10 rounded-full p-2 mr-3">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Welcome</p>
              <p className="font-medium">
                {isLoadingUserData ? (
                  <span className="inline-block w-24 h-4 bg-gray-200 animate-pulse rounded"></span>
                ) : (
                  userData?.firstName && userData?.lastName ? 
                    `${userData.firstName} ${userData.lastName}` : 
                    userData?.name || "Customer"
                )}
              </p>
            </div>
          </div>
        </div>
        
        {/* Real Contract Data */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Contract Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-blue-200">
                  <dt className="text-sm text-blue-700">Monthly Payment</dt>
                  <dd className="text-lg font-medium text-blue-900">{formatCurrency(contract.monthlyPayment)}</dd>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-blue-200">
                  <dt className="text-sm text-blue-700">Next Payment Date</dt>
                  <dd className="text-lg font-medium text-blue-900">
                    {format(addMonths(new Date(), 1), "MMM d, yyyy")}
                  </dd>
                </div>
                <div className="flex justify-between items-center py-2">
                  <dt className="text-sm text-blue-700">Remaining Balance</dt>
                  <dd className="text-lg font-medium text-blue-900">{formatCurrency(remainingBalance)}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleMakePayment}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Make Payment
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Financial Insights/Suggestions Card */}
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-none shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                <Lightbulb className="h-5 w-5 mr-2 text-amber-600" />
                Financial Insights
                {financialData?.usingAI && (
                  <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800 border-blue-300">
                    GPT-4.5 Powered
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {financialData?.insights && financialData.insights.length > 0 ? (
                <div className="space-y-3">
                  {financialData.insights.slice(0, 2).map((insight: any, index: number) => (
                    <div key={index} className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="flex justify-between items-start">
                        <h3 className="text-sm font-medium text-amber-800">{insight.title}</h3>
                        {financialData?.usingAI && (
                          <div className="text-blue-500 rounded-full bg-blue-50 p-1 h-5 w-5 flex items-center justify-center ml-2" title="GPT-4.5 Generated">
                            <span className="text-xs font-bold">AI</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{insight.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <h3 className="text-sm font-medium text-amber-800">Early Payoff Opportunity</h3>
                  <p className="text-sm text-gray-600">
                    By paying off your contract early, you could save on interest payments.
                  </p>
                </div>
              )}
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  className="w-full border-amber-400 text-amber-800 hover:bg-amber-200"
                  onClick={handleEarlyPayoff}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Early Payoff Options
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Financial Sherpa component temporarily hidden */}

        {/* Cash Management Tools and Financial Data Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <div className="rounded-full w-7 h-7 bg-gradient-to-br from-blue-400 to-teal-500 shadow flex items-center justify-center mr-2">
              <Wallet className="h-5 w-5 text-white" strokeWidth={1.25} />
            </div>
            Cash Management Tools
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Account Balance Overview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  <PiggyBank className="h-4 w-4 mr-2 text-primary" />
                  Account Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Show account data from either financialData API or directly fetched plaidData */}
                {(financialData?.hasPlaidData && financialData?.accounts) || plaidAccountData ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Balance</span>
                      <span className="font-medium">
                        {formatCurrency(
                          (financialData?.accounts?.totalBalance) || 
                          (plaidAccountData?.totalBalance) || 
                          0
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Available Balance</span>
                      <span className="font-medium">
                        {formatCurrency(
                          (financialData?.accounts?.totalAvailableBalance) || 
                          (plaidAccountData?.totalAvailableBalance) || 
                          0
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Accounts</span>
                      <span className="font-medium">
                        {(financialData?.accounts?.totalAccounts) || 
                         (plaidAccountData?.totalAccounts) || 
                         (plaidAccountData?.accounts?.length) || 
                         1}
                      </span>
                    </div>
                    {/* Show bank name if available */}
                    {(plaidAccountData?.institution?.name || bankConnectionDetails?.bankName) && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center text-sm">
                          <Building className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-gray-700">
                            {plaidAccountData?.institution?.name || bankConnectionDetails?.bankName}
                          </span>
                        </div>
                      </div>
                    )}
                    {/* Button to view full details */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2 w-full"
                      onClick={() => handleViewBankConnection(contract?.id || 0)}
                    >
                      View Bank Details
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-green-600 mb-2">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      <span className="font-medium">Bank Connected</span>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm text-gray-600">Your bank account is connected. View details or make changes to your connection.</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3 w-full"
                        onClick={() => handleViewBankConnection(contract?.id || 0)}
                      >
                        View Bank Details
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enhanced Cash Flow with AI Insights */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2 text-primary" />
                  Cash Flow Analysis
                  {financialData?.usingAI && (
                    <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800 border-blue-300 text-xs">
                      GPT-4.5 Powered
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingFinancialData || (!financialData && !bankConnectionDetails) ? (
                  // Show loading state when financial data is loading
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-sm text-gray-500">Loading your financial data...</p>
                  </div>
                ) : financialData?.hasPlaidData && financialData?.cashFlow ? (
                  // Show cash flow data if available
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Monthly Income</span>
                      <div className="flex items-center">
                        <ArrowUp className="h-3 w-3 mr-1 text-green-500" />
                        <span className="font-medium text-green-600">
                          {formatCurrency(financialData.cashFlow.monthlyIncome || 0)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Monthly Expenses</span>
                      <div className="flex items-center">
                        <ArrowDown className="h-3 w-3 mr-1 text-red-500" />
                        <span className="font-medium text-red-600">
                          {formatCurrency(financialData.cashFlow.monthlyExpenses || 0)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Net Cash Flow</span>
                        <span className={`font-medium ${
                          (financialData.cashFlow.monthlyIncome || 0) - 
                          (financialData.cashFlow.monthlyExpenses || 0) > 0 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {formatCurrency(
                            (financialData.cashFlow.monthlyIncome || 0) - 
                            (financialData.cashFlow.monthlyExpenses || 0)
                          )}
                        </span>
                      </div>
                    </div>
                    
                    {/* AI-generated insights section */}
                    {financialData?.insights && financialData.insights.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <h4 className="text-sm font-medium mb-2 flex items-center">
                          <Lightbulb className="h-3.5 w-3.5 mr-1 text-amber-500" />
                          Cash Flow Insights
                        </h4>
                        <div className="space-y-2">
                          {financialData.insights
                            .filter((insight: any) => insight.category === 'cash-flow' || !insight.category)
                            .slice(0, 2)
                            .map((insight: any, idx: number) => (
                              <div key={idx} className="bg-blue-50 p-2 rounded-md">
                                <p className="text-xs text-blue-800">
                                  {insight.description || insight.content}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Top spending categories */}
                    {financialData?.cashFlow?.categories && financialData.cashFlow.categories.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <h4 className="text-sm font-medium mb-2">Top Spending Categories</h4>
                        <div className="space-y-2">
                          {financialData.cashFlow.categories.slice(0, 3).map((category: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center">
                              <span className="text-xs text-gray-500">{category.name}</span>
                              <span className="text-xs font-medium">{formatCurrency(category.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : bankConnectionDetails ? (
                  // Bank is connected but financial data is still loading or missing
                  <div className="space-y-3">
                    <div className="bg-blue-50 p-3 rounded-md">
                      <div className="flex items-center text-blue-800 mb-2">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        <span className="text-sm font-medium">Your bank account is connected</span>
                      </div>
                      <p className="text-xs text-blue-700">
                        {bankConnectionDetails.bankName} - {bankConnectionDetails.accountName || 'Account'} 
                        {bankConnectionDetails.accountMask ? ` (${bankConnectionDetails.accountMask})` : ''}
                      </p>
                      
                      {/* Show refresh option if financial data is missing */}
                      {!financialData?.hasPlaidData && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3 w-full"
                          onClick={() => refetchFinancialData()}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          Refresh Financial Data
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  // No bank connection found
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <BarChart className="h-10 w-10 mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">We couldn't find your bank information</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => handleViewBankConnection(contract?.id || 0)}
                    >
                      Connect Bank Account
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Financial Savings Opportunities */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  <DollarSign className="h-4 w-4 mr-2 text-primary" />
                  Savings Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingFinancialData || (!financialData && !bankConnectionDetails) ? (
                  // Show loading state when financial data is loading
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-sm text-gray-500">Loading savings opportunities...</p>
                  </div>
                ) : financialData?.hasPlaidData ? (
                  // When we have Plaid data, show insights
                  <div className="space-y-3">
                    {/* Display AI-generated savings insights if available */}
                    {financialData?.insights && financialData.insights
                      .filter((insight: any) => insight.category === 'savings' || insight.title?.toLowerCase().includes('saving'))
                      .slice(0, 2)
                      .map((insight: any, idx: number) => (
                        <div key={idx} className="bg-green-50 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-green-800">{insight.title}</h4>
                          <p className="text-xs text-green-700 mt-1">
                            {insight.description || insight.content}
                          </p>
                        </div>
                      ))}
                      
                    {/* Show a generic saving tip if no AI insights for savings */}
                    {(!financialData?.insights || !financialData.insights.some((i: any) => 
                      i.category === 'savings' || i.title?.toLowerCase().includes('saving'))) && (
                      <div className="bg-green-50 p-3 rounded-md">
                        <h4 className="text-sm font-medium text-green-800">Debt Reduction Strategy</h4>
                        <p className="text-xs text-green-700 mt-1">
                          Consider allocating your positive cash flow to reduce your highest interest debt first, 
                          which could save you {formatCurrency(contract?.monthlyPayment * 0.1)} monthly in interest.
                        </p>
                      </div>
                    )}
                  </div>
                ) : bankConnectionDetails ? (
                  // Bank is connected but financial data is still loading or missing
                  <div className="space-y-3">
                    <div className="bg-green-50 p-3 rounded-md">
                      <h4 className="text-sm font-medium text-green-800">Analyzing Your Finances</h4>
                      <p className="text-xs text-green-700 mt-1">
                        We're analyzing your bank data to identify potential savings opportunities.
                        Check back soon for personalized recommendations.
                      </p>
                      {!financialData?.hasPlaidData && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3 w-full"
                          onClick={() => refetchFinancialData()}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          Refresh Savings Analysis
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  // No bank connection found
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <PiggyBank className="h-10 w-10 mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">We couldn't find your bank information</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => handleViewBankConnection(contract?.id || 0)}
                    >
                      Connect Bank Account
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Personalized Financial Suggestions */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Lightbulb className="mr-2 h-5 w-5 text-amber-500" />
            Personalized Suggestions
            {financialData?.usingAI && (
              <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800 border-blue-300 text-xs">
                GPT-4.5 Powered
              </Badge>
            )}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {isLoadingFinancialData || (!financialData && !bankConnectionDetails) ? (
              // Show loading state when financial data is loading
              <Card className="md:col-span-2">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                  <h3 className="font-medium mb-2">Loading Your Personal Recommendations</h3>
                  <p className="text-sm text-gray-500">
                    We're retrieving your financial data to generate tailored suggestions
                  </p>
                </CardContent>
              </Card>
            ) : financialData?.hasPlaidData && financialData?.suggestions && financialData.suggestions.length > 0 ? (
              // Show suggestions when we have Plaid data and suggestions are available
              financialData.suggestions.map((suggestion: any, index: number) => (
                <Card key={index} className="border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <div className="flex justify-between">
                      <h3 className="font-medium mb-1">{suggestion.title}</h3>
                      {financialData?.usingAI && (
                        <div className="text-blue-500 rounded-full bg-blue-50 p-1 h-6 w-6 flex items-center justify-center" title="GPT-4.5 Generated">
                          <span className="text-xs font-bold">AI</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                    {suggestion.actionUrl && (
                      <Button variant="link" className="text-amber-600 p-0 h-auto" asChild>
                        <a href={suggestion.actionUrl}>
                          {suggestion.actionText || "Learn more"} <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : bankConnectionDetails ? (
              // Bank is connected but suggestions aren't available yet
              <Card className="md:col-span-2">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <Lightbulb className="h-12 w-12 mb-3 text-amber-500" />
                  <h3 className="font-medium mb-2">
                    Analyzing Your Financial Data
                  </h3>
                  <p className="text-sm text-gray-500">
                    We're analyzing your transaction history to generate personalized recommendations. 
                    Check back soon for insights tailored to your financial habits.
                  </p>
                  {!financialData?.hasPlaidData && (
                    <Button 
                      className="mt-4" 
                      variant="outline" 
                      size="sm"
                      onClick={() => refetchFinancialData()}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Refresh Analysis
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              // No bank connection found
              <Card className="md:col-span-2">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <Lightbulb className="h-12 w-12 mb-3 text-amber-200" />
                  <h3 className="font-medium mb-2">
                    We Couldn't Find Your Banking Data
                  </h3>
                  <p className="text-sm text-gray-500">
                    Connect your financial accounts to receive customized suggestions based on your spending patterns and financial goals.
                  </p>
                  <Button 
                    className="mt-4" 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewBankConnection(contract?.id || 0)}
                  >
                    Connect Bank Account
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Bank Connection Dialog */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isCheckingBankConnection 
                ? "Checking Bank Connection..." 
                : "Your Bank Connection"
              }
            </DialogTitle>
          </DialogHeader>
          
          {isCheckingBankConnection ? (
            <div className="p-6 text-center">
              <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Checking for existing bank connections...</p>
            </div>
          ) : (
            <BankConnection 
              contractId={activeBankContractId || 0} 
              progressId={0}
              existingConnection={bankConnectionDetails}
              onComplete={() => {
                setShowBankDialog(false);
                if (contract?.customerId) {
                  window.location.reload();
                }
                toast({
                  title: "Bank Connected",
                  description: "Your bank account has been successfully connected. You can now view your financial data.",
                });
              }}
              onBack={() => setShowBankDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}