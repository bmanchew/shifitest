import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Calendar, BarChart3, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Types for funding API response
interface FundingTransfer {
  id: number;
  transferId: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
  contractId: number | null;
  metadata: any | null;
}

interface FundingBatch {
  date: string;
  batchTotal: number;
  transferCount: number;
  transfers: FundingTransfer[];
}

interface FundingMetrics {
  totalFunding: number;
  totalTransfers: number;
  successfulTransfers: number;
}

interface FundingResponse {
  success: boolean;
  fundingBatches: FundingBatch[];
  metrics: FundingMetrics;
}

interface TransferDetailResponse {
  success: boolean;
  transfer: FundingTransfer;
  contract: {
    id: number;
    contractNumber: string;
    amount: number;
    financedAmount: number;
    status: string;
  } | null;
}

export default function MerchantFunding() {
  const { user } = useAuth();
  const merchantId = user?.merchantId || 49; // Default to Shiloh Finance ID (49)
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);

  // Query to fetch funding data
  const { data: fundingData, isLoading: isLoadingFunding, error: fundingError } = useQuery<FundingResponse>({
    queryKey: ['/api/merchants', merchantId, 'funding'],
    queryFn: async () => {
      const res = await fetch(`/api/merchants/${merchantId}/funding`, {
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch funding data');
      }
      
      return res.json();
    },
    retry: 1,
    retryDelay: 1000,
  });

  // Query to fetch transfer details when a transfer is selected
  const { data: transferDetails, isLoading: isLoadingDetails } = useQuery<TransferDetailResponse>({
    queryKey: ['/api/merchants', merchantId, 'funding', selectedTransferId],
    queryFn: async () => {
      if (!selectedTransferId) {
        throw new Error('No transfer selected');
      }
      
      const res = await fetch(`/api/merchants/${merchantId}/funding/${selectedTransferId}`, {
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch transfer details');
      }
      
      return res.json();
    },
    enabled: !!selectedTransferId, // Only run query when a transfer is selected
    retry: 1,
    retryDelay: 1000,
  });

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Helper to get status badge color
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'posted':
      case 'settled':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'pending':
      case 'processing':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'failed':
      case 'returned':
        return <Badge className="bg-red-500">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (fundingError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funding Data</CardTitle>
          <CardDescription>Could not load funding data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">
            Error loading funding information. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="mr-2 h-5 w-5 text-primary" />
            Funding Overview
          </CardTitle>
          <CardDescription>View all funding transactions and payments received</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingFunding ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Funding Received
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {formatCurrency(fundingData?.metrics.totalFunding || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across {fundingData?.metrics.totalTransfers || 0} transfers
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Successful Transfers
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {fundingData?.metrics.successfulTransfers || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fundingData?.metrics.totalTransfers 
                      ? Math.round((fundingData.metrics.successfulTransfers / fundingData.metrics.totalTransfers) * 100) 
                      : 0}% success rate
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Latest Funding Batch
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {fundingData?.fundingBatches.length ? 
                      formatCurrency(fundingData.fundingBatches[0].batchTotal) : 
                      '$0.00'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fundingData?.fundingBatches.length ? 
                      formatDate(fundingData.fundingBatches[0].date) :
                      'No batches yet'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="batches">
        <TabsList className="mb-4">
          <TabsTrigger value="batches">
            <Calendar className="h-4 w-4 mr-2" />
            Funding Batches
          </TabsTrigger>
          <TabsTrigger value="all">
            <BarChart3 className="h-4 w-4 mr-2" />
            All Transfers
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="batches">
          <Card>
            <CardHeader>
              <CardTitle>Funding Batches</CardTitle>
              <CardDescription>
                Summary of all funding batches grouped by date
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingFunding ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-md" />
                  ))}
                </div>
              ) : fundingData?.fundingBatches.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No funding batches available
                </p>
              ) : (
                <div className="space-y-4">
                  {fundingData?.fundingBatches.map((batch) => (
                    <Card key={batch.date} className="overflow-hidden">
                      <div className="bg-muted p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold">
                              Batch: {formatDate(batch.date)}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {batch.transferCount} transfer{batch.transferCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(batch.batchTotal)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Amount</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Time</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batch.transfers.map((transfer) => (
                              <TableRow key={transfer.id}>
                                <TableCell className="font-medium">
                                  {formatCurrency(transfer.amount)}
                                </TableCell>
                                <TableCell>{transfer.description || 'N/A'}</TableCell>
                                <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                                <TableCell>
                                  {new Date(transfer.createdAt).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedTransferId(transfer.transferId)}
                                      >
                                        <ArrowUpRight className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[425px]">
                                      <DialogHeader>
                                        <DialogTitle>Transfer Details</DialogTitle>
                                        <DialogDescription>
                                          Details for transfer {transfer.transferId.substring(0, 8)}...
                                        </DialogDescription>
                                      </DialogHeader>
                                      
                                      {isLoadingDetails ? (
                                        <div className="space-y-4 py-4">
                                          <Skeleton className="h-4 w-full" />
                                          <Skeleton className="h-4 w-3/4" />
                                          <Skeleton className="h-4 w-1/2" />
                                        </div>
                                      ) : (
                                        <div className="py-4">
                                          <div className="grid grid-cols-2 gap-2">
                                            <div className="text-sm font-medium">Amount</div>
                                            <div className="text-sm">{formatCurrency(transferDetails?.transfer.amount || 0)}</div>
                                            
                                            <div className="text-sm font-medium">Status</div>
                                            <div className="text-sm">{getStatusBadge(transferDetails?.transfer.status || '')}</div>
                                            
                                            <div className="text-sm font-medium">Date</div>
                                            <div className="text-sm">
                                              {transferDetails?.transfer.createdAt ? 
                                                formatDate(transferDetails.transfer.createdAt) : 'N/A'}
                                            </div>
                                            
                                            <div className="text-sm font-medium">Time</div>
                                            <div className="text-sm">
                                              {transferDetails?.transfer.createdAt ? 
                                                new Date(transferDetails.transfer.createdAt).toLocaleTimeString('en-US') : 'N/A'}
                                            </div>
                                            
                                            <div className="text-sm font-medium">Description</div>
                                            <div className="text-sm">{transferDetails?.transfer.description || 'N/A'}</div>
                                            
                                            <div className="text-sm font-medium">Transfer ID</div>
                                            <div className="text-sm font-mono text-xs">{transferDetails?.transfer.transferId}</div>
                                          </div>
                                          
                                          {transferDetails?.contract && (
                                            <>
                                              <Separator className="my-4" />
                                              <h4 className="text-sm font-semibold mb-2">Related Contract</h4>
                                              <div className="grid grid-cols-2 gap-2">
                                                <div className="text-sm font-medium">Contract #</div>
                                                <div className="text-sm">{transferDetails.contract.contractNumber}</div>
                                                
                                                <div className="text-sm font-medium">Contract Amount</div>
                                                <div className="text-sm">{formatCurrency(transferDetails.contract.amount)}</div>
                                                
                                                <div className="text-sm font-medium">Financed Amount</div>
                                                <div className="text-sm">{formatCurrency(transferDetails.contract.financedAmount)}</div>
                                                
                                                <div className="text-sm font-medium">Status</div>
                                                <div className="text-sm capitalize">{transferDetails.contract.status}</div>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </DialogContent>
                                  </Dialog>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Transfers</CardTitle>
              <CardDescription>
                Detailed list of all funding transfers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingFunding ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fundingData?.fundingBatches.flatMap(batch => 
                      batch.transfers.map(transfer => (
                        <TableRow key={transfer.id}>
                          <TableCell>
                            {new Date(transfer.createdAt).toLocaleDateString('en-US')}
                            <div className="text-xs text-muted-foreground">
                              {new Date(transfer.createdAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(transfer.amount)}
                          </TableCell>
                          <TableCell>{transfer.description || 'N/A'}</TableCell>
                          <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                          <TableCell className="text-right">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedTransferId(transfer.transferId)}
                                >
                                  <ArrowUpRight className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                  <DialogTitle>Transfer Details</DialogTitle>
                                  <DialogDescription>
                                    Details for transfer {transfer.transferId.substring(0, 8)}...
                                  </DialogDescription>
                                </DialogHeader>
                                
                                {isLoadingDetails ? (
                                  <div className="space-y-4 py-4">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                  </div>
                                ) : (
                                  <div className="py-4">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="text-sm font-medium">Amount</div>
                                      <div className="text-sm">{formatCurrency(transferDetails?.transfer.amount || 0)}</div>
                                      
                                      <div className="text-sm font-medium">Status</div>
                                      <div className="text-sm">{getStatusBadge(transferDetails?.transfer.status || '')}</div>
                                      
                                      <div className="text-sm font-medium">Date</div>
                                      <div className="text-sm">
                                        {transferDetails?.transfer.createdAt ? 
                                          formatDate(transferDetails.transfer.createdAt) : 'N/A'}
                                      </div>
                                      
                                      <div className="text-sm font-medium">Time</div>
                                      <div className="text-sm">
                                        {transferDetails?.transfer.createdAt ? 
                                          new Date(transferDetails.transfer.createdAt).toLocaleTimeString('en-US') : 'N/A'}
                                      </div>
                                      
                                      <div className="text-sm font-medium">Description</div>
                                      <div className="text-sm">{transferDetails?.transfer.description || 'N/A'}</div>
                                      
                                      <div className="text-sm font-medium">Transfer ID</div>
                                      <div className="text-sm font-mono text-xs">{transferDetails?.transfer.transferId}</div>
                                    </div>
                                    
                                    {transferDetails?.contract && (
                                      <>
                                        <Separator className="my-4" />
                                        <h4 className="text-sm font-semibold mb-2">Related Contract</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="text-sm font-medium">Contract #</div>
                                          <div className="text-sm">{transferDetails.contract.contractNumber}</div>
                                          
                                          <div className="text-sm font-medium">Contract Amount</div>
                                          <div className="text-sm">{formatCurrency(transferDetails.contract.amount)}</div>
                                          
                                          <div className="text-sm font-medium">Financed Amount</div>
                                          <div className="text-sm">{formatCurrency(transferDetails.contract.financedAmount)}</div>
                                          
                                          <div className="text-sm font-medium">Status</div>
                                          <div className="text-sm capitalize">{transferDetails.contract.status}</div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))
                    ) || (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No transfers available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}