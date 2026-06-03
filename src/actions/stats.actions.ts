"use server";

import { differenceInDays, parseISO, subDays } from "date-fns";
import {
  getTransactions,
  type TransactionFilters,
} from "./transactions.actions";
import {
  calculateMonthlyCashFlow,
  calculateSavingsRateLegacy,
  calculateCategoryBreakdown,
  calculateDailyAverageSpend,
  calculateExpenseVolatilityLegacy,
  calculateMonthOverMonthTrend,
  calculateEmergencyFundCoverage,
  calculateMonthlyAverages,
  calculateBalancePrediction,
  type BalancePredictionResult,
} from "@/lib/stats/calculations";
import { getTotalBalance } from "./accounts.actions";

export type {
  BalancePredictionResult,
  BalancePrediction,
  BalancePredictionPoint,
} from "@/lib/stats/calculations";

export interface MonthlyAverages {
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
  avgMonthlyNet: number;
  monthsCount: number;
  isPartialMonth: boolean;
}

export interface PreviousPeriodStats {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  savingsRate: number;
  expenseToIncomeRatio: number;
}

export interface DashboardStats {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  expenseToIncomeRatio: number;
  savingsRate: number;
  monthlyCashFlow: {
    month: string;
    income: number;
    expenses: number;
    net: number;
  }[];
  categoryBreakdown: { category: string; amount: number; percentage: number }[];
  dailyAverageSpend: number;
  expenseVolatility: number;
  monthOverMonthTrend: number;
  emergencyFundCoverage: number;
  previousPeriod: PreviousPeriodStats | null;
  averages: MonthlyAverages;
  balancePrediction: BalancePredictionResult;
}

function computePeriodStats(
  income: number,
  expenses: number
): PreviousPeriodStats {
  return {
    totalIncome: income,
    totalExpenses: expenses,
    netCashFlow: income - expenses,
    savingsRate: calculateSavingsRateLegacy(income, expenses),
    expenseToIncomeRatio: income > 0 ? (expenses / income) * 100 : 0,
  };
}

export async function getDashboardStats(
  filters?: TransactionFilters
): Promise<DashboardStats> {
  // Build previous-period filters when both startDate and endDate are present
  let prevFilters: TransactionFilters | undefined;
  if (filters?.startDate && filters?.endDate) {
    const start = parseISO(filters.startDate);
    const end = parseISO(filters.endDate);
    const durationDays = differenceInDays(end, start);
    const prevEnd = subDays(start, 1);
    const prevStart = subDays(prevEnd, durationDays > 0 ? durationDays - 1 : 0);

    prevFilters = {
      ...filters,
      startDate: prevStart.toISOString().slice(0, 10),
      endDate: prevEnd.toISOString().slice(0, 10),
    };
  }

  const [transactions, totalBalance, prevTransactions, allTransactions] =
    await Promise.all([
      // Exclude internal transfers from KPI calculations by default
      getTransactions(filters, { excludeInternal: true }),
      getTotalBalance(),
      prevFilters
        ? getTransactions(prevFilters, { excludeInternal: true })
        : Promise.resolve(null),
      // Full history (no date/account filter) for portfolio-level balance prediction
      getTransactions(undefined, { excludeInternal: true }),
    ]);

  const income = transactions
    .filter((t) => t.direction === "credit")
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter((t) => t.direction === "debit")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  let previousPeriod: PreviousPeriodStats | null = null;
  if (prevTransactions !== null) {
    const prevIncome = prevTransactions
      .filter((t) => t.direction === "credit")
      .reduce((sum, t) => sum + t.amount, 0);
    const prevExpenses = prevTransactions
      .filter((t) => t.direction === "debit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    previousPeriod = computePeriodStats(prevIncome, prevExpenses);
  }

  const averages = calculateMonthlyAverages({
    totalIncome: income,
    totalExpenses: expenses,
    netCashFlow: income - expenses,
    startDate: filters?.startDate,
    endDate: filters?.endDate,
  });

  const balancePrediction = calculateBalancePrediction({
    totalBalance,
    monthlyCashFlow: calculateMonthlyCashFlow(allTransactions),
  });

  return {
    totalBalance,
    totalIncome: income,
    totalExpenses: expenses,
    netCashFlow: income - expenses,
    expenseToIncomeRatio: income > 0 ? (expenses / income) * 100 : 0,
    savingsRate: calculateSavingsRateLegacy(income, expenses),
    monthlyCashFlow: calculateMonthlyCashFlow(transactions),
    categoryBreakdown: calculateCategoryBreakdown(transactions),
    dailyAverageSpend: calculateDailyAverageSpend(
      transactions,
      filters?.startDate,
      filters?.endDate
    ),
    expenseVolatility: calculateExpenseVolatilityLegacy(transactions),
    monthOverMonthTrend: calculateMonthOverMonthTrend(transactions),
    emergencyFundCoverage: calculateEmergencyFundCoverage(
      totalBalance,
      expenses,
      transactions
    ),
    previousPeriod,
    averages,
    balancePrediction,
  };
}
