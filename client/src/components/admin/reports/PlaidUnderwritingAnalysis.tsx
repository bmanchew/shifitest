import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface PlaidUnderwritingAnalysisProps {
  merchantId: number;
  assetReportId?: string;
}

interface CashFlowMetrics {
  monthlyRevenue: number[];
  monthlyExpenses: number[];
  monthlyNetCashFlow: number[];
  averageMonthlyRevenue: number;
  averageMonthlyExpenses: number;
  averageMonthlyNetCashFlow: number;
  revenueGrowthRate: number;
  months: string[];
  revenueTrend: 'increasing' | 'stable' | 'decreasing';
  cashFlowTrend: 'increasing' | 'stable' | 'decreasing';
  liquidityRatio: number;
  volatilityScore: number;
}

interface DebtMetrics {
  totalDebtPayments: number;
  monthlyDebtPayments: number[];
  dscr: number;
  debtToRevenueRatio: number;
  numberOfLoans: number;
  loanStackingDetected: boolean;
  recentLoanActivity: boolean;
}

interface ChargebackMetrics {
  chargebackRate: number;
  totalChargebacks: number;
  chargebackAmount: number;
  refundRate: number;
  totalRefunds: number;
  refundAmount: number;
  monthlyRefundTrend: 'increasing' | 'stable' | 'decreasing';
}

interface ReserveMetrics {
  endingBalance: number;
  averageBalance: number;
  lowestBalance: number;
  overdraftCount: number;
  daysWithLowBalance: number;
  balanceTrend: 'increasing' | 'stable' | 'decreasing';
  liquidReservesRatio: number;
}

interface UnderwritingScore {
  overall: number;
  cashFlowScore: number;
  debtServiceScore: number;
  chargebackScore: number;
  reservesScore: number;
  recommendation: 'Approve' | 'Approve with Conditions' | 'Further Review' | 'Decline';
  maxRecommendedLoan: number;
  riskLevel: 'Low' | 'Moderate' | 'High';
  notes: string[];
}

interface UnderwritingAnalysis {
  merchantId: number;
  assetReportId: string;
  cashFlow: CashFlowMetrics;
  debt: DebtMetrics;
  chargebacks: ChargebackMetrics;
  reserves: ReserveMetrics;
  score: UnderwritingScore;
  updatedAt: string;
}

