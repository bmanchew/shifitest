import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function ComplaintTrends() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["/api/admin/reports/complaint-trends"],
    queryFn: async () => {
      const response = await fetch('/api/admin/reports/complaint-trends');
      if (!response.ok) {
        throw new Error('Failed to fetch complaint trends');
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
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
                <LineChart data={data?.data?.monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
            <TabsContent value="category">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data?.data?.categoryTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
          {data?.data?.isMockData && (
            <div className="text-xs text-muted-foreground mt-2 text-center">
              Note: Displaying mock data for demonstration purposes
            </div>
          )}
        </div>
      )}
    </div>
  );
}