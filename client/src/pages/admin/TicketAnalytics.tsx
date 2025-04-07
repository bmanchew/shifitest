import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  TicketCheck, 
  Clock, 
  BarChart3, 
  UsersRound, 
  Calendar 
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

// PIECHART COLORS
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28DFF', '#FF6B6B', '#4CAF50', '#9C27B0'];

const TicketAnalytics = () => {
  const [dateRange, setDateRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to last 30 days
    endDate: new Date(),
  });
  
  const [groupBy, setGroupBy] = useState<string>("day");
  
  const { data: ticketAnalytics, isLoading: isLoadingTickets } = useQuery({
    queryKey: [
      '/api/analytics/tickets', 
      { 
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        groupBy
      }
    ],
    queryFn: () => apiRequest.get(`/api/analytics/tickets?startDate=${dateRange.startDate.toISOString()}&endDate=${dateRange.endDate.toISOString()}&groupBy=${groupBy}`),
  });
  
  const { data: agentAnalytics, isLoading: isLoadingAgents } = useQuery({
    queryKey: [
      '/api/analytics/agents',
      {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString()
      }
    ],
    queryFn: () => apiRequest.get(`/api/analytics/agents?startDate=${dateRange.startDate.toISOString()}&endDate=${dateRange.endDate.toISOString()}`),
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

  const formatAgentPerformanceData = () => {
    if (!agentAnalytics?.data?.analytics?.agents) return [];
    return agentAnalytics.data.analytics.agents;
  };

  // Format functions for displaying readable values
  const formatTime = (hours: number | null) => {
    if (hours === null || hours === undefined) return 'N/A';
    
    const formatHours = Math.floor(hours);
    const formatMinutes = Math.floor((hours - formatHours) * 60);
    
    return `${formatHours}h ${formatMinutes}m`;
  };
  
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const updateDateRange = (startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate });
  };

  return (
    <div className="flex flex-col space-y-6 p-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Ticket Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Comprehensive analytics for support ticket performance and agent metrics
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
                  <SelectItem value="hour">Hour</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Tickets Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <TicketCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingTickets 
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
              {isLoadingTickets 
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
              {isLoadingTickets
                ? "Loading..."
                : formatTime(ticketAnalytics?.data?.analytics?.resolutionTimeAverage)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Time to ticket resolution
            </p>
          </CardContent>
        </Card>

        {/* Total Agents Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Support Agents</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingAgents
                ? "Loading..."
                : agentAnalytics?.data?.analytics?.totalAgents || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active support team members
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agent Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Tickets Over Time Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Tickets Volume Over Time</CardTitle>
              <CardDescription>
                Number of tickets created during the selected period
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {isLoadingTickets ? (
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
                  Distribution of tickets by current status
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {isLoadingTickets ? (
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
                  Distribution of tickets by category
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {isLoadingTickets ? (
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
                  Distribution of tickets by priority level
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {isLoadingTickets ? (
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
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          {/* Agent Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <CardDescription>
                Key performance metrics for support agents
              </CardDescription>
            </CardHeader>
            <CardContent className="h-96">
              {isLoadingAgents ? (
                <div className="flex h-full items-center justify-center">Loading agent performance data...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={formatAgentPerformanceData()}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ticketsAssigned" name="Tickets Assigned" fill="#0088FE" />
                    <Bar dataKey="ticketsResolved" name="Tickets Resolved" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Agent Response and Resolution Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Response Time</CardTitle>
                <CardDescription>
                  Average response time by agent (hours)
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {isLoadingAgents ? (
                  <div className="flex h-full items-center justify-center">Loading chart data...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={formatAgentPerformanceData()}
                      layout="vertical"
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" />
                      <Tooltip formatter={(value) => formatTime(value as number)} />
                      <Legend />
                      <Bar dataKey="averageResponseTime" name="Avg. Response Time" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agent Resolution Time</CardTitle>
                <CardDescription>
                  Average resolution time by agent (hours)
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {isLoadingAgents ? (
                  <div className="flex h-full items-center justify-center">Loading chart data...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={formatAgentPerformanceData()}
                      layout="vertical"
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" />
                      <Tooltip formatter={(value) => formatTime(value as number)} />
                      <Legend />
                      <Bar dataKey="averageResolutionTime" name="Avg. Resolution Time" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Agent SLA Compliance */}
          <Card>
            <CardHeader>
              <CardTitle>SLA Compliance</CardTitle>
              <CardDescription>
                Percentage of tickets that met SLA response time targets by agent
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {isLoadingAgents ? (
                <div className="flex h-full items-center justify-center">Loading chart data...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={formatAgentPerformanceData()}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => formatPercentage(value as number)} />
                    <Legend />
                    <Bar dataKey="slaCompliance" name="SLA Compliance %" fill="#FF8042" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TicketAnalytics;