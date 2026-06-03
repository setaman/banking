/**
 * KPI calculation functions for BanKing dashboard.
 *
 * All functions accept filtered transaction arrays and return typed results.
 * Uses date-fns for date manipulation and Intl.NumberFormat for EUR formatting.
 */

import {
  differenceInDays,
  parseISO,
  isWithinInterval,
  addMonths,
  format,
} from "date-fns";
import type { UnifiedTransaction } from "@/lib/banking/types";
import { classifyTransaction, type Category } from "./categories";

// --- Type Definitions ---

export interface MonthlyFlow {
  month: string; // YYYY-MM
  income: number;
  expenses: number;
  net: number;
}

export interface SavingsRate {
  rate: number; // Percentage (0-100)
  income: number;
  expenses: number;
  formatted: string; // e.g., "25.5%"
}

export interface EmergencyFund {
  months: number; // How many months of expenses can be covered
  balance: number;
  avgMonthlyExpenses: number;
  formatted: string; // e.g., "3.2 months"
}

export interface ExpenseVolatility {
  standardDeviation: number;
  mean: number;
  coefficient: number; // CV = std dev / mean
  formatted: string; // e.g., "€250.50"
}

export interface IncomeStability {
  standardDeviation: number;
  mean: number;
  coefficient: number; // CV = std dev / mean
  formatted: string; // e.g., "€150.00"
}

export interface CategoryBreakdown {
  category: Category;
  amount: number;
  percentage: number;
  count: number;
  formatted: string; // e.g., "€1,250.00"
}

export interface RecurringRatio {
  ratio: number; // Percentage (0-100)
  recurringAmount: number;
  totalExpenses: number;
  formatted: string; // e.g., "65.0%"
}

export interface DiscretionaryRatio {
  ratio: number; // Percentage (0-100)
  discretionaryAmount: number;
  totalExpenses: number;
  formatted: string; // e.g., "35.0%"
}

export interface MoMTrend {
  trend: number; // Percentage change (-100 to +∞)
  currentMonth: number;
  previousMonth: number;
  formatted: string; // e.g., "+15.5%" or "-8.2%"
}

export interface DailyAverage {
  average: number;
  totalExpenses: number;
  days: number;
  formatted: string; // e.g., "€45.50/day"
}

export interface LargestExpense {
  transaction: UnifiedTransaction | null;
  amount: number;
  formatted: string; // e.g., "€1,500.00"
}

