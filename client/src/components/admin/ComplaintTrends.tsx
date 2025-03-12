import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function ComplaintTrends() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMockData = true; // Added to simulate mock data condition.  Replace with actual check.

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/admin/reports/complaint-trends"],
    queryFn: async () => {
      const response = await fetch("/api/admin/reports/complaint-trends");
      if (!response.ok) {
        throw new Error("Failed to fetch complaint trends");
      }
      return response.json();
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complaint Trends</CardTitle>
          <CardDescription>Loading CFPB complaint data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complaint Trends</CardTitle>
          <CardDescription>Error loading complaint data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6">
            <AlertCircle className="h-12 w-12 text-destructive mb-2" />
            <p className="text-center text-muted-foreground">Failed to load CFPB complaint data. Please try again later.</p>
            <div className="text-sm text-destructive mt-2">
              {error instanceof Error ? error.message : 'Unknown error'}
            </div>
            <Button className="mt-4" onClick={() => refetch()}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complaint Trends</CardTitle>
          <CardDescription>Loading CFPB complaint data...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          {/* <Loader2 className="h-8 w-8 animate-spin" /> */} {/*Removed Loader2 as it's not defined*/}
        </CardContent>
      </Card>
    );
  }

  const trends = data?.data;
  if (!trends) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complaint Trends</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6">
            <p className="text-center text-muted-foreground">No CFPB complaint data available.</p>
            <Button className="mt-4" onClick={() => refetch()}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const monthlyTrendData = trends.personalLoans?.monthlyTrend || [];
  const topIssuesData = trends.personalLoans?.topIssues || [];
  const topCompaniesData = trends.personalLoans?.topCompanies || [];
  const ccMonthlyTrendData = trends.creditCards?.monthlyTrend || [];

  const formatDate = (dateString) => {
    // Add date formatting logic here if needed
    return dateString;
  };


  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>CFPB Complaint Trends</CardTitle>
          <CardDescription>Consumer complaint data from the Consumer Financial Protection Bureau</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </>
          )}
        </Button>
      </CardHeader>
      {isMockData && <CardContent className="pt-0 pb-0"><MockDataBanner /></CardContent>}
      <CardContent>
        <Tabs defaultValue="monthly">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="monthly">Monthly Trends</TabsTrigger>
            <TabsTrigger value="issues">Top Issues</TabsTrigger>
            <TabsTrigger value="companies">Top Companies</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
          <TabsContent value="monthly" className="pt-4">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyTrendData}
                  margin={{
                    top: 5,
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
                  <Line type="monotone" dataKey="count" name="Personal Loans" stroke="#8884d8" activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="count" name="Credit Cards" stroke="#82ca9d" data={ccMonthlyTrendData} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          <TabsContent value="issues" className="pt-4">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topIssuesData}
                  layout="vertical"
                  margin={{
                    top: 5,
                    right: 30,
                    left: 100,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="issue" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" name="Complaint Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          <TabsContent value="companies" className="pt-4">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topCompaniesData}
                  layout="vertical"
                  margin={{
                    top: 5,
                    right: 30,
                    left: 100,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="company" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#82ca9d" name="Complaint Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          <TabsContent value="insights" className="pt-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Key Insights</h3>
              <ul className="list-disc pl-5 space-y-2">
                {trends.insights.map((insight, index) => (
                  <li key={index} className="text-sm">{insight}</li>
                ))}
              </ul>

              <h3 className="text-lg font-semibold mt-6">Recommended Underwriting Adjustments</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Factor</th>
                      <th className="text-left py-2">Current</th>
                      <th className="text-left py-2">Recommended</th>
                      <th className="text-left py-2">Reasoning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.recommendedUnderwritingAdjustments.map((rec, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 font-medium">{rec.factor}</td>
                        <td className="py-2">{rec.currentThreshold}</td>
                        <td className="py-2">{rec.recommendedThreshold}</td>
                        <td className="py-2 text-gray-500">{rec.reasoning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}