import { useEffect, useState } from "react";
import MerchantLayout from "@/components/layout/MerchantLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useParams } from "wouter";
import DocumentView from "@/components/contract/DocumentView";
import { useAuth } from "@/hooks/use-auth";
import { Contract } from "@shared/schema";
import UnderwritingViewFactory from "@/components/underwriting/UnderwritingViewFactory";
import { ApplicationProgress } from "@/components/contract/ApplicationProgress";
import PaymentSchedule from "@/components/customer/PaymentSchedule";

export default function ContractDetails() {
  const { contractId } = useParams();
  const { user } = useAuth();
  const [contract, setContract] = useState<Contract | null>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContractDetails = async () => {
      if (!contractId) return;
      
      try {
        const response = await fetch(`/api/contracts/${contractId}`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch contract details');
        }
        
        const data = await response.json();
        setContract(data.contract);
        setProgress(data.progress || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching contract details:', err);
        setError('Error loading contract details');
        setLoading(false);
      }
    };

    fetchContractDetails();
  }, [contractId]);

  // Function for formatting monetary values
  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Function to get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'completed':
        return 'secondary';
      case 'declined':
      case 'cancelled':
        return 'destructive';
      default:
        return 'default';
    }
  };

  // Function to get credit tier badge variant
  const getCreditTierBadgeVariant = (tier: string | null | undefined) => {
    if (!tier) return "default";
    
    switch (tier) {
      case "tier1":
        return "success";
      case "tier2":
        return "warning";
      case "tier3":
        return "secondary";
      case "declined":
        return "destructive";
      default:
        return "default";
    }
  };
  
  // Function to format credit tier for display
  const formatCreditTier = (tier: string | null | undefined) => {
    if (!tier) return "Not Rated";
    
    // Convert tier1 to Tier 1, etc.
    return tier.replace(/tier(\d)/, 'Tier $1').charAt(0).toUpperCase() + tier.slice(1).replace(/tier(\d)/, 'Tier $1');
  };

  if (loading) {
    return (
      <MerchantLayout>
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
            <p className="ml-2">Loading contract details...</p>
          </div>
        </div>
      </MerchantLayout>
    );
  }

  if (error || !contract) {
    return (
      <MerchantLayout>
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  {error || 'Contract not found'}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contract #{contract.contractNumber}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Created on {format(new Date(contract.createdAt || new Date()), 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline">Export</Button>
            <Button variant="outline">Send to Customer</Button>
          </div>
        </div>

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Contract Details</TabsTrigger>
            <TabsTrigger value="application">Application Progress</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="underwriting">Underwriting</TabsTrigger>
            <TabsTrigger value="payments">Payment Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer & Contract Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-gray-900">Customer Information</h3>
                      <p className="text-sm text-gray-500">Customer ID: {contract.customerId || 'Not assigned'}</p>
                      <p className="text-sm text-gray-500">Phone: {contract.phoneNumber || 'Not provided'}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-900">Status</h3>
                      <div className="flex items-center mt-1">
                        <Badge variant={getStatusBadgeVariant(contract.status)}>
                          {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                        </Badge>
                        <span className="ml-2 text-sm text-gray-500">
                          Current step: {contract.currentStep.charAt(0).toUpperCase() + contract.currentStep.slice(1)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium text-gray-900">Credit Rating</h3>
                      <div className="flex items-center mt-1">
                        <Badge variant={getCreditTierBadgeVariant(contract.creditTier)}>
                          {formatCreditTier(contract.creditTier)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-gray-900">Financial Details</h3>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <p className="text-sm text-gray-500">Purchase Amount</p>
                          <p className="font-medium">{formatCurrency(contract.amount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Down Payment</p>
                          <p className="font-medium">{formatCurrency(contract.downPayment)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Financed Amount</p>
                          <p className="font-medium">{formatCurrency(contract.financedAmount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Interest Rate</p>
                          <p className="font-medium">{contract.interestRate}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Term</p>
                          <p className="font-medium">{contract.termMonths} months</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Monthly Payment</p>
                          <p className="font-medium">{formatCurrency(contract.monthlyPayment)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="application">
            <Card>
              <CardHeader>
                <CardTitle>Application Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <ApplicationProgress contractId={parseInt(contractId!)} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Contract Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentView contractId={parseInt(contractId!)} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="underwriting">
            <Card>
              <CardHeader>
                <CardTitle>Underwriting Information</CardTitle>
              </CardHeader>
              <CardContent>
                <UnderwritingViewFactory 
                  userRole={user?.role || 'merchant'} 
                  contractId={parseInt(contractId!)} 
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payment Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentSchedule 
                  amount={contract.financedAmount} 
                  downPayment={contract.downPayment}
                  termMonths={contract.termMonths} 
                  interestRate={contract.interestRate} 
                  contractId={parseInt(contractId!)}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MerchantLayout>
  );
}