const PlaidUnderwritingAnalysis: React.FC<PlaidUnderwritingAnalysisProps> = ({ merchantId, assetReportId }) => {
  const [analysis, setAnalysis] = useState<UnderwritingAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const endpoint = assetReportId 
        ? `/api/admin/merchants/${merchantId}/underwriting-analysis/${assetReportId}`
        : `/api/admin/merchants/${merchantId}/latest-underwriting-analysis`;
      
      const response = await axios.get(endpoint);
      
      if (response.data.success) {
        setAnalysis(response.data.analysis);
      } else {
        setError(response.data.message || "Failed to fetch underwriting analysis");
      }
    } catch (err) {
      setError("Error fetching analysis: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [merchantId, assetReportId]);

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format percentage values
  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value);
  };

  // Get color classes based on score values
  const getScoreColorClass = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  // Get score label based on score values
  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Strong";
    if (score >= 60) return "Moderate";
    return "Weak";
  };

  const getTrendIcon = (trend: 'increasing' | 'stable' | 'decreasing', positiveIsGood: boolean = true) => {
    if (trend === 'increasing') {
      return positiveIsGood 
        ? <span className="text-green-600">↑</span> 
        : <span className="text-red-600">↑</span>;
    }
    if (trend === 'decreasing') {
      return positiveIsGood 
        ? <span className="text-red-600">↓</span> 
        : <span className="text-green-600">↓</span>;
    }
    return <span className="text-yellow-600">→</span>;
  };

  // Prepare cash flow chart data
  const prepareCashFlowData = (analysis: UnderwritingAnalysis) => {
    return analysis.cashFlow.months.map((month, index) => ({
      month,
      Revenue: analysis.cashFlow.monthlyRevenue[index],
      Expenses: analysis.cashFlow.monthlyExpenses[index],
      "Net Cash Flow": analysis.cashFlow.monthlyNetCashFlow[index]
    }));
  };

  // Show loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plaid Underwriting Analysis</CardTitle>
          <CardDescription>Financial health and risk assessment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[300px]" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[250px]" />
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plaid Underwriting Analysis</CardTitle>
          <CardDescription>Financial health and risk assessment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-red-500">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state
  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plaid Underwriting Analysis</CardTitle>
          <CardDescription>Financial health and risk assessment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p>No underwriting analysis available for this merchant</p>
            <p className="text-sm mt-2">Run an asset report analysis to generate underwriting metrics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render the full analysis
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plaid Underwriting Analysis</CardTitle>
        <CardDescription>
          Financial health assessment based on Plaid data - Last updated {format(new Date(analysis.updatedAt), "PPpp")}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start px-6 pt-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
            <TabsTrigger value="debt">Debt Service</TabsTrigger>
            <TabsTrigger value="chargebacks">Chargebacks & Refunds</TabsTrigger>
            <TabsTrigger value="reserves">Reserves</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="border-t mt-0 pt-0">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">
                    {analysis.score.recommendation}
                  </h3>
                  <p className={`text-lg font-medium ${getScoreColorClass(analysis.score.overall)}`}>
                    Overall Score: {analysis.score.overall}/100 - {getScoreLabel(analysis.score.overall)} Risk Profile
                  </p>
                  <p className="text-sm mt-1">
                    Recommended Max Funding: {formatCurrency(analysis.score.maxRecommendedLoan)}
                  </p>
                </div>
                <div className="flex-none w-32 h-32 relative">
                  <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                    <span className={getScoreColorClass(analysis.score.overall)}>
                      {analysis.score.overall}
                    </span>
                  </div>
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#eee"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={analysis.score.overall >= 80 ? "#16a34a" : analysis.score.overall >= 60 ? "#ca8a04" : "#dc2626"}
                      strokeWidth="3"
                      strokeDasharray={`${analysis.score.overall}, 100`}
                    />
                  </svg>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Cash Flow Health</h4>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Score: {analysis.score.cashFlowScore}/100</span>
                    <span className={`text-sm ${getScoreColorClass(analysis.score.cashFlowScore)}`}>
                      {getScoreLabel(analysis.score.cashFlowScore)}
                    </span>
                  </div>
                  <Progress value={analysis.score.cashFlowScore} className="h-2 mb-3" />
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Average Monthly Revenue:</span>
                      <span className="font-medium">{formatCurrency(analysis.cashFlow.averageMonthlyRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Average Net Cash Flow:</span>
                      <span className={`font-medium ${analysis.cashFlow.averageMonthlyNetCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(analysis.cashFlow.averageMonthlyNetCashFlow)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Revenue Trend:</span>
                      <span className="font-medium">
                        {getTrendIcon(analysis.cashFlow.revenueTrend)} {analysis.cashFlow.revenueTrend}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Debt Service Capacity</h4>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Score: {analysis.score.debtServiceScore}/100</span>
                    <span className={`text-sm ${getScoreColorClass(analysis.score.debtServiceScore)}`}>
                      {getScoreLabel(analysis.score.debtServiceScore)}
                    </span>
                  </div>
                  <Progress value={analysis.score.debtServiceScore} className="h-2 mb-3" />
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Debt Service Coverage:</span>
                      <span className={`font-medium ${analysis.debt.dscr >= 1.5 ? 'text-green-600' : analysis.debt.dscr >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {analysis.debt.dscr.toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Debt to Revenue Ratio:</span>
                      <span className={`font-medium ${analysis.debt.debtToRevenueRatio <= 0.2 ? 'text-green-600' : analysis.debt.debtToRevenueRatio <= 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {formatPercent(analysis.debt.debtToRevenueRatio)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Existing Loans:</span>
                      <span className="font-medium">
                        {analysis.debt.numberOfLoans} {analysis.debt.loanStackingDetected && <span className="text-red-600 ml-1">(Stacking Detected)</span>}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Chargebacks & Refunds</h4>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Score: {analysis.score.chargebackScore}/100</span>
                    <span className={`text-sm ${getScoreColorClass(analysis.score.chargebackScore)}`}>
                      {getScoreLabel(analysis.score.chargebackScore)}
                    </span>
                  </div>
                  <Progress value={analysis.score.chargebackScore} className="h-2 mb-3" />
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Chargeback Rate:</span>
                      <span className={`font-medium ${analysis.chargebacks.chargebackRate <= 0.01 ? 'text-green-600' : analysis.chargebacks.chargebackRate <= 0.02 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {formatPercent(analysis.chargebacks.chargebackRate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Refund Rate:</span>
                      <span className={`font-medium ${analysis.chargebacks.refundRate <= 0.05 ? 'text-green-600' : analysis.chargebacks.refundRate <= 0.1 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {formatPercent(analysis.chargebacks.refundRate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Refund Trend:</span>
                      <span className="font-medium">
                        {getTrendIcon(analysis.chargebacks.monthlyRefundTrend, false)} {analysis.chargebacks.monthlyRefundTrend}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Reserve Levels & Liquidity</h4>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Score: {analysis.score.reservesScore}/100</span>
                    <span className={`text-sm ${getScoreColorClass(analysis.score.reservesScore)}`}>
                      {getScoreLabel(analysis.score.reservesScore)}
                    </span>
                  </div>
                  <Progress value={analysis.score.reservesScore} className="h-2 mb-3" />
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Current Account Balance:</span>
                      <span className="font-medium">{formatCurrency(analysis.reserves.endingBalance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Liquid Reserves Ratio:</span>
                      <span className={`font-medium ${analysis.reserves.liquidReservesRatio >= 3 ? 'text-green-600' : analysis.reserves.liquidReservesRatio >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {analysis.reserves.liquidReservesRatio.toFixed(1)}x monthly expenses
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overdrafts (Last 90 Days):</span>
                      <span className={`font-medium ${analysis.reserves.overdraftCount === 0 ? 'text-green-600' : analysis.reserves.overdraftCount <= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {analysis.reserves.overdraftCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Underwriting Notes</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {analysis.score.notes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </TabsContent>
          
          {/* Cash Flow Tab */}
          <TabsContent value="cash-flow" className="border-t mt-0 pt-0">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Revenue</h4>
                  <div className="text-2xl font-semibold mb-1">
                    {formatCurrency(analysis.cashFlow.averageMonthlyRevenue)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Average Monthly Revenue
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Trend:</span>
                    <span className={`font-medium ${
                      analysis.cashFlow.revenueTrend === 'increasing' ? 'text-green-600' : 
                      analysis.cashFlow.revenueTrend === 'decreasing' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {getTrendIcon(analysis.cashFlow.revenueTrend)} {analysis.cashFlow.revenueTrend}
                    </span>
                  </div>
                  <div className="text-sm mt-1">
                    <span className="mr-1">Growth Rate:</span>
                    <span className={`font-medium ${analysis.cashFlow.revenueGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(analysis.cashFlow.revenueGrowthRate)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Net Cash Flow</h4>
                  <div className={`text-2xl font-semibold mb-1 ${analysis.cashFlow.averageMonthlyNetCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(analysis.cashFlow.averageMonthlyNetCashFlow)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Average Monthly Net Cash Flow
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Trend:</span>
                    <span className={`font-medium ${
                      analysis.cashFlow.cashFlowTrend === 'increasing' ? 'text-green-600' : 
                      analysis.cashFlow.cashFlowTrend === 'decreasing' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {getTrendIcon(analysis.cashFlow.cashFlowTrend)} {analysis.cashFlow.cashFlowTrend}
                    </span>
                  </div>
                  <div className="text-sm mt-1">
                    <span className="mr-1">Volatility:</span>
                    <span className={`font-medium ${analysis.cashFlow.volatilityScore <= 0.3 ? 'text-green-600' : analysis.cashFlow.volatilityScore <= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {analysis.cashFlow.volatilityScore <= 0.3 ? 'Low' : analysis.cashFlow.volatilityScore <= 0.6 ? 'Moderate' : 'High'}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Expenses</h4>
                  <div className="text-2xl font-semibold mb-1">
                    {formatCurrency(analysis.cashFlow.averageMonthlyExpenses)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Average Monthly Expenses
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Expense to Revenue Ratio:</span>
                    <span className={`font-medium ${
                      analysis.cashFlow.averageMonthlyExpenses / analysis.cashFlow.averageMonthlyRevenue <= 0.7 ? 'text-green-600' : 
                      analysis.cashFlow.averageMonthlyExpenses / analysis.cashFlow.averageMonthlyRevenue <= 0.9 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {formatPercent(analysis.cashFlow.averageMonthlyExpenses / analysis.cashFlow.averageMonthlyRevenue)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border mb-6">
                <h4 className="font-medium mb-4">Monthly Cash Flow Trends</h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={prepareCashFlowData(analysis)}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Legend />
                      <Line type="monotone" dataKey="Revenue" stroke="#16a34a" strokeWidth={2} />
                      <Line type="monotone" dataKey="Expenses" stroke="#dc2626" strokeWidth={2} />
                      <Line type="monotone" dataKey="Net Cash Flow" stroke="#2563eb" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Metrics Explanation</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><span className="font-medium">Revenue Trend:</span> {analysis.cashFlow.revenueTrend} revenue over the analysis period indicates {analysis.cashFlow.revenueTrend === 'increasing' ? 'business growth' : analysis.cashFlow.revenueTrend === 'stable' ? 'consistent business performance' : 'potential business challenges'}.</li>
                  <li><span className="font-medium">Net Cash Flow:</span> {analysis.cashFlow.averageMonthlyNetCashFlow >= 0 ? 'Positive' : 'Negative'} average monthly cash flow of {formatCurrency(Math.abs(analysis.cashFlow.averageMonthlyNetCashFlow))} indicates the business is {analysis.cashFlow.averageMonthlyNetCashFlow >= 0 ? 'profitable on a cash basis' : 'not generating enough revenue to cover expenses'}.</li>
                  <li><span className="font-medium">Cash Flow Volatility:</span> {analysis.cashFlow.volatilityScore <= 0.3 ? 'Low' : analysis.cashFlow.volatilityScore <= 0.6 ? 'Moderate' : 'High'} volatility suggests {analysis.cashFlow.volatilityScore <= 0.3 ? 'predictable business performance' : analysis.cashFlow.volatilityScore <= 0.6 ? 'some fluctuation in business results' : 'significant variability that might indicate higher risk'}.</li>
                  <li><span className="font-medium">Growth Rate:</span> {formatPercent(analysis.cashFlow.revenueGrowthRate)} growth rate over the analysis period.</li>
                </ul>
              </div>
            </div>
          </TabsContent>
          
          {/* Debt Service Tab */}
          <TabsContent value="debt" className="border-t mt-0 pt-0">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Debt Service Coverage</h4>
                  <div className={`text-2xl font-semibold mb-1 ${
                    analysis.debt.dscr >= 1.5 ? 'text-green-600' : 
                    analysis.debt.dscr >= 1 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {analysis.debt.dscr.toFixed(2)}x
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Debt Service Coverage Ratio
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Risk Assessment:</span>
                    <span className={`font-medium ${
                      analysis.debt.dscr >= 1.5 ? 'text-green-600' : 
                      analysis.debt.dscr >= 1 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {analysis.debt.dscr >= 1.5 ? 'Strong' : analysis.debt.dscr >= 1 ? 'Adequate' : 'Poor'}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Debt Service</h4>
                  <div className="text-2xl font-semibold mb-1">
                    {formatCurrency(analysis.debt.monthlyDebtPayments.reduce((a, b) => a + b, 0) / analysis.debt.monthlyDebtPayments.length)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Average Monthly Debt Payments
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Debt to Revenue:</span>
                    <span className={`font-medium ${
                      analysis.debt.debtToRevenueRatio <= 0.2 ? 'text-green-600' : 
                      analysis.debt.debtToRevenueRatio <= 0.4 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {formatPercent(analysis.debt.debtToRevenueRatio)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Existing Debt</h4>
                  <div className="text-2xl font-semibold mb-1">
                    {analysis.debt.numberOfLoans}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Active Loans/Advances
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Loan Stacking:</span>
                    <span className={`font-medium ${analysis.debt.loanStackingDetected ? 'text-red-600' : 'text-green-600'}`}>
                      {analysis.debt.loanStackingDetected ? 'Detected' : 'Not Detected'}
                    </span>
                  </div>
                  <div className="text-sm mt-1">
                    <span className="mr-1">Recent Activity:</span>
                    <span className={`font-medium ${analysis.debt.recentLoanActivity ? 'text-yellow-600' : 'text-green-600'}`}>
                      {analysis.debt.recentLoanActivity ? 'Recent Loan Activity' : 'No Recent Activity'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border mb-6">
                <h4 className="font-medium mb-4">Monthly Debt Payments</h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analysis.cashFlow.months.map((month, index) => ({
                        month,
                        "Debt Payments": analysis.debt.monthlyDebtPayments[index],
                        "Net Cash Flow": analysis.cashFlow.monthlyNetCashFlow[index]
                      }))}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Legend />
                      <Bar dataKey="Debt Payments" fill="#dc2626" />
                      <Bar dataKey="Net Cash Flow" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Debt Metrics Explanation</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><span className="font-medium">Debt Service Coverage Ratio (DSCR):</span> Measures ability to pay current debt obligations. {analysis.debt.dscr.toFixed(2)}x means the business generates {formatPercent(analysis.debt.dscr - 1)} {analysis.debt.dscr >= 1 ? 'more' : 'less'} cash than needed for debt payments.</li>
                  <li><span className="font-medium">Debt to Revenue Ratio:</span> {formatPercent(analysis.debt.debtToRevenueRatio)} of monthly revenue goes to debt service, which is {analysis.debt.debtToRevenueRatio <= 0.2 ? 'healthy' : analysis.debt.debtToRevenueRatio <= 0.4 ? 'moderate' : 'high'}.</li>
                  <li><span className="font-medium">Loan Stacking:</span> {analysis.debt.loanStackingDetected ? 'Multiple overlapping loans detected, which increases risk of default.' : 'No evidence of taking multiple loans simultaneously.'}</li>
                  <li><span className="font-medium">Recent Loan Activity:</span> {analysis.debt.recentLoanActivity ? 'Recent loan acquisition may indicate cash flow challenges or growth investment.' : 'No recent new borrowing detected.'}</li>
                </ul>
              </div>
            </div>
          </TabsContent>
          
          {/* Chargebacks Tab */}
          <TabsContent value="chargebacks" className="border-t mt-0 pt-0">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Chargeback Rate</h4>
                  <div className={`text-2xl font-semibold mb-1 ${
                    analysis.chargebacks.chargebackRate <= 0.01 ? 'text-green-600' : 
                    analysis.chargebacks.chargebackRate <= 0.02 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {formatPercent(analysis.chargebacks.chargebackRate)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Percentage of Revenue
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Total Chargebacks:</span>
                    <span className="font-medium">
                      {analysis.chargebacks.totalChargebacks}
                    </span>
                  </div>
                  <div className="text-sm mt-1">
                    <span className="mr-1">Total Amount:</span>
                    <span className="font-medium">
                      {formatCurrency(analysis.chargebacks.chargebackAmount)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Refund Rate</h4>
                  <div className={`text-2xl font-semibold mb-1 ${
                    analysis.chargebacks.refundRate <= 0.05 ? 'text-green-600' : 
                    analysis.chargebacks.refundRate <= 0.1 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {formatPercent(analysis.chargebacks.refundRate)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Percentage of Revenue
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Total Refunds:</span>
                    <span className="font-medium">
                      {analysis.chargebacks.totalRefunds}
                    </span>
                  </div>
                  <div className="text-sm mt-1">
                    <span className="mr-1">Total Amount:</span>
                    <span className="font-medium">
                      {formatCurrency(analysis.chargebacks.refundAmount)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Refund Trends</h4>
                  <div className="text-2xl font-semibold mb-1">
                    {getTrendIcon(analysis.chargebacks.monthlyRefundTrend, false)} {analysis.chargebacks.monthlyRefundTrend}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Month-over-Month Trend
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Risk Assessment:</span>
                    <span className={`font-medium ${
                      analysis.score.chargebackScore >= 80 ? 'text-green-600' : 
                      analysis.score.chargebackScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {analysis.score.chargebackScore >= 80 ? 'Low Risk' : analysis.score.chargebackScore >= 60 ? 'Moderate Risk' : 'High Risk'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Chargeback & Refund Analysis</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><span className="font-medium">Chargeback Rate:</span> {formatPercent(analysis.chargebacks.chargebackRate)} is {analysis.chargebacks.chargebackRate <= 0.01 ? 'below industry average for online education (good)' : analysis.chargebacks.chargebackRate <= 0.02 ? 'near industry average for online education' : 'above industry average for online education (concerning)'}.</li>
                  <li><span className="font-medium">Refund Rate:</span> {formatPercent(analysis.chargebacks.refundRate)} is {analysis.chargebacks.refundRate <= 0.05 ? 'below typical rates for online courses (excellent)' : analysis.chargebacks.refundRate <= 0.1 ? 'within normal range for online courses' : 'higher than typical for online courses (concerning)'}.</li>
                  <li><span className="font-medium">Trend Analysis:</span> Refund rates are {analysis.chargebacks.monthlyRefundTrend}, which {analysis.chargebacks.monthlyRefundTrend === 'increasing' ? 'may indicate product quality issues or misleading marketing' : analysis.chargebacks.monthlyRefundTrend === 'stable' ? 'suggests consistent customer satisfaction' : 'indicates improving customer satisfaction or product quality'}.</li>
                  <li><span className="font-medium">Impact Assessment:</span> {analysis.chargebacks.refundAmount + analysis.chargebacks.chargebackAmount > analysis.cashFlow.averageMonthlyNetCashFlow * 0.2 ? 'Refunds and chargebacks significantly impact net cash flow' : 'Refunds and chargebacks have minimal impact on overall cash flow'}.</li>
                </ul>
              </div>
            </div>
          </TabsContent>
          
          {/* Reserves Tab */}
          <TabsContent value="reserves" className="border-t mt-0 pt-0">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Account Balance</h4>
                  <div className="text-2xl font-semibold mb-1">
                    {formatCurrency(analysis.reserves.endingBalance)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Current Balance
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Average Balance:</span>
                    <span className="font-medium">
                      {formatCurrency(analysis.reserves.averageBalance)}
                    </span>
                  </div>
                  <div className="text-sm mt-1">
                    <span className="mr-1">Lowest Balance:</span>
                    <span className={`font-medium ${analysis.reserves.lowestBalance < 0 ? 'text-red-600' : ''}`}>
                      {formatCurrency(analysis.reserves.lowestBalance)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Liquidity</h4>
                  <div className={`text-2xl font-semibold mb-1 ${
                    analysis.reserves.liquidReservesRatio >= 3 ? 'text-green-600' : 
                    analysis.reserves.liquidReservesRatio >= 1 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {analysis.reserves.liquidReservesRatio.toFixed(1)}x
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Months of Expenses Covered
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Balance Trend:</span>
                    <span className={`font-medium ${
                      analysis.reserves.balanceTrend === 'increasing' ? 'text-green-600' : 
                      analysis.reserves.balanceTrend === 'stable' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {getTrendIcon(analysis.reserves.balanceTrend)} {analysis.reserves.balanceTrend}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Overdrafts & Liquidity Issues</h4>
                  <div className={`text-2xl font-semibold mb-1 ${
                    analysis.reserves.overdraftCount === 0 ? 'text-green-600' : 
                    analysis.reserves.overdraftCount <= 2 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {analysis.reserves.overdraftCount}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Overdrafts in Last 90 Days
                  </div>
                  <div className="text-sm mt-2">
                    <span className="mr-1">Days with Low Balance:</span>
                    <span className={`font-medium ${
                      analysis.reserves.daysWithLowBalance <= 5 ? 'text-green-600' : 
                      analysis.reserves.daysWithLowBalance <= 15 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {analysis.reserves.daysWithLowBalance} days
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Reserve Analysis</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><span className="font-medium">Liquidity Assessment:</span> The business maintains reserves equivalent to {analysis.reserves.liquidReservesRatio.toFixed(1)} months of expenses, which is {analysis.reserves.liquidReservesRatio >= 3 ? 'excellent' : analysis.reserves.liquidReservesRatio >= 1 ? 'adequate' : 'concerning'}.</li>
                  <li><span className="font-medium">Cash Cushion:</span> Current balance of {formatCurrency(analysis.reserves.endingBalance)} provides {analysis.reserves.endingBalance >= analysis.cashFlow.averageMonthlyExpenses ? 'sufficient' : 'insufficient'} cushion against unexpected expenses or revenue shortfalls.</li>
                  <li><span className="font-medium">Overdraft History:</span> {analysis.reserves.overdraftCount === 0 ? 'No overdrafts in the past 90 days indicates strong cash management.' : `${analysis.reserves.overdraftCount} overdrafts in the past 90 days ${analysis.reserves.overdraftCount <= 2 ? 'suggests occasional cash flow challenges' : 'indicates significant cash flow problems'}.`}</li>
                  <li><span className="font-medium">Balance Trend:</span> {analysis.reserves.balanceTrend === 'increasing' ? 'Increasing balance trend indicates improving financial health.' : analysis.reserves.balanceTrend === 'stable' ? 'Stable balance trend indicates consistent financial management.' : 'Decreasing balance trend may indicate deteriorating financial condition.'}</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PlaidUnderwritingAnalysis;