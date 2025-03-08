
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatCurrency } from "@/lib/utils";

export default function PortfolioHealth() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/reports/portfolio-health"],
    queryFn: async () => {
      const response = await fetch("/api/admin/reports/portfolio-health");
      if (!response.ok) {
        throw new Error("Failed to fetch portfolio health");
      }
      return response.json();
    },
  });

  if (isLoading || !data?.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Health</CardTitle>
          <CardDescription>Loading portfolio metrics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const metrics = data.data;
  
  // Credit tier distribution data for pie chart
  const creditTierData = [
    { name: 'Tier 1', value: metrics.creditTierDistribution.tier1 },
    { name: 'Tier 2', value: metrics.creditTierDistribution.tier2 },
    { name: 'Tier 3', value: metrics.creditTierDistribution.tier3 },
    { name: 'Declined', value: metrics.creditTierDistribution.declined },
  ];
  
  const COLORS = ['#4ade80', '#facc15', '#fb923c', '#f87171'];

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Portfolio Health</CardTitle>
        <CardDescription>Performance metrics and risk assessment of your loan portfolio</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold">Total Portfolio Value</h3>
            <p className="text-2xl font-bold mt-2">
              {formatCurrency(metrics.totalFinancedAmount)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Across {metrics.totalContracts} contracts
            </p>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold">Active Contracts</h3>
            <p className="text-2xl font-bold mt-2">
              {metrics.activeContracts}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {((metrics.activeContracts / metrics.totalContracts) * 100).toFixed(1)}% of total
            </p>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold">Portfolio Risk Score</h3>
            <p className="text-2xl font-bold mt-2">
              {metrics.riskScore.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {metrics.riskScore < 1.5 ? 'Low risk' : metrics.riskScore < 2.5 ? 'Medium risk' : 'High risk'}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">Credit Tier Distribution</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={creditTierData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {creditTierData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} loans`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Key Portfolio Metrics</h3>
            <table className="w-full">
              <tbody>
                <tr className="border-b">
                  <td className="py-3 font-medium">Average Credit Score</td>
                  <td className="py-3 text-right">{Math.round(metrics.averageCreditScore)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-medium">Average DTI Ratio</td>
                  <td className="py-3 text-right">{(metrics.averageDTIRatio * 100).toFixed(1)}%</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-medium">Average Annual Income</td>
                  <td className="py-3 text-right">{formatCurrency(metrics.averageIncome)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-medium">Tier 1 Contracts</td>
                  <td className="py-3 text-right">{metrics.creditTierDistribution.tier1}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-medium">Tier 2 Contracts</td>
                  <td className="py-3 text-right">{metrics.creditTierDistribution.tier2}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-medium">Tier 3 Contracts</td>
                  <td className="py-3 text-right">{metrics.creditTierDistribution.tier3}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
