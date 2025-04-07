import { db } from "../db";
import { assetReports } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../services/logger";
import { IStorage } from "../storage";

// Plaid typically provides amounts in cents, so we need to convert to dollars
const centsToDollars = (cents: number): number => cents / 100;

interface Transaction {
  date: string;
  amount: number;
  name: string;
  category: string[];
  pending: boolean;
  transaction_id: string;
  payment_channel: string;
  transaction_type: string;
  merchant_name?: string;
}

interface Account {
  account_id: string;
  balances: {
    available: number | null;
    current: number;
    limit: number | null;
    iso_currency_code: string;
  };
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  historical_balances: Array<{
    date: string;
    current: number;
  }>
}

interface Item {
  institution_name: string;
  institution_id: string;
  accounts: Account[]
}

interface PlaidAssetReportData {
  report: {
    asset_report_id: string;
    client_report_id: string | null;
    date_generated: string;
    days_requested: number;
    items: Item[];
    transactions?: Transaction[];  // Added transactions field which may be in the response
  }
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

export interface UnderwritingAnalysis {
  merchantId: number;
  assetReportId: string;
  cashFlow: CashFlowMetrics;
  debt: DebtMetrics;
  chargebacks: ChargebackMetrics;
  reserves: ReserveMetrics;
  score: UnderwritingScore;
  updatedAt: string;
}

// Keywords that likely indicate payment processor transactions (for revenue identification)
const PAYMENT_PROCESSOR_KEYWORDS = [
  'stripe', 'paypal', 'square', 'shopify', 'wix payments', 'teachable', 
  'thinkific', 'gumroad', 'podia', 'kajabi', 'clickfunnels', 'convertkit', 
  'deposit', 'payment', 'transfer from', 'direct deposit', 'ach credit'
];

// Keywords that might indicate a loan or advance transaction
const LOAN_KEYWORDS = [
  'loan', 'capital', 'funding', 'advance', 'kabbage', 'ondeck', 'fundbox', 
  'bluevine', 'square capital', 'paypal working capital', 'lendio', 'clearbanc', 
  'fundation', 'fundThrough', 'lending', 'loan disbursement', 'loan deposit'
];

// Keywords that might indicate debt payments
const DEBT_PAYMENT_KEYWORDS = [
  'loan payment', 'kabbage payment', 'ondeck payment', 'paypal wc payment',
  'square capital payment', 'loan repayment', 'principal payment', 'interest payment',
  'financing payment', 'capital payment'
];

// Keywords that might indicate refunds
const REFUND_KEYWORDS = [
  'refund', 'chargeback', 'return', 'reimbursement', 'money back', 'reversal'
];

// Categories that typically indicate business expenses for educational merchants
const EXPENSE_CATEGORIES = [
  'marketing', 'advertising', 'software', 'web hosting', 'domain', 'office supplies',
  'payroll', 'rent', 'utilities', 'insurance', 'tax', 'legal', 'accounting',
  'subscription', 'travel', 'meals', 'entertainment', 'education', 'conference',
  'webinar', 'course', 'books', 'professional development'
];

export class PlaidUnderwritingService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Generate underwriting analysis from a Plaid asset report
   */
  async generateUnderwritingAnalysis(merchantId: number, assetReportId: string, assetReportData: PlaidAssetReportData): Promise<UnderwritingAnalysis> {
    try {
      logger.info(`Generating underwriting analysis for merchant ${merchantId}, asset report ${assetReportId}`);
      
      // Extract transactions from the asset report or get them from a separate endpoint if needed
      const transactions = assetReportData.report.transactions || await this.getTransactionsForAssetReport(assetReportId);
      
      // Get accounts data from the report
      const accounts = assetReportData.report.items.flatMap(item => item.accounts);
      
      // Calculate metrics
      const cashFlow = this.analyzeCashFlow(transactions, accounts);
      const debt = this.analyzeDebtService(transactions, cashFlow);
      const chargebacks = this.analyzeChargebacks(transactions, cashFlow);
      const reserves = this.analyzeReserves(accounts, cashFlow);
      
      // Calculate the overall underwriting score
      const score = this.calculateUnderwritingScore(cashFlow, debt, chargebacks, reserves);
      
      const analysis: UnderwritingAnalysis = {
        merchantId,
        assetReportId,
        cashFlow,
        debt,
        chargebacks,
        reserves,
        score,
        updatedAt: new Date().toISOString()
      };
      
      // Store analysis in the database if needed
      await this.saveUnderwritingAnalysis(analysis);
      
      return analysis;
    } catch (error) {
      logger.error(`Error generating underwriting analysis: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get transaction data for an asset report (if not already included in the asset report)
   */
  private async getTransactionsForAssetReport(assetReportId: string): Promise<Transaction[]> {
    // In a real implementation, this might call a Plaid endpoint or get data from your database
    // For now, we'll just return an empty array
    return [];
  }

  /**
   * Analyze cash flow from transaction data
   */
  private analyzeCashFlow(transactions: Transaction[], accounts: Account[]): CashFlowMetrics {
    // Group transactions by month
    const transactionsByMonth = this.groupTransactionsByMonth(transactions);
    const months = this.getSortedMonths(transactionsByMonth);
    
    // Calculate monthly revenue and expenses
    const monthlyMetrics = months.map(month => {
      const monthTransactions = transactionsByMonth[month] || [];
      
      // Filter for revenue transactions (credits that match payment processor patterns)
      const revenueTransactions = monthTransactions.filter(
        tx => tx.amount < 0 && this.isLikelyRevenue(tx)
      );
      
      // Filter for expense transactions (debits that are not debt payments and match expense categories)
      const expenseTransactions = monthTransactions.filter(
        tx => tx.amount > 0 && !this.isLikelyDebtPayment(tx) && this.isLikelyExpense(tx)
      );
      
      // Calculate monthly totals (convert to positive for revenue, keep positive for expenses)
      const monthlyRevenue = revenueTransactions.reduce((sum, tx) => sum + Math.abs(centsToDollars(tx.amount)), 0);
      const monthlyExpenses = expenseTransactions.reduce((sum, tx) => sum + centsToDollars(tx.amount), 0);
      const monthlyNetCashFlow = monthlyRevenue - monthlyExpenses;
      
      return { monthlyRevenue, monthlyExpenses, monthlyNetCashFlow };
    });
    
    // Extract metrics into arrays
    const monthlyRevenue = monthlyMetrics.map(m => m.monthlyRevenue);
    const monthlyExpenses = monthlyMetrics.map(m => m.monthlyExpenses);
    const monthlyNetCashFlow = monthlyMetrics.map(m => m.monthlyNetCashFlow);
    
    // Calculate average metrics
    const averageMonthlyRevenue = this.calculateAverage(monthlyRevenue);
    const averageMonthlyExpenses = this.calculateAverage(monthlyExpenses);
    const averageMonthlyNetCashFlow = this.calculateAverage(monthlyNetCashFlow);
    
    // Determine trends
    const revenueTrend = this.determineTrend(monthlyRevenue);
    const cashFlowTrend = this.determineTrend(monthlyNetCashFlow);
    
    // Calculate growth rate (simplified version)
    const revenueGrowthRate = this.calculateGrowthRate(monthlyRevenue);
    
    // Calculate volatility score (standard deviation of net cash flow relative to average)
    const volatilityScore = this.calculateVolatility(monthlyNetCashFlow);
    
    // Calculate liquidity ratio (current cash balance / monthly expenses)
    const totalAvailableBalance = accounts.reduce((sum, account) => {
      return sum + (account.balances.available !== null ? centsToDollars(account.balances.available) : 0);
    }, 0);
    
    const liquidityRatio = averageMonthlyExpenses > 0 ? totalAvailableBalance / averageMonthlyExpenses : 0;
    
    return {
      monthlyRevenue,
      monthlyExpenses,
      monthlyNetCashFlow,
      averageMonthlyRevenue,
      averageMonthlyExpenses,
      averageMonthlyNetCashFlow,
      revenueGrowthRate,
      months,
      revenueTrend,
      cashFlowTrend,
      liquidityRatio,
      volatilityScore
    };
  }

  /**
   * Analyze debt service from transaction data
   */
  private analyzeDebtService(transactions: Transaction[], cashFlow: CashFlowMetrics): DebtMetrics {
    // Identify likely debt payments
    const debtPayments = transactions.filter(tx => this.isLikelyDebtPayment(tx));
    
    // Identify likely loan receipts
    const loanReceipts = transactions.filter(tx => this.isLikelyLoanReceipt(tx));
    
    // Group debt payments by month
    const debtPaymentsByMonth = this.groupTransactionsByMonth(debtPayments);
    
    // Calculate monthly debt payments
    const monthlyDebtPayments = cashFlow.months.map(month => {
      const monthDebtPayments = debtPaymentsByMonth[month] || [];
      return monthDebtPayments.reduce((sum, tx) => sum + centsToDollars(tx.amount), 0);
    });
    
    // Calculate total debt payments
    const totalDebtPayments = monthlyDebtPayments.reduce((sum, amount) => sum + amount, 0);
    
    // Calculate DSCR (Debt Service Coverage Ratio)
    const monthlyDebtService = this.calculateAverage(monthlyDebtPayments);
    const dscr = monthlyDebtService > 0 ? 
      cashFlow.averageMonthlyNetCashFlow / monthlyDebtService : 
      cashFlow.averageMonthlyNetCashFlow > 0 ? 10 : 0; // If no debt payments, DSCR is excellent if cash flow is positive
    
    // Calculate debt to revenue ratio
    const debtToRevenueRatio = cashFlow.averageMonthlyRevenue > 0 ? 
      monthlyDebtService / cashFlow.averageMonthlyRevenue : 0;
    
    // Detect loan stacking by analyzing unique lenders from debt payments
    const uniqueLenders = new Set(
      debtPayments.map(tx => this.extractLenderName(tx)).filter(Boolean)
    );
    const numberOfLoans = uniqueLenders.size;
    const loanStackingDetected = numberOfLoans >= 3;
    
    // Check for recent loan activity (in the last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentLoanActivity = loanReceipts.some(tx => 
      new Date(tx.date) > ninetyDaysAgo
    );
    
    return {
      totalDebtPayments,
      monthlyDebtPayments,
      dscr,
      debtToRevenueRatio,
      numberOfLoans,
      loanStackingDetected,
      recentLoanActivity
    };
  }

  /**
   * Analyze chargebacks and refunds from transaction data
   */
  private analyzeChargebacks(transactions: Transaction[], cashFlow: CashFlowMetrics): ChargebackMetrics {
    // Identify likely chargebacks and refunds
    const chargebacks = transactions.filter(tx => 
      tx.amount > 0 && this.containsKeyword(tx.name.toLowerCase(), ['chargeback'])
    );
    
    const refunds = transactions.filter(tx => 
      tx.amount > 0 && this.isLikelyRefund(tx) && !this.containsKeyword(tx.name.toLowerCase(), ['chargeback'])
    );
    
    // Calculate total amounts
    const totalChargebacks = chargebacks.length;
    const chargebackAmount = chargebacks.reduce((sum, tx) => sum + centsToDollars(tx.amount), 0);
    
    const totalRefunds = refunds.length;
    const refundAmount = refunds.reduce((sum, tx) => sum + centsToDollars(tx.amount), 0);
    
    // Calculate rates
    const totalRevenue = cashFlow.monthlyRevenue.reduce((sum, rev) => sum + rev, 0);
    const chargebackRate = totalRevenue > 0 ? chargebackAmount / totalRevenue : 0;
    const refundRate = totalRevenue > 0 ? refundAmount / totalRevenue : 0;
    
    // Analyze refund trends by month
    const refundsByMonth = this.groupTransactionsByMonth(refunds);
    const monthlyRefundAmounts = cashFlow.months.map(month => {
      const monthRefunds = refundsByMonth[month] || [];
      return monthRefunds.reduce((sum, tx) => sum + centsToDollars(tx.amount), 0);
    });
    
    const monthlyRefundTrend = this.determineTrend(monthlyRefundAmounts);
    
    return {
      chargebackRate,
      totalChargebacks,
      chargebackAmount,
      refundRate,
      totalRefunds,
      refundAmount,
      monthlyRefundTrend
    };
  }

  /**
   * Analyze reserve levels and liquidity from account data
   */
  private analyzeReserves(accounts: Account[], cashFlow: CashFlowMetrics): ReserveMetrics {
    // Calculate current balances
    const checkingAccounts = accounts.filter(
      account => account.type === 'depository' && 
      (account.subtype === 'checking' || account.subtype === 'business')
    );
    
    // Calculate ending balance across all checking accounts
    const endingBalance = checkingAccounts.reduce((sum, account) => 
      sum + centsToDollars(account.balances.current), 0
    );
    
    // Extract historical balances for analysis
    const allHistoricalBalances = checkingAccounts.flatMap(account => 
      account.historical_balances.map(hb => ({
        date: hb.date,
        balance: centsToDollars(hb.current)
      }))
    );
    
    // Group by date and sum balances
    const balancesByDate = allHistoricalBalances.reduce((acc, { date, balance }) => {
      acc[date] = (acc[date] || 0) + balance;
      return acc;
    }, {} as Record<string, number>);
    
    // Convert to array and sort by date
    const sortedDailyBalances = Object.entries(balancesByDate)
      .map(([date, balance]) => ({ date, balance }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Calculate metrics
    const balances = sortedDailyBalances.map(entry => entry.balance);
    
    const averageBalance = this.calculateAverage(balances);
    const lowestBalance = Math.min(...balances);
    
    // Count overdrafts (days with negative balance)
    const overdraftCount = balances.filter(balance => balance < 0).length;
    
    // Count days with low balance (less than 1 week of expenses)
    const weeklyExpenses = cashFlow.averageMonthlyExpenses / 4;
    const daysWithLowBalance = balances.filter(balance => balance < weeklyExpenses).length;
    
    // Determine balance trend
    const balanceTrend = this.determineTrend(balances);
    
    // Calculate liquid reserves ratio (months of expenses that can be covered)
    const liquidReservesRatio = cashFlow.averageMonthlyExpenses > 0 ? 
      endingBalance / cashFlow.averageMonthlyExpenses : 0;
    
    return {
      endingBalance,
      averageBalance,
      lowestBalance,
      overdraftCount,
      daysWithLowBalance,
      balanceTrend,
      liquidReservesRatio
    };
  }

  /**
   * Calculate the overall underwriting score and recommendation
   */
  private calculateUnderwritingScore(
    cashFlow: CashFlowMetrics,
    debt: DebtMetrics,
    chargebacks: ChargebackMetrics,
    reserves: ReserveMetrics
  ): UnderwritingScore {
    // Calculate individual component scores (0-100)
    const cashFlowScore = this.calculateCashFlowScore(cashFlow);
    const debtServiceScore = this.calculateDebtServiceScore(debt);
    const chargebackScore = this.calculateChargebackScore(chargebacks);
    const reservesScore = this.calculateReservesScore(reserves);
    
    // Calculate weighted overall score
    const overall = Math.round(
      cashFlowScore * 0.4 +
      debtServiceScore * 0.3 +
      chargebackScore * 0.15 +
      reservesScore * 0.15
    );
    
    // Determine risk level
    let riskLevel: 'Low' | 'Moderate' | 'High';
    if (overall >= 80) {
      riskLevel = 'Low';
    } else if (overall >= 60) {
      riskLevel = 'Moderate';
    } else {
      riskLevel = 'High';
    }
    
    // Determine recommendation
    let recommendation: 'Approve' | 'Approve with Conditions' | 'Further Review' | 'Decline';
    if (overall >= 80) {
      recommendation = 'Approve';
    } else if (overall >= 70) {
      recommendation = 'Approve with Conditions';
    } else if (overall >= 50) {
      recommendation = 'Further Review';
    } else {
      recommendation = 'Decline';
    }
    
    // Calculate maximum recommended loan amount based on cash flow and risk level
    // For online course businesses, a common rule is 3-6 months of revenue
    let maxRecommendedLoan = 0;
    
    if (cashFlow.averageMonthlyRevenue > 0) {
      const revenueMultiplier = 
        riskLevel === 'Low' ? 6 :
        riskLevel === 'Moderate' ? 4 : 2;
      
      maxRecommendedLoan = cashFlow.averageMonthlyRevenue * revenueMultiplier;
      
      // Cap loan amount based on DSCR
      if (debt.dscr < 1.5 && debt.dscr > 0) {
        // Adjust down if DSCR is already tight
        const dscr = Math.max(debt.dscr, 0.8); // Floor at 0.8
        const dscrAdjustment = dscr / 1.5; // Scale based on ideal DSCR of 1.5
        maxRecommendedLoan *= dscrAdjustment;
      }
    }
    
    // Round to the nearest $1000
    maxRecommendedLoan = Math.floor(maxRecommendedLoan / 1000) * 1000;
    
    // Generate underwriting notes
    const notes = this.generateUnderwritingNotes(cashFlow, debt, chargebacks, reserves, riskLevel);
    
    return {
      overall,
      cashFlowScore,
      debtServiceScore,
      chargebackScore,
      reservesScore,
      recommendation,
      maxRecommendedLoan,
      riskLevel,
      notes
    };
  }

  /**
   * Calculate cash flow score (0-100)
   */
  private calculateCashFlowScore(cashFlow: CashFlowMetrics): number {
    let score = 0;
    
    // Score based on net cash flow positivity
    if (cashFlow.averageMonthlyNetCashFlow > 0) {
      // Positive cash flow - base points
      score += 40;
      
      // Additional points based on cash flow margin
      const cashFlowMargin = cashFlow.averageMonthlyNetCashFlow / cashFlow.averageMonthlyRevenue;
      if (cashFlowMargin >= 0.3) score += 20;
      else if (cashFlowMargin >= 0.2) score += 15;
      else if (cashFlowMargin >= 0.1) score += 10;
      else score += 5;
    } else {
      // Negative cash flow is concerning
      score += 10;
    }
    
    // Score based on revenue trend
    if (cashFlow.revenueTrend === 'increasing') score += 20;
    else if (cashFlow.revenueTrend === 'stable') score += 15;
    else score += 5;
    
    // Score based on volatility
    if (cashFlow.volatilityScore <= 0.2) score += 20;
    else if (cashFlow.volatilityScore <= 0.4) score += 15;
    else if (cashFlow.volatilityScore <= 0.6) score += 10;
    else score += 5;
    
    // Cap at 100
    return Math.min(100, score);
  }

  /**
   * Calculate debt service score (0-100)
   */
  private calculateDebtServiceScore(debt: DebtMetrics): number {
    let score = 0;
    
    // Score based on DSCR
    if (debt.dscr >= 2.0) score += 40;
    else if (debt.dscr >= 1.5) score += 35;
    else if (debt.dscr >= 1.2) score += 30;
    else if (debt.dscr >= 1.0) score += 20;
    else if (debt.dscr >= 0.8) score += 10;
    else score += 5;
    
    // Score based on debt to revenue ratio
    if (debt.debtToRevenueRatio <= 0.1) score += 30;
    else if (debt.debtToRevenueRatio <= 0.2) score += 25;
    else if (debt.debtToRevenueRatio <= 0.3) score += 20;
    else if (debt.debtToRevenueRatio <= 0.4) score += 15;
    else if (debt.debtToRevenueRatio <= 0.5) score += 10;
    else score += 5;
    
    // Penalize for loan stacking
    if (!debt.loanStackingDetected) score += 20;
    
    // Penalize for recent loan activity
    if (!debt.recentLoanActivity) score += 10;
    
    // Cap at 100
    return Math.min(100, score);
  }

  /**
   * Calculate chargeback score (0-100)
   */
  private calculateChargebackScore(chargebacks: ChargebackMetrics): number {
    let score = 0;
    
    // Score based on chargeback rate
    if (chargebacks.chargebackRate <= 0.005) score += 40;
    else if (chargebacks.chargebackRate <= 0.01) score += 35;
    else if (chargebacks.chargebackRate <= 0.015) score += 30;
    else if (chargebacks.chargebackRate <= 0.02) score += 20;
    else if (chargebacks.chargebackRate <= 0.03) score += 10;
    else score += 5;
    
    // Score based on refund rate
    if (chargebacks.refundRate <= 0.03) score += 30;
    else if (chargebacks.refundRate <= 0.05) score += 25;
    else if (chargebacks.refundRate <= 0.08) score += 20;
    else if (chargebacks.refundRate <= 0.1) score += 15;
    else if (chargebacks.refundRate <= 0.15) score += 10;
    else score += 5;
    
    // Score based on refund trend
    if (chargebacks.monthlyRefundTrend === 'decreasing') score += 30;
    else if (chargebacks.monthlyRefundTrend === 'stable') score += 20;
    else score += 10;
    
    // Cap at 100
    return Math.min(100, score);
  }

  /**
   * Calculate reserves score (0-100)
   */
  private calculateReservesScore(reserves: ReserveMetrics): number {
    let score = 0;
    
    // Score based on liquid reserves ratio
    if (reserves.liquidReservesRatio >= 6) score += 40;
    else if (reserves.liquidReservesRatio >= 3) score += 35;
    else if (reserves.liquidReservesRatio >= 2) score += 30;
    else if (reserves.liquidReservesRatio >= 1) score += 20;
    else if (reserves.liquidReservesRatio >= 0.5) score += 10;
    else score += 5;
    
    // Score based on overdraft count
    if (reserves.overdraftCount === 0) score += 30;
    else if (reserves.overdraftCount <= 1) score += 20;
    else if (reserves.overdraftCount <= 3) score += 10;
    else score += 5;
    
    // Score based on balance trend
    if (reserves.balanceTrend === 'increasing') score += 30;
    else if (reserves.balanceTrend === 'stable') score += 20;
    else score += 10;
    
    // Cap at 100
    return Math.min(100, score);
  }

  /**
   * Generate underwriting notes based on analysis
   */
  private generateUnderwritingNotes(
    cashFlow: CashFlowMetrics,
    debt: DebtMetrics,
    chargebacks: ChargebackMetrics,
    reserves: ReserveMetrics,
    riskLevel: 'Low' | 'Moderate' | 'High'
  ): string[] {
    const notes: string[] = [];
    
    // Cash flow notes
    if (cashFlow.averageMonthlyNetCashFlow <= 0) {
      notes.push(`WARNING: Business is operating with negative cash flow (${this.formatCurrency(cashFlow.averageMonthlyNetCashFlow)} monthly average).`);
    } else {
      notes.push(`Business generates average monthly net cash flow of ${this.formatCurrency(cashFlow.averageMonthlyNetCashFlow)}.`);
    }
    
    if (cashFlow.revenueTrend === 'increasing') {
      notes.push(`Revenue shows positive growth trend with ${this.formatPercent(cashFlow.revenueGrowthRate)} growth rate.`);
    } else if (cashFlow.revenueTrend === 'decreasing') {
      notes.push(`CAUTION: Revenue shows declining trend with ${this.formatPercent(cashFlow.revenueGrowthRate)} growth rate.`);
    }
    
    // Debt service notes
    if (debt.dscr < 1.0) {
      notes.push(`WARNING: Current debt service coverage ratio (${debt.dscr.toFixed(2)}x) indicates insufficient cash flow to cover existing debt.`);
    } else if (debt.dscr >= 1.0 && debt.dscr < 1.5) {
      notes.push(`Debt service coverage ratio (${debt.dscr.toFixed(2)}x) is adequate but leaves little buffer for additional debt.`);
    } else {
      notes.push(`Strong debt service coverage ratio (${debt.dscr.toFixed(2)}x) indicates good capacity to take on additional debt.`);
    }
    
    if (debt.loanStackingDetected) {
      notes.push(`WARNING: Multiple loans detected (${debt.numberOfLoans}) which increases default risk.`);
    }
    
    // Chargeback notes
    if (chargebacks.chargebackRate > 0.02) {
      notes.push(`WARNING: High chargeback rate (${this.formatPercent(chargebacks.chargebackRate)}) exceeds typical online education industry standards.`);
    }
    
    if (chargebacks.refundRate > 0.1) {
      notes.push(`CAUTION: Elevated refund rate (${this.formatPercent(chargebacks.refundRate)}) may indicate customer satisfaction issues.`);
    }
    
    // Reserve notes
    if (reserves.overdraftCount > 0) {
      notes.push(`CAUTION: Account has experienced ${reserves.overdraftCount} overdrafts in the past 90 days.`);
    }
    
    if (reserves.liquidReservesRatio < 1) {
      notes.push(`WARNING: Limited cash reserves (${reserves.liquidReservesRatio.toFixed(1)} months of expenses) increases vulnerability to revenue disruptions.`);
    }
    
    // Summary note
    notes.push(`Overall risk assessment: ${riskLevel} risk merchant with ${this.formatCurrency(cashFlow.averageMonthlyRevenue)} average monthly revenue.`);
    
    return notes;
  }

  /**
   * Group transactions by month (format: 'YYYY-MM')
   */
  private groupTransactionsByMonth(transactions: Transaction[]): Record<string, Transaction[]> {
    return transactions.reduce((acc, transaction) => {
      const date = new Date(transaction.date);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[month]) {
        acc[month] = [];
      }
      
      acc[month].push(transaction);
      return acc;
    }, {} as Record<string, Transaction[]>);
  }

  /**
   * Get sorted list of months from a record of transactions by month
   */
  private getSortedMonths(transactionsByMonth: Record<string, Transaction[]>): string[] {
    return Object.keys(transactionsByMonth).sort();
  }

  /**
   * Check if a transaction is likely revenue
   */
  private isLikelyRevenue(transaction: Transaction): boolean {
    // Revenue is typically a credit (negative amount in Plaid)
    if (transaction.amount >= 0) return false;
    
    const name = transaction.name.toLowerCase();
    
    // Check for payment processor keywords
    if (PAYMENT_PROCESSOR_KEYWORDS.some(keyword => this.containsKeyword(name, [keyword]))) {
      return true;
    }
    
    // Check for categories related to revenue
    if (transaction.category && transaction.category.some(cat => 
      ['transfer', 'deposit', 'payment'].includes(cat.toLowerCase())
    )) {
      return true;
    }
    
    // Look for deposit-like patterns
    return /deposit|payment|transfer in/i.test(name);
  }

  /**
   * Check if a transaction is likely an expense
   */
  private isLikelyExpense(transaction: Transaction): boolean {
    // Expenses are typically debits (positive amount in Plaid)
    if (transaction.amount <= 0) return false;
    
    // Ignore transfers between accounts and debt payments
    if (this.isLikelyTransfer(transaction) || this.isLikelyDebtPayment(transaction)) {
      return false;
    }
    
    const name = transaction.name.toLowerCase();
    
    // Check category list
    if (transaction.category && transaction.category.some(cat => 
      EXPENSE_CATEGORIES.some(expense => this.containsKeyword(cat.toLowerCase(), [expense]))
    )) {
      return true;
    }
    
    // Look for expense-like patterns
    return /software|subscription|advertising|hosting|domain|office|payroll|tax|insurance|travel/i.test(name);
  }

  /**
   * Check if a transaction is likely a loan receipt
   */
  private isLikelyLoanReceipt(transaction: Transaction): boolean {
    // Loan receipts are typically credits (negative amount in Plaid)
    if (transaction.amount >= 0) return false;
    
    const name = transaction.name.toLowerCase();
    
    // Check for loan keywords
    return LOAN_KEYWORDS.some(keyword => this.containsKeyword(name, [keyword]));
  }

  /**
   * Check if a transaction is likely a debt payment
   */
  private isLikelyDebtPayment(transaction: Transaction): boolean {
    // Debt payments are typically debits (positive amount in Plaid)
    if (transaction.amount <= 0) return false;
    
    const name = transaction.name.toLowerCase();
    
    // Check for debt payment keywords
    return DEBT_PAYMENT_KEYWORDS.some(keyword => this.containsKeyword(name, [keyword])) ||
           LOAN_KEYWORDS.some(keyword => this.containsKeyword(name, [keyword]));
  }

  /**
   * Check if a transaction is likely a refund
   */
  private isLikelyRefund(transaction: Transaction): boolean {
    // Refunds are typically credits (positive amount in Plaid for the merchant)
    if (transaction.amount <= 0) return false;
    
    const name = transaction.name.toLowerCase();
    
    // Check for refund keywords
    return REFUND_KEYWORDS.some(keyword => this.containsKeyword(name, [keyword]));
  }

  /**
   * Check if a transaction is likely an internal transfer
   */
  private isLikelyTransfer(transaction: Transaction): boolean {
    if (!transaction.name) return false;
    
    const name = transaction.name.toLowerCase();
    
    // Check for transfer keywords
    return /transfer|xfer|zelle to|venmo to|paypal transfer|ach transfer|wire transfer/i.test(name) &&
           !PAYMENT_PROCESSOR_KEYWORDS.some(keyword => this.containsKeyword(name, [keyword]));
  }

  /**
   * Extract lender name from a transaction
   */
  private extractLenderName(transaction: Transaction): string | null {
    const name = transaction.name.toLowerCase();
    
    // Look for common lender names in the transaction description
    for (const keyword of LOAN_KEYWORDS) {
      if (this.containsKeyword(name, [keyword])) {
        // Extract words around the keyword as the lender name
        const regex = new RegExp(`([a-z0-9\\s]+\\s+${keyword}|${keyword}\\s+[a-z0-9\\s]+)`, 'i');
        const match = name.match(regex);
        if (match) return match[0].trim();
      }
    }
    
    return null;
  }

  /**
   * Check if text contains any of the provided keywords
   */
  private containsKeyword(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
  }

  /**
   * Calculate the average of an array of numbers
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /**
   * Determine trend of a series of values
   */
  private determineTrend(values: number[]): 'increasing' | 'stable' | 'decreasing' {
    if (values.length <= 1) return 'stable';
    
    // Use linear regression to determine trend
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i + 1);
    
    const sumX = indices.reduce((sum, x) => sum + x, 0);
    const sumY = values.reduce((sum, y) => sum + y, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate the average value to determine significance
    const avgY = sumY / n;
    
    // If the slope indicates less than 5% change over the period, consider it stable
    if (Math.abs(slope * n / avgY) < 0.05) return 'stable';
    
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Calculate growth rate of a series of values
   */
  private calculateGrowthRate(values: number[]): number {
    if (values.length <= 1) return 0;
    
    // Use CAGR formula: (End Value / Start Value)^(1/periods) - 1
    const startValue = values[0];
    const endValue = values[values.length - 1];
    
    if (startValue <= 0) return 0; // Can't calculate growth rate with zero or negative starting value
    
    const periods = values.length - 1;
    return Math.pow(endValue / startValue, 1 / periods) - 1;
  }

  /**
   * Calculate volatility of a series of values
   */
  private calculateVolatility(values: number[]): number {
    if (values.length <= 1) return 0;
    
    const avg = this.calculateAverage(values);
    
    // Calculate standard deviation
    const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
    const variance = this.calculateAverage(squaredDiffs);
    const stdDev = Math.sqrt(variance);
    
    // Return coefficient of variation (normalized volatility)
    return Math.abs(avg) > 0 ? stdDev / Math.abs(avg) : 0;
  }

  /**
   * Format a currency value as a string
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  }

  /**
   * Format a percentage value as a string
   */
  private formatPercent(value: number): string {
    return new Intl.NumberFormat('en-US', { 
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value);
  }

  /**
   * Save underwriting analysis to the database
   */
  private async saveUnderwritingAnalysis(analysis: UnderwritingAnalysis): Promise<void> {
    try {
      // In a real implementation, you would save the analysis to your database
      // For now, we'll just log that we would save it
      logger.info(`Would save underwriting analysis for merchant ${analysis.merchantId}, asset report ${analysis.assetReportId}`);
      
      // Example implementation:
      // await db.insert(underwritingAnalysisTable).values({
      //   merchantId: analysis.merchantId,
      //   assetReportId: analysis.assetReportId,
      //   analysisData: JSON.stringify(analysis),
      //   createdAt: new Date()
      // });
    } catch (error) {
      logger.error(`Error saving underwriting analysis: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the latest underwriting analysis for a merchant
   */
  async getLatestAnalysisForMerchant(merchantId: number): Promise<UnderwritingAnalysis | null> {
    try {
      // In a real implementation, you would fetch from your database
      // For demo purposes, return null (would be replaced with DB query)
      return null;
    } catch (error) {
      logger.error(`Error fetching latest analysis for merchant ${merchantId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Get analysis for a specific asset report
   */
  async getAnalysisForAssetReport(merchantId: number, assetReportId: string): Promise<UnderwritingAnalysis | null> {
    try {
      // In a real implementation, you would fetch from your database
      // For demo purposes, return null (would be replaced with DB query)
      return null;
    } catch (error) {
      logger.error(`Error fetching analysis for merchant ${merchantId}, asset report ${assetReportId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}