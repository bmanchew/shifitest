import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserRound, BarChart4, TrendingUp, AlertCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface SalesRep {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  status: string;
  region: string;
  createdAt: string;
  totalSales?: number;
  contractCount?: number;
}

interface SalesAnalytics {
  salesByRep: {
    name: string;
    value: number;
  }[];
  contractsByStatus: {
    name: string;
    value: number;
  }[];
  monthlyPerformance: {
    month: string;
    contracts: number;
    amount: number;
  }[];
  topSalesReps: SalesRep[];
}

// Sample colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function SalesRepAnalytics() {
  const { user } = useAuth();
  const merchantId = user?.merchantId;
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);

  // Fetch sales rep analytics data
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/merchant/sales-analytics"],
    queryFn: async () => {
      try {
        // In a real implementation, we would fetch from the API
        // For now, we'll generate some sample data based on the current date
        // to ensure consistency
        
        // In production, replace with:
        // const res = await fetch('/api/merchant/sales-analytics');
        // return res.json();
        
        // Generate deterministic sample data based on date
        const date = new Date();
        const dayOfMonth = date.getDate();
        const monthIndex = date.getMonth();
        
        // Sample sales reps with seed-based values
        const salesReps = [
          { 
            id: 101, 
            userId: 201, 
            name: "Alice Johnson", 
            email: "alice@example.com", 
            phone: "555-1234", 
            status: "active", 
            region: "West", 
            createdAt: "2023-01-15",
            totalSales: 125000 + (dayOfMonth * 1000),
            contractCount: 12 + (dayOfMonth % 5)
          },
          { 
            id: 102, 
            userId: 202, 
            name: "Bob Smith", 
            email: "bob@example.com", 
            phone: "555-5678", 
            status: "active", 
            region: "East",
            createdAt: "2023-02-20",
            totalSales: 98000 + (dayOfMonth * 800),
            contractCount: 9 + (dayOfMonth % 4)
          },
          { 
            id: 103, 
            userId: 203, 
            name: "Carol Davis", 
            email: "carol@example.com", 
            phone: "555-9012", 
            status: "active", 
            region: "Central",
            createdAt: "2023-03-10",
            totalSales: 150000 + (dayOfMonth * 1200),
            contractCount: 15 + (dayOfMonth % 6)
          },
          { 
            id: 104, 
            userId: 204, 
            name: "David Wilson", 
            email: "david@example.com", 
            phone: "555-3456", 
            status: "inactive", 
            region: "South",
            createdAt: "2023-04-05",
            totalSales: 75000 + (dayOfMonth * 600),
            contractCount: 7 + (dayOfMonth % 3)
          }
        ];
        
        // Sort sales reps by total sales
        const sortedSalesReps = [...salesReps].sort((a, b) => 
          (b.totalSales || 0) - (a.totalSales || 0)
        );
        
        // Create analytics object
        const analyticsData: SalesAnalytics = {
          salesByRep: salesReps.map(rep => ({
            name: rep.name,
            value: rep.totalSales || 0
          })),
          contractsByStatus: [
            { name: "Approved", value: 15 + (monthIndex * 2) + (dayOfMonth % 5) },
            { name: "Pending", value: 8 + (monthIndex) + (dayOfMonth % 3) },
            { name: "Rejected", value: 3 + (dayOfMonth % 2) },
            { name: "Expired", value: 2 + (monthIndex % 2) }
          ],
          monthlyPerformance: [
            { month: "Jan", contracts: 8 + (monthIndex % 3), amount: 95000 + (dayOfMonth * 500) },
            { month: "Feb", contracts: 10 + (monthIndex % 4), amount: 110000 + (dayOfMonth * 600) },
            { month: "Mar", contracts: 12 + (monthIndex % 5), amount: 135000 + (dayOfMonth * 700) },
            { month: "Apr", contracts: 9 + (monthIndex % 3), amount: 105000 + (dayOfMonth * 550) },
            { month: "May", contracts: 11 + (monthIndex % 4), amount: 125000 + (dayOfMonth * 650) },
            { month: "Jun", contracts: 14 + (monthIndex % 6), amount: 155000 + (dayOfMonth * 800) }
          ],
          topSalesReps: sortedSalesReps.slice(0, 3)
        };
        
        return analyticsData;
      } catch (error) {
        console.error("Error fetching sales analytics:", error);
        throw error;
      }
    },
    enabled: !!merchantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (data) {
      setAnalytics(data);
    }
  }, [data]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-1/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-1/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">
            There was a problem loading the sales rep analytics. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Sales Representatives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <UserRound className="mr-2 h-5 w-5" /> 
            Top Sales Representatives
          </CardTitle>
          <CardDescription>
            Performance metrics for your top-performing sales representatives
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analytics?.topSalesReps.map((rep, index) => (
              <Card key={rep.id} className={`border-l-4 ${index === 0 ? 'border-l-yellow-400' : index === 1 ? 'border-l-gray-400' : 'border-l-amber-600'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : '🥉 '}
                    {rep.name}
                  </CardTitle>
                  <CardDescription>{rep.region} Region</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Sales</p>
                      <p className="text-lg font-bold">{formatCurrency(rep.totalSales || 0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contracts</p>
                      <p className="text-lg font-bold text-center">{rep.contractCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sales by Representative */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart4 className="mr-2 h-5 w-5" /> 
              Sales by Representative
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics?.salesByRep}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis 
                    tickFormatter={(value) => 
                      new Intl.NumberFormat('en-US', {
                        notation: 'compact',
                        compactDisplay: 'short',
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0
                      }).format(value)
                    } 
                  />
                  <Tooltip 
                    formatter={(value) => [formatCurrency(value as number), "Sales"]} 
                  />
                  <Bar dataKey="value" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Contract Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" /> 
              Contract Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.contractsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics?.contractsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} contracts`, "Count"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Performance Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-5 w-5" /> 
            Monthly Performance Trends
          </CardTitle>
          <CardDescription>
            Contract counts and financing amounts over the last 6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics?.monthlyPerformance}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" 
                  tickFormatter={(value) => `${value}`} />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" 
                  tickFormatter={(value) => 
                    new Intl.NumberFormat('en-US', {
                      notation: 'compact',
                      compactDisplay: 'short',
                      style: 'currency',
                      currency: 'USD'
                    }).format(value)
                  } 
                />
                <Tooltip 
                  formatter={(value, name) => [
                    name === "contracts" 
                      ? `${value} contracts` 
                      : formatCurrency(value as number),
                    name === "contracts" ? "Contracts" : "Amount"
                  ]} 
                />
                <Legend />
                <Bar yAxisId="left" dataKey="contracts" fill="#8884d8" name="Contracts" />
                <Bar yAxisId="right" dataKey="amount" fill="#82ca9d" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground mt-2">
        <p>Note: This data is currently generated for demonstration purposes. Connect to your actual sales data through the API for real analytics.</p>
      </div>
    </div>
  );
}