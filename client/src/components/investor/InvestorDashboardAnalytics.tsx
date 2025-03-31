import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  ArrowUp, 
  ArrowDown, 
  Loader2, 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Calendar, 
  Percent 
} from 'lucide-react';
import { useLocation } from 'wouter';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from '@/lib/queryClient';

// Mock data for portfolio performance
const portfolioPerformance = [
  { month: 'Jan', value: 10000 },
  { month: 'Feb', value: 10150 },
  { month: 'Mar', value: 10225 },
  { month: 'Apr', value: 10400 },
  { month: 'May', value: 10600 },
  { month: 'Jun', value: 10750 },
  { month: 'Jul', value: 10900 },
  { month: 'Aug', value: 11100 },
  { month: 'Sep', value: 11300 },
  { month: 'Oct', value: 11500 },
  { month: 'Nov', value: 11800 },
  { month: 'Dec', value: 12000 },
];

// Mock data for investment allocation
const investmentAllocation = [
  { name: 'Fixed Term (15%)', value: 60 },
  { name: 'Fixed Term (18%)', value: 40 },
];

// Colors for charts
const COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#f97316', '#8b5cf6'];

export default function InvestorDashboardAnalytics() {
  const [, setLocation] = useLocation();
  const [timeRange, setTimeRange] = useState('all');
  
  // Fetch investor profile
  const profileQuery = useQuery({
    queryKey: ['/api/investor/profile'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/investor/profile');
      return response.profile;
    },
  });
  
  // Fetch investments
  const investmentsQuery = useQuery({
    queryKey: ['/api/investor/investments'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/investor/investments');
      return response.investments;
    },
  });
  
  if (profileQuery.isLoading || investmentsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (profileQuery.isError || investmentsQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <h2 className="text-2xl font-bold text-destructive mb-4">Error Loading Dashboard</h2>
        <p className="text-muted-foreground mb-6">We couldn't load your dashboard data. Please try again.</p>
        <Button onClick={() => {
          profileQuery.refetch();
          investmentsQuery.refetch();
        }}>Retry</Button>
      </div>
    );
  }
  
  const profile = profileQuery.data;
  const investments = investmentsQuery.data;
  
  // Calculate total invested
  const totalInvested = investments.reduce((sum: number, investment: any) => sum + investment.amount, 0);
  
  // Calculate total expected returns
  const totalExpectedReturns = investments.reduce((sum: number, investment: any) => sum + (investment.expectedReturn || 0), 0);
  
  // Breakdown by investment type
  const investmentsByType = investments.reduce((acc: any, investment: any) => {
    const type = investment.offering.type;
    if (!acc[type]) {
      acc[type] = 0;
    }
    acc[type] += investment.amount;
    return acc;
  }, {});
  
  // Prepare data for the pie chart
  const allocationData = Object.keys(investmentsByType).map((type, index) => ({
    name: type === 'fixed_term_15_2yr' ? 'Fixed Term (15%)' : 'Fixed Term (18%)',
    value: investmentsByType[type],
  }));
  
  // Calculate upcoming payments (mock data for now)
  const upcomingPayments = [
    {
      id: 1,
      date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      amount: (totalInvested * 0.0125).toFixed(2), // 1.25% monthly return
      type: 'Interest Payment'
    },
    {
      id: 2,
      date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      amount: (totalInvested * 0.0125).toFixed(2),
      type: 'Interest Payment'
    }
  ];
  
  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Investor Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track your investments, returns, and portfolio performance
          </p>
        </div>
        
        <div className="flex items-center space-x-2 ml-auto">
          <Select
            value={timeRange}
            onValueChange={setTimeRange}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => setLocation('/investor/offerings')}>
            Invest More
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Invested</p>
                <p className="text-3xl font-bold">${totalInvested.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expected Returns</p>
                <p className="text-3xl font-bold">${totalExpectedReturns.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Investments</p>
                <p className="text-3xl font-bold">{investments.length}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-full">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Return</p>
                <p className="text-3xl font-bold">
                  {investments.length > 0 
                    ? (
                      investments.reduce((sum: number, inv: any) => 
                        sum + (inv.offering.interestRate || 0), 0) / investments.length
                      ).toFixed(1) 
                    : 0}%
                </p>
              </div>
              <div className="p-2 bg-yellow-100 rounded-full">
                <Percent className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Portfolio Performance</CardTitle>
            <CardDescription>
              Track the value of your investments over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={portfolioPerformance}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis 
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    domain={['dataMin - 1000', 'dataMax + 1000']}
                  />
                  <Tooltip 
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Value']}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Portfolio Value"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Investment Allocation</CardTitle>
            <CardDescription>
              Breakdown of your investment by type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex flex-col justify-center">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={allocationData.length > 0 ? allocationData : investmentAllocation}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {allocationData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Amount']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center mt-2">
                <div className="flex flex-wrap gap-4 justify-center">
                  {allocationData.map((entry: any, index: number) => (
                    <div key={`legend-${index}`} className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-1"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Your Investments</CardTitle>
            <CardDescription>
              Overview of your current investment portfolio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {investments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <DollarSign className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Investments Yet</h3>
                  <p className="text-muted-foreground text-sm max-w-md mb-6">
                    You haven't made any investments yet. Browse our offerings to start building your portfolio.
                  </p>
                  <Button onClick={() => setLocation('/investor/offerings')}>
                    Browse Investment Offerings
                  </Button>
                </div>
              ) : (
                investments.map((investment: any) => (
                  <div key={investment.id} className="border rounded-lg p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{investment.offering.name}</h3>
                          <Badge variant="outline">
                            {investment.offering.type === 'fixed_term_15_2yr' ? '15% APY' : '18% APY'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {investment.offering.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end">
                        <p className="font-medium">${investment.amount.toLocaleString()}</p>
                        <div className="flex items-center text-sm text-green-600">
                          <ArrowUp className="mr-1 h-3 w-3" />
                          <span>+${(investment.amount * (investment.offering.interestRate / 100)).toLocaleString()}/yr</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-3 text-sm">
                      <div className="flex items-center">
                        <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                        <span>Invested: {new Date(investment.investmentDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                        <span>Term: {investment.offering.termMonths} months</span>
                      </div>
                      <div className="flex items-center">
                        <Badge className="ml-auto" variant="secondary">{investment.status}</Badge>
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setLocation(`/investor/investments/${investment.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setLocation('/investor/offerings')}
            >
              View All Investment Opportunities
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Payments</CardTitle>
            <CardDescription>
              Schedule of your upcoming interest payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">No upcoming payments scheduled</p>
                </div>
              ) : (
                upcomingPayments.map((payment) => (
                  <div key={payment.id} className="border rounded-lg p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium">{payment.type}</h4>
                        <p className="text-sm text-muted-foreground">
                          {payment.date}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${payment.amount}</p>
                        <div className="flex items-center text-sm text-green-600 justify-end">
                          <ArrowUp className="mr-1 h-3 w-3" />
                          <span>Return</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="border-t pt-4 w-full">
              <div className="flex justify-between">
                <span className="font-medium">Annual Projected Income:</span>
                <span className="font-medium">${(totalInvested * 0.15).toFixed(2)}</span>
              </div>
              <div className="flex justify-between mt-1 text-sm text-muted-foreground">
                <span>Monthly Average:</span>
                <span>${(totalInvested * 0.15 / 12).toFixed(2)}</span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setLocation('/investor/payments')}
            >
              View Payment History
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}