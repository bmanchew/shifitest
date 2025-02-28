import { useState, useMemo } from "react";
import MerchantLayout from "@/components/layout/MerchantLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Contract } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { format, subDays, subMonths, eachDayOfInterval, eachMonthOfInterval, isSameDay, isSameMonth, getMonth } from "date-fns";
import { Printer, Download, Calendar, BarChart2, PieChart, LineChart, ArrowUp, ArrowDown, TrendingUp, Percent, DollarSign, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { 
  LineChart as ReLineChart, 
  Line, 
  BarChart as ReBarChart, 
  Bar, 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

export default function Reports() {
  const { user } = useAuth();
  const merchantId = user?.merchantId || 1;
  const [timeRange, setTimeRange] = useState("30d");

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts", { merchantId }],
    queryFn: async () => {
      const res = await fetch(`/api/contracts?merchantId=${merchantId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch contracts");
      }
      return res.json();
    },
  });

  // Filter contracts by date range
  const getDateRangeStart = () => {
    const now = new Date();
    switch (timeRange) {
      case "7d":
        return subDays(now, 7);
      case "30d":
        return subDays(now, 30);
      case "90d":
        return subDays(now, 90);
      case "1y":
        return subMonths(now, 12);
      default:
        return subDays(now, 30);
    }
  };

  const filteredContracts = useMemo(() => 
    contracts.filter(contract => {
      const contractDate = contract.createdAt ? new Date(contract.createdAt) : new Date();
      const startDate = getDateRangeStart();
      return contractDate >= startDate;
    }),
    [contracts, timeRange]
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Calculate statistics
  const totalAmount = useMemo(() => 
    filteredContracts.reduce((sum, contract) => sum + contract.amount, 0),
    [filteredContracts]
  );
  
  const totalFinanced = useMemo(() => 
    filteredContracts.reduce((sum, contract) => sum + contract.financedAmount, 0),
    [filteredContracts]
  );
  
  const totalDownPayment = useMemo(() => 
    filteredContracts.reduce((sum, contract) => sum + contract.downPayment, 0),
    [filteredContracts]
  );
  
  const contractsByStatus = useMemo(() => {
    const statusCounts = {
      active: 0,
      pending: 0,
      completed: 0,
      declined: 0,
      cancelled: 0
    };
    
    filteredContracts.forEach(contract => {
      if (statusCounts.hasOwnProperty(contract.status)) {
        statusCounts[contract.status as keyof typeof statusCounts]++;
      }
    });
    
    return statusCounts;
  }, [filteredContracts]);
  
  // Advanced analytics metrics
  const completionRate = useMemo(() => {
    const completed = contractsByStatus.completed;
    const total = filteredContracts.length;
    return total ? (completed / total) * 100 : 0;
  }, [filteredContracts, contractsByStatus]);
  
  const conversionRate = useMemo(() => {
    const active = contractsByStatus.active;
    const pending = contractsByStatus.pending;
    const total = pending + active + contractsByStatus.completed + contractsByStatus.declined + contractsByStatus.cancelled;
    return total ? ((active + contractsByStatus.completed) / total) * 100 : 0;
  }, [contractsByStatus]);
  
  const averageContractValue = useMemo(() => 
    filteredContracts.length ? totalAmount / filteredContracts.length : 0,
    [filteredContracts, totalAmount]
  );

  const monthlyRevenue = useMemo(() => 
    totalFinanced / 24, // Assuming all contracts are 24-month term
    [totalFinanced]
  );

  // Generate time series data for charts
  const generateTimeSeriesData = useMemo(() => {
    const dateStart = getDateRangeStart();
    const now = new Date();
    
    let intervals = [];
    
    // Use different intervals based on selected time range
    if (timeRange === "7d" || timeRange === "30d") {
      intervals = eachDayOfInterval({ start: dateStart, end: now });
    } else {
      intervals = eachMonthOfInterval({ start: dateStart, end: now });
    }
    
    // Initialize the data structure
    const timeSeries = intervals.map(date => ({
      date: format(date, timeRange === "7d" || timeRange === "30d" ? "MMM dd" : "MMM yyyy"),
      value: 0,
      amount: 0,
      financed: 0,
      downPayment: 0,
      active: 0,
      pending: 0,
      completed: 0,
      declined: 0,
      cancelled: 0
    }));
    
    // Fill in the data from contracts
    filteredContracts.forEach(contract => {
      const contractDate = contract.createdAt ? new Date(contract.createdAt) : new Date();
      
      const index = intervals.findIndex(date => {
        if (timeRange === "7d" || timeRange === "30d") {
          return isSameDay(date, contractDate);
        } else {
          return isSameMonth(date, contractDate);
        }
      });
      
      if (index !== -1) {
        timeSeries[index].value += 1;
        timeSeries[index].amount += contract.amount;
        timeSeries[index].financed += contract.financedAmount;
        timeSeries[index].downPayment += contract.downPayment;
        timeSeries[index][contract.status as keyof typeof contractsByStatus] += 1;
      }
    });
    
    return timeSeries;
  }, [filteredContracts, timeRange]);

  // Prepare pie chart data
  const statusChartData = useMemo(() => [
    { name: 'Active', value: contractsByStatus.active, color: '#10b981' },
    { name: 'Pending', value: contractsByStatus.pending, color: '#f59e0b' },
    { name: 'Completed', value: contractsByStatus.completed, color: '#3b82f6' },
    { name: 'Declined', value: contractsByStatus.declined, color: '#ef4444' },
    { name: 'Cancelled', value: contractsByStatus.cancelled, color: '#6b7280' }
  ], [contractsByStatus]);

  // Prepare performance metrics
  const performanceMetrics = useMemo(() => [
    { 
      name: 'Completion Rate',
      value: `${completionRate.toFixed(1)}%`,
      trend: completionRate > 50 ? 'up' : 'down',
      color: completionRate > 50 ? 'text-green-500' : 'text-red-500',
      icon: Percent
    },
    { 
      name: 'Conversion Rate',
      value: `${conversionRate.toFixed(1)}%`,
      trend: conversionRate > 60 ? 'up' : 'down',
      color: conversionRate > 60 ? 'text-green-500' : 'text-red-500',
      icon: TrendingUp
    },
    { 
      name: 'Avg. Contract Value',
      value: formatCurrency(averageContractValue),
      trend: averageContractValue > 5000 ? 'up' : 'down',
      color: averageContractValue > 5000 ? 'text-green-500' : 'text-red-500',
      icon: DollarSign
    },
    { 
      name: 'Monthly Revenue',
      value: formatCurrency(monthlyRevenue),
      trend: 'up',
      color: 'text-green-500',
      icon: DollarSign
    }
  ], [completionRate, conversionRate, averageContractValue, monthlyRevenue]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'declined': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <MerchantLayout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Analytics Dashboard</h1>
              <p className="mt-1 text-sm text-gray-600">
                Advanced contract performance metrics and analytics
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[140px]">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="flex items-center">
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" className="flex items-center">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-[120px]" />
                  <Skeleton className="h-8 w-[150px] mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-[100px]" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="mt-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-primary">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Contract Value</CardDescription>
                    <CardTitle className="text-2xl">{formatCurrency(totalAmount)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <span className="font-medium">{filteredContracts.length}</span> contracts in period
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Financed Amount</CardDescription>
                    <CardTitle className="text-2xl">{formatCurrency(totalFinanced)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-gray-500">
                      Avg: {formatCurrency(totalFinanced / (filteredContracts.length || 1))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Down Payments</CardDescription>
                    <CardTitle className="text-2xl">{formatCurrency(totalDownPayment)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-gray-500">
                      {((totalDownPayment / totalAmount) * 100).toFixed(1)}% of total value
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-yellow-500">
                  <CardHeader className="pb-2">
                    <CardDescription>Contract Status</CardDescription>
                    <CardTitle className="text-2xl">{filteredContracts.length}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 text-xs">
                      <Badge variant="success">{contractsByStatus.active} Active</Badge>
                      <Badge variant="warning">{contractsByStatus.pending} Pending</Badge>
                      <Badge variant="default">{contractsByStatus.completed} Completed</Badge>
                      <Badge variant="destructive">{contractsByStatus.declined} Declined</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {performanceMetrics.map((metric, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardDescription>{metric.name}</CardDescription>
                      <CardTitle className="text-2xl">{metric.value}</CardTitle>
                    </div>
                    <div className={`rounded-full p-3 ${metric.color.replace('text', 'bg').replace('500', '100')}`}>
                      <metric.icon className={`h-6 w-6 ${metric.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      {metric.trend === 'up' ? (
                        <ArrowUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className={metric.trend === 'up' ? 'text-green-500' : 'text-red-500'}>
                        {metric.trend === 'up' ? 'Positive' : 'Negative'} trend
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8">
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview" className="flex items-center">
                    <BarChart2 className="mr-2 h-4 w-4" />
                    Financial
                  </TabsTrigger>
                  <TabsTrigger value="contracts" className="flex items-center">
                    <LineChart className="mr-2 h-4 w-4" />
                    Contracts
                  </TabsTrigger>
                  <TabsTrigger value="status" className="flex items-center">
                    <PieChart className="mr-2 h-4 w-4" />
                    Status
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Financial Performance</CardTitle>
                      <CardDescription>
                        Contract value distribution over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      {generateTimeSeriesData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500">
                          No data available for the selected time period
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <ReBarChart
                            data={generateTimeSeriesData}
                            margin={{
                              top: 20,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                            <Legend />
                            <Bar dataKey="amount" name="Total Amount" fill="#6366f1" />
                            <Bar dataKey="financed" name="Financed" fill="#10b981" />
                            <Bar dataKey="downPayment" name="Down Payment" fill="#f59e0b" />
                          </ReBarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="contracts" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Contract Trends</CardTitle>
                      <CardDescription>
                        Number of contracts over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      {generateTimeSeriesData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500">
                          No data available for the selected time period
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <ReLineChart
                            data={generateTimeSeriesData}
                            margin={{
                              top: 20,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="value"
                              name="Total Contracts"
                              stroke="#6366f1"
                              activeDot={{ r: 8 }}
                              strokeWidth={2}
                            />
                            <Line
                              type="monotone"
                              dataKey="active"
                              name="Active"
                              stroke="#10b981"
                              strokeWidth={2}
                            />
                            <Line
                              type="monotone"
                              dataKey="pending"
                              name="Pending"
                              stroke="#f59e0b"
                              strokeWidth={2}
                            />
                          </ReLineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="status" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Status Distribution</CardTitle>
                      <CardDescription>
                        Breakdown of contract statuses in period
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      <div className="grid grid-cols-1 md:grid-cols-2 h-full">
                        <div className="flex items-center justify-center">
                          {statusChartData.every(item => item.value === 0) ? (
                            <div className="text-center text-gray-500">
                              <PieChart className="mx-auto h-16 w-16 opacity-50" />
                              <p className="mt-2">No status data available</p>
                            </div>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <RePieChart>
                                <Pie
                                  data={statusChartData.filter(d => d.value > 0)}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  paddingAngle={5}
                                  dataKey="value"
                                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                  {statusChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value) => `${value} contracts`} />
                              </RePieChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                        <div className="flex flex-col justify-center">
                          <h3 className="text-lg font-medium mb-4">Status Breakdown</h3>
                          <div className="space-y-4">
                            {statusChartData.map((status, i) => (
                              status.value > 0 && (
                                <div key={i} className="flex items-center gap-2">
                                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
                                  <div className="flex-1">{status.name}</div>
                                  <div className="font-medium">{status.value}</div>
                                  <div className="text-gray-500 text-sm">
                                    {((status.value / filteredContracts.length) * 100).toFixed(1)}%
                                  </div>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Contracts</CardTitle>
                  <CardDescription>
                    Latest contract activity in selected period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contract #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Customer
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredContracts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                              No contracts found in the selected period
                            </td>
                          </tr>
                        ) : (
                          filteredContracts
                            .sort((a, b) => new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime())
                            .slice(0, 5)
                            .map((contract) => (
                              <tr key={contract.id}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {contract.contractNumber}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {`Customer #${contract.customerId || 'Unknown'}`}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {formatCurrency(contract.amount)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {getStatusIcon(contract.status)}
                                    <Badge 
                                      variant={
                                        contract.status === 'active' ? 'success' : 
                                        contract.status === 'pending' ? 'warning' : 
                                        contract.status === 'completed' ? 'default' : 'destructive'
                                      }
                                      className="ml-1"
                                    >
                                      {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                                    </Badge>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {format(contract.createdAt ? new Date(contract.createdAt) : new Date(), "MMM d, yyyy")}
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MerchantLayout>
  );
}
