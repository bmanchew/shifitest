
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { RefreshCw, Info, AlertTriangle, ArrowUpDown } from 'lucide-react';

interface MerchantPerformance {
  id: number;
  merchantId: number;
  merchantName: string;
  performanceScore: number;
  grade: string;
  defaultRate: number;
  totalContracts: number;
  activeContracts: number;
  riskAdjustedReturn: number;
  lastUpdated: string;
}

interface DetailedMerchantPerformance extends MerchantPerformance {
  latePaymentRate: number;
  avgContractValue: number;
  completedContracts: number;
  cancelledContracts: number;
  customerSatisfactionScore: number;
  underwritingRecommendations: string;
}

export default function MerchantPerformance() {
  const queryClient = useQueryClient();
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<string>('grade');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Query for all merchant performances
  const { data: merchants = [], isLoading } = useQuery<MerchantPerformance[]>({
    queryKey: ['/api/admin/merchant-performances'],
    queryFn: async () => {
      const res = await fetch('/api/admin/merchant-performances', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch merchant performances');
      }
      return res.json();
    },
  });

  // Query for detailed merchant performance
  const { data: merchantDetail, isLoading: isLoadingDetail } = useQuery<DetailedMerchantPerformance>({
    queryKey: ['/api/admin/merchant-performance', selectedMerchantId],
    queryFn: async () => {
      if (!selectedMerchantId) return null;
      const res = await fetch(`/api/admin/merchant-performance/${selectedMerchantId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch merchant performance details');
      }
      return res.json();
    },
    enabled: !!selectedMerchantId,
  });

  // Mutation to update all merchant performances
  const updateAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/update-all-merchant-performances', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to update merchant performances');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/merchant-performances'] });
    },
  });

  // Mutation to update single merchant performance
  const updateMerchantMutation = useMutation({
    mutationFn: async (merchantId: number) => {
      const res = await fetch(`/api/admin/update-merchant-performance/${merchantId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to update merchant performance');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/merchant-performances'] });
      if (selectedMerchantId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/admin/merchant-performance', selectedMerchantId] 
        });
      }
    },
  });

  // Helper function to determine badge color based on grade
  const getGradeColor = (grade: string) => {
    const firstChar = grade.charAt(0);
    switch (firstChar) {
      case 'A':
        return 'bg-green-100 text-green-800';
      case 'B':
        return 'bg-blue-100 text-blue-800';
      case 'C':
        return 'bg-yellow-100 text-yellow-800';
      case 'D':
        return 'bg-orange-100 text-orange-800';
      case 'F':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Format percentage values
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  // Sort merchants based on current sort field and direction
  const sortedMerchants = [...merchants].sort((a, b) => {
    let compareA: any = a[sortField as keyof MerchantPerformance];
    let compareB: any = b[sortField as keyof MerchantPerformance];
    
    // Special handling for string fields
    if (typeof compareA === 'string') {
      compareA = compareA.toLowerCase();
      compareB = compareB.toLowerCase();
    }
    
    // Handle the sorting
    if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
    if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Handle sort click
  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Parse recommendations
  const parseRecommendations = (recommendationsString: string) => {
    try {
      return JSON.parse(recommendationsString);
    } catch (e) {
      return [recommendationsString];
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-xl">Merchant Performance Analysis</CardTitle>
            <CardDescription>
              Monitor the performance of all merchants in the platform
            </CardDescription>
          </div>
          <Button 
            onClick={() => updateAllMutation.mutate()} 
            disabled={updateAllMutation.isPending}
            variant="outline" 
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${updateAllMutation.isPending ? 'animate-spin' : ''}`} />
            {updateAllMutation.isPending ? 'Updating...' : 'Update All'}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableCaption>A list of merchant performance metrics</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => handleSort('merchantName')} className="cursor-pointer">
                    <div className="flex items-center">
                      Merchant
                      {sortField === 'merchantName' && (
                        <ArrowUpDown className={`ml-1 h-4 w-4 ${
                          sortDirection === 'desc' ? 'transform rotate-180' : ''
                        }`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('grade')} className="cursor-pointer">
                    <div className="flex items-center">
                      Grade
                      {sortField === 'grade' && (
                        <ArrowUpDown className={`ml-1 h-4 w-4 ${
                          sortDirection === 'desc' ? 'transform rotate-180' : ''
                        }`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('performanceScore')} className="cursor-pointer">
                    <div className="flex items-center">
                      Score
                      {sortField === 'performanceScore' && (
                        <ArrowUpDown className={`ml-1 h-4 w-4 ${
                          sortDirection === 'desc' ? 'transform rotate-180' : ''
                        }`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('defaultRate')} className="cursor-pointer">
                    <div className="flex items-center">
                      Default Rate
                      {sortField === 'defaultRate' && (
                        <ArrowUpDown className={`ml-1 h-4 w-4 ${
                          sortDirection === 'desc' ? 'transform rotate-180' : ''
                        }`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('totalContracts')} className="cursor-pointer">
                    <div className="flex items-center">
                      Contracts
                      {sortField === 'totalContracts' && (
                        <ArrowUpDown className={`ml-1 h-4 w-4 ${
                          sortDirection === 'desc' ? 'transform rotate-180' : ''
                        }`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('riskAdjustedReturn')} className="cursor-pointer">
                    <div className="flex items-center">
                      Risk-Adj Return
                      {sortField === 'riskAdjustedReturn' && (
                        <ArrowUpDown className={`ml-1 h-4 w-4 ${
                          sortDirection === 'desc' ? 'transform rotate-180' : ''
                        }`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMerchants.map((merchant) => (
                  <TableRow key={merchant.id}>
                    <TableCell className="font-medium">{merchant.merchantName}</TableCell>
                    <TableCell>
                      <Badge className={getGradeColor(merchant.grade)}>
                        {merchant.grade}
                      </Badge>
                    </TableCell>
                    <TableCell>{Math.round(merchant.performanceScore)}</TableCell>
                    <TableCell className={merchant.defaultRate > 0.05 ? "text-red-600" : ""}>
                      {formatPercent(merchant.defaultRate)}
                    </TableCell>
                    <TableCell>{merchant.totalContracts}</TableCell>
                    <TableCell>{merchant.riskAdjustedReturn.toFixed(1)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Dialog onOpenChange={(open) => {
                          if (open) setSelectedMerchantId(merchant.merchantId);
                          else setSelectedMerchantId(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Info className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>{merchant.merchantName} Performance Details</DialogTitle>
                              <DialogDescription>
                                Detailed performance metrics and AI-generated recommendations
                              </DialogDescription>
                            </DialogHeader>
                            {isLoadingDetail ? (
                              <div className="space-y-2 py-4">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                              </div>
                            ) : merchantDetail ? (
                              <div className="py-4">
                                <div className="flex justify-between items-center mb-4">
                                  <div>
                                    <p className="text-sm text-gray-500">Performance Score</p>
                                    <div className="flex items-center">
                                      <Badge 
                                        className={`text-lg font-bold ${getGradeColor(merchantDetail.grade)}`}
                                      >
                                        {merchantDetail.grade}
                                      </Badge>
                                      <span className="ml-2 text-sm font-medium">
                                        {Math.round(merchantDetail.performanceScore)}
                                      </span>
                                    </div>
                                  </div>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => updateMerchantMutation.mutate(merchantDetail.merchantId)}
                                    disabled={updateMerchantMutation.isPending}
                                  >
                                    <RefreshCw className={`mr-2 h-4 w-4 ${
                                      updateMerchantMutation.isPending ? 'animate-spin' : ''
                                    }`} />
                                    {updateMerchantMutation.isPending ? 'Updating...' : 'Refresh Analysis'}
                                  </Button>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 my-4">
                                  <div className="space-y-2">
                                    <h3 className="text-sm font-medium">Financial Metrics</h3>
                                    <div className="bg-gray-50 p-3 rounded-md">
                                      <div className="grid grid-cols-2 gap-y-2">
                                        <div>
                                          <p className="text-xs text-gray-500">Default Rate</p>
                                          <p className={`text-sm font-medium ${
                                            merchantDetail.defaultRate > 0.05 ? 'text-red-600' : ''
                                          }`}>
                                            {formatPercent(merchantDetail.defaultRate)}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Late Payment Rate</p>
                                          <p className={`text-sm font-medium ${
                                            merchantDetail.latePaymentRate > 0.15 ? 'text-amber-600' : ''
                                          }`}>
                                            {formatPercent(merchantDetail.latePaymentRate)}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Risk-Adjusted Return</p>
                                          <p className="text-sm font-medium">
                                            {merchantDetail.riskAdjustedReturn.toFixed(1)}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Avg Contract Value</p>
                                          <p className="text-sm font-medium">
                                            {formatCurrency(merchantDetail.avgContractValue)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <h3 className="text-sm font-medium">Contract Summary</h3>
                                    <div className="bg-gray-50 p-3 rounded-md">
                                      <div className="grid grid-cols-2 gap-y-2">
                                        <div>
                                          <p className="text-xs text-gray-500">Total Contracts</p>
                                          <p className="text-sm font-medium">{merchantDetail.totalContracts}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Active Contracts</p>
                                          <p className="text-sm font-medium">{merchantDetail.activeContracts}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Completed Contracts</p>
                                          <p className="text-sm font-medium">{merchantDetail.completedContracts}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Cancelled Contracts</p>
                                          <p className="text-sm font-medium">{merchantDetail.cancelledContracts}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="mt-6 space-y-2">
                                  <div className="flex items-center">
                                    <AlertTriangle className="text-amber-500 h-5 w-5 mr-2" />
                                    <h3 className="text-sm font-medium">AI Underwriting Recommendations</h3>
                                  </div>
                                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                                    <ul className="list-disc list-inside space-y-1">
                                      {merchantDetail.underwritingRecommendations && 
                                       parseRecommendations(merchantDetail.underwritingRecommendations).map((rec: string, i: number) => (
                                        <li key={i} className="text-sm">
                                          {rec}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                                
                                <div className="text-xs text-gray-400 mt-6 text-right">
                                  Last updated: {format(new Date(merchantDetail.lastUpdated), 'MMM d, yyyy HH:mm')}
                                </div>
                              </div>
                            ) : (
                              <div className="py-4">
                                <p>No detailed data available</p>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updateMerchantMutation.mutate(merchant.merchantId)}
                          disabled={updateMerchantMutation.isPending}
                        >
                          <RefreshCw className={`h-4 w-4 ${
                            updateMerchantMutation.isPending && selectedMerchantId === merchant.merchantId 
                              ? 'animate-spin' 
                              : ''
                          }`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
