import { useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { Contract } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { format, subDays, subMonths } from "date-fns";
import { Printer, Download, Calendar, BarChart, PieChart, LineChart } from "lucide-react";

export default function Reports() {
  const { user } = useAuth();
  const merchantId = user?.merchantId || 1;
  const [timeRange, setTimeRange] = useState("30d");

  const { data: contracts = [] } = useQuery<Contract[]>({
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

  const filteredContracts = contracts.filter(contract => 
    new Date(contract.createdAt) >= getDateRangeStart()
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Calculate statistics
  const totalAmount = filteredContracts.reduce((sum, contract) => sum + contract.amount, 0);
  const totalFinanced = filteredContracts.reduce((sum, contract) => sum + contract.financedAmount, 0);
  const totalDownPayment = filteredContracts.reduce((sum, contract) => sum + contract.downPayment, 0);
  
  const activeContracts = filteredContracts.filter(c => c.status === "active").length;
  const pendingContracts = filteredContracts.filter(c => c.status === "pending").length;
  const completedContracts = filteredContracts.filter(c => c.status === "completed").length;
  const declinedContracts = filteredContracts.filter(c => c.status === "declined").length;

  return (
    <MerchantLayout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
              <p className="mt-1 text-sm text-gray-600">
                View financial reports and analytics
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
                Export
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Contract Value</CardDescription>
                <CardTitle className="text-2xl">{formatCurrency(totalAmount)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-500">
                  {filteredContracts.length} contracts in period
                </div>
              </CardContent>
            </Card>
            
            <Card>
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
            
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Down Payments</CardDescription>
                <CardTitle className="text-2xl">{formatCurrency(totalDownPayment)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-500">
                  15% of total contract value
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Contract Status</CardDescription>
                <CardTitle className="text-2xl">{filteredContracts.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 text-xs">
                  <Badge variant="success">{activeContracts} Active</Badge>
                  <Badge variant="warning">{pendingContracts} Pending</Badge>
                  <Badge variant="info">{completedContracts} Completed</Badge>
                  <Badge variant="danger">{declinedContracts} Declined</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview" className="flex items-center">
                <BarChart className="mr-2 h-4 w-4" />
                Overview
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
                  <CardTitle>Financial Overview</CardTitle>
                  <CardDescription>
                    Summary of financial metrics over time
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <BarChart className="mx-auto h-16 w-16 opacity-50" />
                    <p className="mt-2">Chart visualization would be displayed here</p>
                    <p className="text-sm">
                      Showing data from {format(getDateRangeStart(), "MMM d, yyyy")} to {format(new Date(), "MMM d, yyyy")}
                    </p>
                  </div>
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
                <CardContent className="h-80 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <LineChart className="mx-auto h-16 w-16 opacity-50" />
                    <p className="mt-2">Contract trend chart would be displayed here</p>
                    <p className="text-sm">
                      Showing data from {format(getDateRangeStart(), "MMM d, yyyy")} to {format(new Date(), "MMM d, yyyy")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="status" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>
                    Breakdown of contract statuses
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <PieChart className="mx-auto h-16 w-16 opacity-50" />
                    <p className="mt-2">Status distribution chart would be displayed here</p>
                    <p className="text-sm">
                      Showing data from {format(getDateRangeStart(), "MMM d, yyyy")} to {format(new Date(), "MMM d, yyyy")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MerchantLayout>
  );
}