// --- Utility Functions ---

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatEUR(amount: number): string {
  return eurFormatter.format(amount);
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

function groupTransactionsByMonth(
  transactions: UnifiedTransaction[]
): Map<string, UnifiedTransaction[]> {
  const groups = new Map<string, UnifiedTransaction[]>();

  transactions.forEach((tx) => {
    const month = tx.bookingDate.substring(0, 7); // Extract YYYY-MM from bookingDate
    if (!groups.has(month)) {
      groups.set(month, []);
    }
    groups.get(month)!.push(tx);
  });

  return groups;
}

// --- KPI Calculation Functions ---

/**
 * Calculates monthly cash flow (income - expenses).
 * Returns array of monthly data sorted chronologically.
 */
export function calculateMonthlyFlow(
  transactions: UnifiedTransaction[]
): MonthlyFlow[] {
  const monthlyGroups = groupTransactionsByMonth(transactions);
  const results: MonthlyFlow[] = [];

  monthlyGroups.forEach((txs, month) => {
    const income = txs
      .filter((tx) => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const expenses = Math.abs(
      txs.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0)
    );

    results.push({
      month,
      income,
      expenses,
      net: income - expenses,
    });
  });

  return results.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Calculates savings rate as (income - expenses) / income * 100.
 * Returns percentage for the entire period.
 */
export function calculateSavingsRate(
  transactions: UnifiedTransaction[]
): SavingsRate {
  const income = transactions
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const expenses = Math.abs(
    transactions
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const rate = income > 0 ? ((income - expenses) / income) * 100 : 0;

  return {
    rate,
    income,
    expenses,
    formatted: `${rate.toFixed(1)}%`,
  };
}

/**
 * Calculates emergency fund coverage in months.
 * Emergency fund = current balance / average monthly expenses.
 */
export function calculateEmergencyFund(
  balance: number,
  transactions: UnifiedTransaction[]
): EmergencyFund {
  const monthlyGroups = groupTransactionsByMonth(transactions);
  const monthlyExpenses: number[] = [];

  monthlyGroups.forEach((txs) => {
    const expenses = Math.abs(
      txs.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0)
    );
    monthlyExpenses.push(expenses);
  });

  const avgMonthlyExpenses =
    monthlyExpenses.length > 0
      ? monthlyExpenses.reduce((sum, val) => sum + val, 0) /
        monthlyExpenses.length
      : 0;

  const months = avgMonthlyExpenses > 0 ? balance / avgMonthlyExpenses : 0;

  return {
    months,
    balance,
    avgMonthlyExpenses,
    formatted: `${months.toFixed(1)} months`,
  };
}

/**
 * Calculates expense volatility using standard deviation of monthly expenses.
 * Returns coefficient of variation for normalized comparison.
 */
export function calculateExpenseVolatility(
  transactions: UnifiedTransaction[]
): ExpenseVolatility {
  const monthlyGroups = groupTransactionsByMonth(transactions);
  const monthlyExpenses: number[] = [];

  monthlyGroups.forEach((txs) => {
    const expenses = Math.abs(
      txs.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0)
    );
    monthlyExpenses.push(expenses);
  });

  const mean =
    monthlyExpenses.length > 0
      ? monthlyExpenses.reduce((sum, val) => sum + val, 0) /
        monthlyExpenses.length
      : 0;
  const standardDeviation = calculateStandardDeviation(monthlyExpenses);
  const coefficient = mean > 0 ? standardDeviation / mean : 0;

  return {
    standardDeviation,
    mean,
    coefficient,
    formatted: formatEUR(standardDeviation),
  };
}

/**
 * Calculates income stability using standard deviation of monthly income.
 * Returns coefficient of variation for normalized comparison.
 */
export function calculateIncomeStability(
  transactions: UnifiedTransaction[]
): IncomeStability {
  const monthlyGroups = groupTransactionsByMonth(transactions);
  const monthlyIncome: number[] = [];

  monthlyGroups.forEach((txs) => {
    const income = txs
      .filter((tx) => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);
    monthlyIncome.push(income);
  });

  const mean =
    monthlyIncome.length > 0
      ? monthlyIncome.reduce((sum, val) => sum + val, 0) / monthlyIncome.length
      : 0;
  const standardDeviation = calculateStandardDeviation(monthlyIncome);
  const coefficient = mean > 0 ? standardDeviation / mean : 0;

  return {
    standardDeviation,
    mean,
    coefficient,
    formatted: formatEUR(standardDeviation),
  };
}

/**
 * Calculates top spending categories ranked by total amount.
 * Classifies transactions automatically and returns top N categories.
 */
export function calculateTopCategories(
  transactions: UnifiedTransaction[],
  limit: number = 10
): CategoryBreakdown[] {
  const categoryTotals = new Map<Category, { amount: number; count: number }>();

  // Filter to expenses only and classify
  transactions
    .filter((tx) => tx.amount < 0)
    .forEach((tx) => {
      const category =
        tx.category || classifyTransaction(tx.description, tx.counterparty);
      const absAmount = Math.abs(tx.amount);

      if (!categoryTotals.has(category as Category)) {
        categoryTotals.set(category as Category, { amount: 0, count: 0 });
      }

      const current = categoryTotals.get(category as Category)!;
      current.amount += absAmount;
      current.count += 1;
    });

  const totalExpenses = Array.from(categoryTotals.values()).reduce(
    (sum, { amount }) => sum + amount,
    0
  );

  const results: CategoryBreakdown[] = Array.from(categoryTotals.entries())
    .map(([category, { amount, count }]) => ({
      category,
      amount,
      count,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      formatted: formatEUR(amount),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);

  return results;
}

/**
 * Calculates recurring expense ratio.
 * Recurring = expenses that appear monthly with similar amounts (tolerance: ±20%).
 */
export function calculateRecurringRatio(
  transactions: UnifiedTransaction[]
): RecurringRatio {
  const counterpartyMonthlyAmounts = new Map<string, Map<string, number>>();

  // Group expenses by counterparty and month
  transactions
    .filter((tx) => tx.amount < 0 && tx.counterparty)
    .forEach((tx) => {
      const month = tx.bookingDate.substring(0, 7);
      const counterparty = tx.counterparty.toLowerCase().trim();
      const absAmount = Math.abs(tx.amount);

      if (!counterpartyMonthlyAmounts.has(counterparty)) {
        counterpartyMonthlyAmounts.set(counterparty, new Map());
      }

      const monthlyMap = counterpartyMonthlyAmounts.get(counterparty)!;
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + absAmount);
    });

  // Identify recurring expenses (appear in 2+ months with ±20% variance)
  let recurringAmount = 0;
  counterpartyMonthlyAmounts.forEach((monthlyMap) => {
    if (monthlyMap.size >= 2) {
      const amounts = Array.from(monthlyMap.values());
      const mean = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
      const maxDeviation = Math.max(
        ...amounts.map((amt) => Math.abs(amt - mean) / mean)
      );

      // If variance is within 20%, consider it recurring
      if (maxDeviation <= 0.2) {
        recurringAmount += amounts.reduce((sum, val) => sum + val, 0);
      }
    }
  });

  const totalExpenses = Math.abs(
    transactions
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const ratio = totalExpenses > 0 ? (recurringAmount / totalExpenses) * 100 : 0;

  return {
    ratio,
    recurringAmount,
    totalExpenses,
    formatted: `${ratio.toFixed(1)}%`,
  };
}

/**
 * Calculates discretionary spending ratio.
 * Discretionary = Entertainment + Dining + Shopping categories.
 */
export function calculateDiscretionaryRatio(
  transactions: UnifiedTransaction[]
): DiscretionaryRatio {
  const discretionaryCategories: Category[] = [
    "Entertainment",
    "Dining",
    "Shopping",
  ];

  const discretionaryAmount = Math.abs(
    transactions
      .filter((tx) => {
        if (tx.amount >= 0) return false;
        const category =
          tx.category || classifyTransaction(tx.description, tx.counterparty);
        return discretionaryCategories.includes(category as Category);
      })
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const totalExpenses = Math.abs(
    transactions
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const ratio =
    totalExpenses > 0 ? (discretionaryAmount / totalExpenses) * 100 : 0;

  return {
    ratio,
    discretionaryAmount,
    totalExpenses,
    formatted: `${ratio.toFixed(1)}%`,
  };
}

export interface MonthlyAveragesInput {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  startDate?: string; // ISO YYYY-MM-DD
  endDate?: string; // ISO YYYY-MM-DD
}

export interface MonthlyAveragesResult {
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
  avgMonthlyNet: number;
  monthsCount: number; // whole number of months used as divisor (min 1)
  isPartialMonth: boolean; // true when the range spans fewer than 28 days
}

/**
 * Calculates per-month averages for income, expenses, and net cash flow.
 *
 * Month-count rule (duration-based, NOT calendar+1):
 * A "Last 3 Months" range (~91 days) must divide by 3, so we use
 * elapsed duration / average-month-length (30.44), not calendar-boundary counting.
 */
export function calculateMonthlyAverages(
  input: MonthlyAveragesInput
): MonthlyAveragesResult {
  const { totalIncome, totalExpenses, netCashFlow, startDate, endDate } = input;

  let monthsCount: number;
  let isPartialMonth: boolean;

  if (startDate && endDate) {
    const days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
    const rawMonths = days / 30.44;
    monthsCount = Math.max(1, Math.round(rawMonths));
    isPartialMonth = days < 28;
  } else {
    monthsCount = 1;
    isPartialMonth = false;
  }

  return {
    avgMonthlyIncome: Math.round((totalIncome / monthsCount) * 100) / 100,
    avgMonthlyExpenses: Math.round((totalExpenses / monthsCount) * 100) / 100,
    avgMonthlyNet: Math.round((netCashFlow / monthsCount) * 100) / 100,
    monthsCount,
    isPartialMonth,
  };
}

// --- Balance Prediction ---

export interface BalancePredictionPoint {
  month: string; // ISO month "YYYY-MM" for the projected month
  projected: number; // projected balance at end of this month
  upperBound: number;
  lowerBound: number;
}

export interface BalancePrediction {
  points: BalancePredictionPoint[]; // exactly 12 monthly points
  monthsUsed: number; // historical months used (3..12)
  meanMonthlyNet: number;
  stdDevMonthlyNet: number; // always >= 0
  confidence: "low" | "normal" | "volatile";
}

export type BalancePredictionResult =
  | { available: true; prediction: BalancePrediction }
  | { available: false; reason: "insufficient-history" | "no-data" };

export interface BalancePredictionInput {
  totalBalance: number;
  monthlyCashFlow: MonthlyFlow[]; // chronological, from calculateMonthlyCashFlow
  currentMonth?: string; // "YYYY-MM"; defaults to current month
}

/**
 * Increments a YYYY-MM string by `count` months, handling year rollover.
 * Uses date-fns addMonths on the 1st of the given month.
 */
function incrementMonth(yearMonth: string, count: number): string {
  const base = parseISO(`${yearMonth}-01`);
  return format(addMonths(base, count), "yyyy-MM");
}

/**
 * Projects the portfolio balance 12 months forward using historical monthly
 * net cash flow. Returns a structured result indicating availability and,
 * when available, 12 prediction points with uncertainty bounds.
 *
 * - Requires at least 3 complete historical months.
 * - Uses up to the trailing 12 complete months for mean/std-dev computation.
 * - Excludes the current (partial) month from history.
 * - Uncertainty bounds widen proportionally to sqrt(i) (random-walk model).
 */
export function calculateBalancePrediction(
  input: BalancePredictionInput
): BalancePredictionResult {
  const { totalBalance, monthlyCashFlow } = input;

  // Derive current month string (YYYY-MM)
  const currentMonth = input.currentMonth ?? format(new Date(), "yyyy-MM");

  // Exclude the current (partial) month from history
  const completeMonths = monthlyCashFlow.filter(
    (m) => m.month !== currentMonth
  );

  // Guard: no-data if truly empty with zero balance
  if (completeMonths.length === 0 && totalBalance === 0) {
    return { available: false, reason: "no-data" };
  }

  // Guard: need at least 3 complete months
  if (completeMonths.length < 3) {
    return { available: false, reason: "insufficient-history" };
  }

  // Take trailing min(count, 12) months
  const historyWindow = completeMonths.slice(-12);
  const monthsUsed = historyWindow.length;

  const netValues = historyWindow.map((m) => m.net);

  const meanMonthlyNet = netValues.reduce((sum, v) => sum + v, 0) / monthsUsed;

  const stdDevMonthlyNet = calculateStandardDeviation(netValues);

  // Confidence classification
  let confidence: BalancePrediction["confidence"];
  if (stdDevMonthlyNet > Math.abs(meanMonthlyNet) * 2) {
    confidence = "volatile";
  } else if (monthsUsed < 6) {
    confidence = "low";
  } else {
    confidence = "normal";
  }

  // Generate exactly 12 forward projection points
  const points: BalancePredictionPoint[] = [];
  for (let i = 1; i <= 12; i++) {
    const month = incrementMonth(currentMonth, i);
    const projected = totalBalance + meanMonthlyNet * i;
    const spread = stdDevMonthlyNet * Math.sqrt(i);
    points.push({
      month,
      projected,
      upperBound: projected + spread,
      lowerBound: projected - spread,
    });
  }

  return {
    available: true,
    prediction: {
      points,
      monthsUsed,
      meanMonthlyNet,
      stdDevMonthlyNet,
      confidence,
    },
  };
}

// --- Backward Compatibility Wrappers ---
// These maintain compatibility with existing stats.actions.ts

/**
 * @deprecated Use calculateMonthlyFlow instead
 */
export function calculateMonthlyCashFlow(
  transactions: UnifiedTransaction[]
): { month: string; income: number; expenses: number; net: number }[] {
  return calculateMonthlyFlow(transactions);
}

/**
 * Legacy function signature - calculates savings rate from pre-computed income/expenses.
 * @deprecated Use calculateSavingsRate(transactions) instead for consistency
 */
export function calculateSavingsRateLegacy(
  income: number,
  expenses: number
): number {
  if (income === 0) return 0;
  return Math.round(((income - expenses) / income) * 10000) / 100;
}

/**
 * Category breakdown sorted by amount descending.
 */
export function calculateCategoryBreakdown(
  transactions: UnifiedTransaction[]
): { category: string; amount: number; percentage: number }[] {
  const topCategories = calculateTopCategories(transactions, 100); // Get all categories
  return topCategories.map((cat) => ({
    category: cat.category,
    amount: Math.round(cat.amount * 100) / 100,
    percentage: Math.round(cat.percentage * 100) / 100,
  }));
}

/**
 * Income vs Expenses grouped by month.
 */
export function calculateIncomeVsExpenses(
  transactions: UnifiedTransaction[]
): { month: string; income: number; expenses: number }[] {
  return calculateMonthlyFlow(transactions).map(
    ({ month, income, expenses }) => ({
      month,
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
    })
  );
}

/**
 * Daily average spend = Total expenses / Days in range
 */
export function calculateDailyAverageSpend(
  transactions: UnifiedTransaction[],
  startDate?: string,
  endDate?: string
): number {
  const dateRange =
    startDate && endDate
      ? { start: parseISO(startDate), end: parseISO(endDate) }
      : undefined;

  const result = calculateDailyAverage(transactions, dateRange);
  return Math.round(result.average * 100) / 100;
}

/**
 * Month-over-month trend = (current - previous) / previous * 100
 * Positive = spending increased, negative = spending decreased.
 */
export function calculateMonthOverMonthTrend(
  transactions: UnifiedTransaction[]
): number {
  const result = calculateMoMTrend(transactions);
  return Math.round(result.trend * 100) / 100;
}

/**
 * Expense volatility = standard deviation of monthly expenses.
 * @deprecated This is a legacy wrapper. Use the full calculateExpenseVolatility() for detailed results.
 */
export function calculateExpenseVolatilityLegacy(
  transactions: UnifiedTransaction[]
): number {
  const result = calculateExpenseVolatility(transactions);
  return Math.round(result.standardDeviation * 100) / 100;
}

/**
 * Emergency fund coverage = Total balance / Average monthly expenses (in months).
 */
export function calculateEmergencyFundCoverage(
  totalBalance: number,
  _totalExpenses: number,
  transactions: UnifiedTransaction[]
): number {
  const result = calculateEmergencyFund(totalBalance, transactions);
  return Math.round(result.months * 100) / 100;
}

/**
 * Calculates month-over-month trend for expenses.
 * Returns percentage change from previous month to current month.
 */
export function calculateMoMTrend(
  transactions: UnifiedTransaction[]
): MoMTrend {
  const monthlyGroups = groupTransactionsByMonth(transactions);
  const sortedMonths = Array.from(monthlyGroups.keys()).sort();

  if (sortedMonths.length < 2) {
    return {
      trend: 0,
      currentMonth: 0,
      previousMonth: 0,
      formatted: "0.0%",
    };
  }

  const currentMonthKey = sortedMonths[sortedMonths.length - 1];
  const previousMonthKey = sortedMonths[sortedMonths.length - 2];

  const currentMonth = Math.abs(
    monthlyGroups
      .get(currentMonthKey)!
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const previousMonth = Math.abs(
    monthlyGroups
      .get(previousMonthKey)!
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const trend =
    previousMonth > 0
      ? ((currentMonth - previousMonth) / previousMonth) * 100
      : 0;

  const sign = trend > 0 ? "+" : "";
  const formatted = `${sign}${trend.toFixed(1)}%`;

  return {
    trend,
    currentMonth,
    previousMonth,
    formatted,
  };
}

/**
 * Calculates daily average spending for a given date range.
 * Returns total expenses divided by number of days in period.
 */
export function calculateDailyAverage(
  transactions: UnifiedTransaction[],
  dateRange?: { start: Date; end: Date }
): DailyAverage {
  let filteredTransactions = transactions;
  let days = 0;

  if (dateRange) {
    filteredTransactions = transactions.filter((tx) => {
      const txDate = parseISO(tx.bookingDate);
      return isWithinInterval(txDate, {
        start: dateRange.start,
        end: dateRange.end,
      });
    });
    days = differenceInDays(dateRange.end, dateRange.start) + 1; // +1 to include both start and end
  } else {
    // If no date range provided, use min/max dates from transactions
    if (transactions.length === 0) {
      return {
        average: 0,
        totalExpenses: 0,
        days: 0,
        formatted: "€0.00/day",
      };
    }

    const dates = transactions.map((tx) => parseISO(tx.bookingDate));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    days = differenceInDays(maxDate, minDate) + 1;
  }

  const totalExpenses = Math.abs(
    filteredTransactions
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const average = days > 0 ? totalExpenses / days : 0;

  return {
    average,
    totalExpenses,
    days,
    formatted: `${formatEUR(average)}/day`,
  };
}

/**
 * Finds the largest single expense transaction.
 * Returns the transaction with the highest absolute value (most negative).
 */
export function findLargestExpense(
  transactions: UnifiedTransaction[]
): LargestExpense {
  const expenses = transactions.filter((tx) => tx.amount < 0);

  if (expenses.length === 0) {
    return {
      transaction: null,
      amount: 0,
      formatted: formatEUR(0),
    };
  }

  const largest = expenses.reduce((max, tx) =>
    tx.amount < max.amount ? tx : max
  );

  const amount = Math.abs(largest.amount);

  return {
    transaction: largest,
    amount,
    formatted: formatEUR(amount),
  };
}
