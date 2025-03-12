
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUp, ArrowDown, AlertTriangle, TrendingUp, DollarSign, Users, FileText, BarChart3 } from "lucide-react";
import StatCard from "@/components/admin/StatCard";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";

// Mock data - replace with actual API data
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AnalyticsDashboard() {
  // Fetch portfolio health metrics
  const { data: portfolioMetrics, isLoading: isLoadingPortfolio } = useQuery({
    queryKey: ["/api/admin/reports/portfolio-health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reports/portfolio-health", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch portfolio metrics");
      const jsonRes = await res.json();
      return jsonRes.data;
    },
  });

  // Fetch complaint trends
  const { data: complaintTrends, isLoading: isLoadingComplaints } = useQuery({
    queryKey: ["/api/admin/reports/complaint-trends"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reports/complaint-trends", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch complaint trends");
      const jsonRes = await res.json();
      return jsonRes.data;
    },
  });

  // Fetch underwriting recommendations
  const { data: underwritingRecs, isLoading: isLoadingRecs } = useQuery({
    queryKey: ["/api/admin/reports/underwriting-recommendations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reports/underwriting-recommendations", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch underwriting recommendations");
      const jsonRes = await res.json();
      return jsonRes.data;
    },
  });

  const isLoading = isLoadingPortfolio || isLoadingComplaints || isLoadingRecs;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Portfolio Performance</TabsTrigger>
          <TabsTrigger value="risks">Risk Analysis</TabsTrigger>
          <TabsTrigger value="complaints">Complaint Insights</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      <Skeleton className="h-4 w-[150px]" />
                    </CardTitle>
                    <Skeleton className="h-4 w-4 rounded-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-[120px]" />
                    <Skeleton className="h-4 w-[100px] mt-2" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <StatCard
                  title="Total Portfolio Value"
                  value={portfolioMetrics?.totalValue ? `$${(portfolioMetrics.totalValue / 1000000).toFixed(2)}M` : "$0"}
                  icon={<DollarSign />}
                  iconBgColor="bg-green-100"
                  iconColor="text-green-600"
                  change={portfolioMetrics?.valueChangePercent}
                  trend={portfolioMetrics?.valueChangePercent >= 0 ? "up" : "down"}
                />
                <StatCard
                  title="Default Rate"
                  value={portfolioMetrics?.defaultRate ? `${portfolioMetrics.defaultRate.toFixed(2)}%` : "0%"}
                  icon={<AlertTriangle />}
                  iconBgColor="bg-yellow-100"
                  iconColor="text-yellow-600"
                  change={portfolioMetrics?.defaultRateChange}
                  trend={portfolioMetrics?.defaultRateChange <= 0 ? "up" : "down"}
                />
                <StatCard
                  title="Active Contracts"
                  value={portfolioMetrics?.activeContractsCount || 0}
                  icon={<FileText />}
                  iconBgColor="bg-blue-100"
                  iconColor="text-blue-600"
                  change={portfolioMetrics?.activeContractsChange}
                  trend={portfolioMetrics?.activeContractsChange >= 0 ? "up" : "down"}
                />
                <StatCard
                  title="New Applicants"
                  value={portfolioMetrics?.newApplicantsCount || 0}
                  icon={<Users />}
                  iconBgColor="bg-purple-100"
                  iconColor="text-purple-600"
                  change={portfolioMetrics?.newApplicantsChange}
                  trend={portfolioMetrics?.newApplicantsChange >= 0 ? "up" : "down"}
                />
              </>
            )}
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Portfolio Growth Trend</CardTitle>
                <CardDescription>
                  Total value month-over-month
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full rounded-md" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={portfolioMetrics?.monthlyGrowth || []}
                      margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        name="Portfolio Value" 
                        stroke="#0088FE" 
                        activeDot={{ r: 8 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Contract Status</CardTitle>
                <CardDescription>
                  Distribution by status
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full rounded-md" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={portfolioMetrics?.contractStatusDistribution || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="status"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {(portfolioMetrics?.contractStatusDistribution || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Payment Performance</CardTitle>
                <CardDescription>
                  On-time vs late payments
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full rounded-md" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={portfolioMetrics?.paymentPerformance || []}
                      margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="ontime" name="On-time Payments" fill="#00C49F" />
                      <Bar dataKey="late" name="Late Payments" fill="#FF8042" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Interest Revenue</CardTitle>
                <CardDescription>
                  Monthly interest income
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full rounded-md" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={portfolioMetrics?.revenueHistory || []}
                      margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        name="Interest Revenue" 
                        stroke="#8884d8" 
                        activeDot={{ r: 8 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="risks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Factors Analysis</CardTitle>
              <CardDescription>
                Top factors contributing to default risk
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array(5).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {(underwritingRecs?.riskFactors || []).map((factor, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">{factor.name}</div>
                        <div className="text-xs text-muted-foreground">{factor.description}</div>
                      </div>
                      <Badge variant={factor.severity === 'high' ? 'destructive' : factor.severity === 'medium' ? 'warning' : 'outline'}>
                        {factor.severity} risk
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Recommended Underwriting Adjustments</CardTitle>
              <CardDescription>
                AI-powered recommendations to improve portfolio performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array(3).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {(underwritingRecs?.recommendations || []).map((rec, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{rec.title}</h4>
                        <Badge variant={rec.impact === 'high' ? 'default' : rec.impact === 'medium' ? 'secondary' : 'outline'}>
                          {rec.impact} impact
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <TrendingUp className="mr-1 h-3 w-3" /> 
                        Expected improvement: {rec.expectedImprovement}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="complaints" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Top Complaint Issues</CardTitle>
                <CardDescription>
                  Most common complaint categories
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full rounded-md" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={complaintTrends?.personalLoans?.topIssues || []}
                      margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="issue" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="Complaint Count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Monthly Complaint Trend</CardTitle>
                <CardDescription>
                  Complaint volume over time
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full rounded-md" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={complaintTrends?.personalLoans?.monthlyTrend || []}
                      margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        name="Complaint Count" 
                        stroke="#FF8042" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Key Insights from Complaints</CardTitle>
              <CardDescription>
                AI-generated insights from customer complaints
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array(3).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {(complaintTrends?.insights || []).map((insight, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
