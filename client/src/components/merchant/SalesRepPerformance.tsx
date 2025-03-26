import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
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
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { 
  Users, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Check, 
  XCircle, 
  Clock, 
  DollarSign, 
  Info 
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

interface SalesRep {
  id: number;
  userId: number;
  active: boolean;
  title: string;
  commissionRate: number;
  commissionRateType: string;
  target: number;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  analytics: Array<{
    id: number;
    period: string;
    contractsCreated: number;
    contractsApproved: number;
    contractsDeclined: number;
    totalAmount: number;
    totalCommission: number;
    targetAchievementPercentage: number;
    conversionRate: number;
    avgContractAmount: number;
  }>;
  earnings: {
    totalEarned: number;
    totalPaid: number;
    pending: number;
  };
}

interface SalesRepPerformanceProps {
  merchantId: number;
}

const SalesRepPerformance = ({ merchantId }: SalesRepPerformanceProps) => {
  const [selectedSalesRep, setSelectedSalesRep] = useState<SalesRep | null>(null);

  const { data: salesReps = [], isLoading, refetch } = useQuery<SalesRep[]>({
    queryKey: ['/api/sales-reps', { merchantId }],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/sales-reps?merchantId=${merchantId}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error('Failed to fetch sales reps');
        }
        const data = await res.json();
        return data.success ? data.salesReps : [];
      } catch (error) {
        console.error('Error fetching sales reps:', error);
        return [];
      }
    },
  });

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleRefreshAnalytics = async (salesRepId: number) => {
    try {
      const res = await fetch(`/api/sales-reps/${salesRepId}/refresh-analytics`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (res.ok) {
        // Refetch the sales reps data
        refetch();
      }
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Rep Performance</CardTitle>
          <CardDescription>Loading sales representatives...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (salesReps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Rep Performance</CardTitle>
          <CardDescription>Track your sales representatives performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No Sales Representatives</h3>
            <p className="mt-1 text-sm text-gray-500">
              No sales representatives have been set up yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Sales Rep Performance</CardTitle>
            <CardDescription>Monitor your sales team's performance metrics</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contracts</TableHead>
                <TableHead>Approval Rate</TableHead>
                <TableHead>Sales Volume</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Target Achievement</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesReps.map((salesRep) => {
                // Get the latest analytics if available
                const latestAnalytics = salesRep.analytics && salesRep.analytics.length > 0 
                  ? salesRep.analytics[0] 
                  : null;
                
                const approvalRate = latestAnalytics?.contractsApproved && latestAnalytics.contractsCreated
                  ? (latestAnalytics.contractsApproved / latestAnalytics.contractsCreated) * 100
                  : 0;
                
                return (
                  <TableRow key={salesRep.id}>
                    <TableCell className="font-medium">
                      {salesRep.user?.firstName} {salesRep.user?.lastName}
                      {!salesRep.active && (
                        <Badge variant="outline" className="ml-2 bg-gray-100">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {latestAnalytics ? (
                        <div className="flex flex-col">
                          <span>{latestAnalytics.contractsApproved} / {latestAnalytics.contractsCreated}</span>
                          <span className="text-xs text-gray-500">Approved/Total</span>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {latestAnalytics ? (
                        <div className="flex items-center">
                          <span>{formatPercent(approvalRate)}</span>
                          {approvalRate > 70 ? (
                            <TrendingUp className="ml-1 h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="ml-1 h-4 w-4 text-red-500" />
                          )}
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {latestAnalytics ? (
                        formatCurrency(latestAnalytics.totalAmount)
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{formatCurrency(salesRep.earnings.totalEarned)}</span>
                        <span className="text-xs text-gray-500">
                          {formatCurrency(salesRep.earnings.pending)} pending
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {latestAnalytics?.targetAchievementPercentage ? (
                        <div className="flex items-center">
                          <span>{formatPercent(latestAnalytics.targetAchievementPercentage)}</span>
                          {latestAnalytics.targetAchievementPercentage >= 90 ? (
                            <Check className="ml-1 h-4 w-4 text-green-500" />
                          ) : latestAnalytics.targetAchievementPercentage >= 70 ? (
                            <Clock className="ml-1 h-4 w-4 text-yellow-500" />
                          ) : (
                            <XCircle className="ml-1 h-4 w-4 text-red-500" />
                          )}
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedSalesRep(salesRep)}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            {selectedSalesRep && (
                              <>
                                <DialogHeader>
                                  <DialogTitle>
                                    {selectedSalesRep.user?.firstName} {selectedSalesRep.user?.lastName} - Performance Details
                                  </DialogTitle>
                                  <DialogDescription>
                                    {selectedSalesRep.title} - {selectedSalesRep.commissionRate}% commission rate
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="bg-gray-50 p-4 rounded-md">
                                    <h3 className="font-medium text-sm mb-2">Contract Performance</h3>
                                    <div className="space-y-2">
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Created</span>
                                        <span className="font-medium">
                                          {selectedSalesRep.analytics?.[0]?.contractsCreated || 0}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Approved</span>
                                        <span className="font-medium">
                                          {selectedSalesRep.analytics?.[0]?.contractsApproved || 0}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Declined</span>
                                        <span className="font-medium">
                                          {selectedSalesRep.analytics?.[0]?.contractsDeclined || 0}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="bg-gray-50 p-4 rounded-md">
                                    <h3 className="font-medium text-sm mb-2">Financial Performance</h3>
                                    <div className="space-y-2">
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Volume</span>
                                        <span className="font-medium">
                                          {formatCurrency(selectedSalesRep.analytics?.[0]?.totalAmount || 0)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Avg. Contract</span>
                                        <span className="font-medium">
                                          {formatCurrency(selectedSalesRep.analytics?.[0]?.avgContractAmount || 0)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Target</span>
                                        <span className="font-medium">
                                          {formatCurrency(selectedSalesRep.target || 0)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="bg-gray-50 p-4 rounded-md">
                                    <h3 className="font-medium text-sm mb-2">Commission</h3>
                                    <div className="space-y-2">
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Earned</span>
                                        <span className="font-medium">
                                          {formatCurrency(selectedSalesRep.earnings.totalEarned)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Paid</span>
                                        <span className="font-medium">
                                          {formatCurrency(selectedSalesRep.earnings.totalPaid)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Pending</span>
                                        <span className="font-medium">
                                          {formatCurrency(selectedSalesRep.earnings.pending)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Performance Trends */}
                                {selectedSalesRep.analytics?.length > 1 && (
                                  <div className="mt-6">
                                    <h3 className="font-medium mb-2">Performance Trends</h3>
                                    <div className="h-72">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                          data={[...selectedSalesRep.analytics].reverse()}
                                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                        >
                                          <CartesianGrid strokeDasharray="3 3" />
                                          <XAxis dataKey="period" />
                                          <YAxis yAxisId="left" />
                                          <YAxis yAxisId="right" orientation="right" />
                                          <Tooltip formatter={(value, name) => {
                                            if (name === 'totalAmount') return formatCurrency(Number(value));
                                            if (name === 'targetAchievementPercentage') return formatPercent(Number(value));
                                            return value;
                                          }} />
                                          <Legend />
                                          <Line
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="totalAmount"
                                            name="Sales Volume"
                                            stroke="#10b981"
                                            activeDot={{ r: 8 }}
                                          />
                                          <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="targetAchievementPercentage"
                                            name="Target Achievement"
                                            stroke="#3b82f6"
                                            activeDot={{ r: 8 }}
                                          />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="mt-6 flex justify-end">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => handleRefreshAnalytics(selectedSalesRep.id)}
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Refresh Analytics
                                  </Button>
                                </div>
                              </>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRefreshAnalytics(salesRep.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesRepPerformance;