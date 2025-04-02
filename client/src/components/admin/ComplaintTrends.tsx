import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function ComplaintTrends() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: complaintData, isLoading, isError, error, refetch } = useQuery<any, Error>({
    queryKey: ["/api/admin/reports/complaint-trends"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/admin/reports/complaint-trends');
        if (!response.ok) {
          throw new Error(`Failed to fetch complaint trends: ${response.status} ${response.statusText}`);
        }
        
        // First parse as text to catch JSON parse errors
        const textData = await response.text();
        let responseData;
        
        try {
          responseData = JSON.parse(textData);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', textData.substring(0, 500));
          throw new Error(`Failed to parse response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
        
        if (!responseData.success) {
          throw new Error(responseData.message || 'Failed to fetch complaint trends');
        }
        
        return responseData;
      } catch (err) {
        console.error('CFPB data fetch error:', err);
        throw err; // Rethrow for React Query to handle
      }
    },
    refetchOnWindowFocus: false,
    retry: 1, // Only retry once before showing error
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.error('Error refreshing CFPB data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">CFPB Complaint Trends</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-opacity-50 rounded-full border-t-primary"></div>
        </div>
      ) : isError ? (
        <div className="bg-destructive/10 p-6 rounded-lg">
          <div className="flex flex-col items-center justify-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-4" />
            <p className="text-center text-muted-foreground">Failed to load CFPB complaint data. Please try again later.</p>
            <div className="text-sm text-destructive mt-2">
              {error instanceof Error ? error.message : 'Unknown error'}
            </div>
            <Button className="mt-4" onClick={() => refetch()}>Retry</Button>
          </div>
        </div>
      ) : (
        <div>
          <Tabs defaultValue="monthly">
            <TabsList className="mb-4">
              <TabsTrigger value="monthly">Monthly Trends</TabsTrigger>
              <TabsTrigger value="category">By Category</TabsTrigger>
            </TabsList>
            <TabsContent value="monthly">
              <ResponsiveContainer width="100%" height={300}>
                {complaintData?.data?.personalLoans?.monthlyTrend && complaintData.data.personalLoans.monthlyTrend.length > 0 ? (
                  <LineChart data={complaintData.data.personalLoans.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="complaints" name="Complaints" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 border rounded-md">
                    <p className="text-muted-foreground mb-2">No monthly trend data available</p>
                    <p className="text-xs text-muted-foreground">The CFPB API returned no complaints data for this period</p>
                  </div>
                )}
              </ResponsiveContainer>
            </TabsContent>
            <TabsContent value="category">
              <ResponsiveContainer width="100%" height={300}>
                {complaintData?.data?.personalLoans?.topIssues && complaintData.data.personalLoans.topIssues.length > 0 ? (
                  <BarChart data={complaintData.data.personalLoans.topIssues}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="issue" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Complaints" fill="#3b82f6" />
                  </BarChart>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 border rounded-md">
                    <p className="text-muted-foreground mb-2">No category data available</p>
                    <p className="text-xs text-muted-foreground">The CFPB API returned no complaints data for this period</p>
                  </div>
                )}
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
          {complaintData?.isMockData && (
            <div className="text-xs text-muted-foreground mt-2 text-center">
              Note: Displaying mock data for demonstration purposes
            </div>
          )}
        </div>
      )}
    </div>
  );
}