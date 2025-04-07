import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Clock, TicketCheck, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

// PIECHART COLORS
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28DFF', '#FF6B6B', '#4CAF50', '#9C27B0'];

const MerchantTicketAnalytics = () => {
  const { user } = useAuth();
  const merchantId = user?.merchantId;
  
  const [dateRange, setDateRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to last 30 days
    endDate: new Date(),
  });
  
  const [groupBy, setGroupBy] = useState<string>("day");
  
  const { data: ticketAnalytics, isLoading } = useQuery({
    queryKey: [
      '/api/analytics/tickets', 
      { 
        merchantId,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        groupBy
      }
    ],
    queryFn: () => apiRequest.get(`/api/analytics/tickets?merchantId=${merchantId}&startDate=${dateRange.startDate.toISOString()}&endDate=${dateRange.endDate.toISOString()}&groupBy=${groupBy}`),
    enabled: !!merchantId,
  });

  // Format data for visualizations
  const formatStatusData = () => {
    if (!ticketAnalytics?.data?.analytics?.ticketsByStatus) return [];
    
    return Object.entries(ticketAnalytics.data.analytics.ticketsByStatus).map(([name, value], index) => ({
      name,
      value,
      color: COLORS[index % COLORS.length]
    }));
  };
  
  const formatCategoryData = () => {
    if (!ticketAnalytics?.data?.analytics?.ticketsByCategory) return [];
    
    return Object.entries(ticketAnalytics.data.analytics.ticketsByCategory).map(([name, value], index) => ({
      name,
      value,
      color: COLORS[index % COLORS.length]
    }));
  };
  
  const formatPriorityData = () => {
    if (!ticketAnalytics?.data?.analytics?.ticketsByPriority) return [];
    
    return Object.entries(ticketAnalytics.data.analytics.ticketsByPriority).map(([name, value], index) => ({
      name,
      value,
      color: COLORS[index % COLORS.length]
    }));
  };
  
  const formatTimeSeriesData = () => {
    if (!ticketAnalytics?.data?.analytics?.ticketsOverTime) return [];
    return ticketAnalytics.data.analytics.ticketsOverTime;
  };

  // Format functions for displaying readable values
  const formatTime = (hours: number | null) => {
    if (hours === null || hours === undefined) return 'N/A';
    
    const formatHours = Math.floor(hours);
    const formatMinutes = Math.floor((hours - formatHours) * 60);
    
    return `${formatHours}h ${formatMinutes}m`;
  };

  const updateDateRange = (startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate });
  };

  return (
    <div className="flex flex-col space-y-6 p-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Your Support Ticket Analytics</h1>
        <p className="text-muted-foreground">
          Analytics and insights for your support tickets and interactions
        </p>
      </div>

      {/* Filter controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex flex-col space-y-1 flex-1">
              <span className="text-sm text-muted-foreground">Start Date</span>
              <DatePicker 
                date={dateRange.startDate} 
                setDate={(date) => updateDateRange(date || new Date(), dateRange.endDate)} 
              />
            </div>
            <div className="flex flex-col space-y-1 flex-1">
              <span className="text-sm text-muted-foreground">End Date</span>
              <DatePicker 
                date={dateRange.endDate} 
                setDate={(date) => updateDateRange(dateRange.startDate, date || new Date())} 
              />
            </div>
            <div className="flex flex-col space-y-1 flex-1">
              <span className="text-sm text-muted-foreground">Group By</span>
              <Select
                value={groupBy}
                onValueChange={setGroupBy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Group by time period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Tickets Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Your Tickets</CardTitle>
            <TicketCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading 
                ? "Loading..." 
                : ticketAnalytics?.data?.analytics?.totalTickets || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              In selected date range
            </p>
          </CardContent>
        </Card>

        {/* Average Response Time Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading 
                ? "Loading..." 
                : formatTime(ticketAnalytics?.data?.analytics?.responseTimeAverage)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Time to first response
            </p>
          </CardContent>
        </Card>

        {/* Average Resolution Time Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Resolution Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading
                ? "Loading..."
                : formatTime(ticketAnalytics?.data?.analytics?.resolutionTimeAverage)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Time to ticket resolution
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tickets Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Your Ticket Volume Over Time</CardTitle>
          <CardDescription>
            Number of tickets submitted during the selected period
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">Loading chart data...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formatTimeSeriesData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  name="Tickets" 
                  stroke="#0088FE" 
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tickets by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Status</CardTitle>
            <CardDescription>
              Distribution of your tickets by current status
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">Loading chart data...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={formatStatusData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {formatStatusData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tickets by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Category</CardTitle>
            <CardDescription>
              Distribution of your tickets by category
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">Loading chart data...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={formatCategoryData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {formatCategoryData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tickets by Priority */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Priority</CardTitle>
            <CardDescription>
              Distribution of your tickets by priority level
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">Loading chart data...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={formatPriorityData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {formatPriorityData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MerchantTicketAnalytics;