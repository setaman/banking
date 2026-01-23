"use server";

import { getTransactions, type TransactionFilters } from "./transactions.actions";
import {
  calculateMonthlyCashFlow,
  calculateSavingsRate,
  calculateCategoryBreakdown,
  calculateIncomeVsExpenses,
  calculateDailyAverageSpend,
  calculateExpenseVolatility,
  calculateMonthOverMonthTrend,
  calculateEmergencyFundCoverage,
} from "@/lib/stats/calculations";
import { getTotalBalance } from "./accounts.actions";

export interface DashboardStats {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  monthlyCashFlow: { month: string; income: number; expenses: number; net: number }[];
  categoryBreakdown: { category: string; amount: number; percentage: number }[];
  dailyAverageSpend: number;
  expenseVolatility: number;
  monthOverMonthTrend: number;
  emergencyFundCoverage: number;
}

export async function getDashboardStats(
  filters?: TransactionFilters,
): Promise<DashboardStats> {
  const [transactions, totalBalance] = await Promise.all([
    getTransactions(filters),
    getTotalBalance(),
  ]);

  const income = transactions
    .filter((t) => t.direction === "credit")
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter((t) => t.direction === "debit")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    totalBalance,
    totalIncome: income,
    totalExpenses: expenses,
    savingsRate: calculateSavingsRate(income, expenses),
    monthlyCashFlow: calculateMonthlyCashFlow(transactions),
    categoryBreakdown: calculateCategoryBreakdown(transactions),
    dailyAverageSpend: calculateDailyAverageSpend(transactions, filters?.startDate, filters?.endDate),
    expenseVolatility: calculateExpenseVolatility(transactions),
    monthOverMonthTrend: calculateMonthOverMonthTrend(transactions),
    emergencyFundCoverage: calculateEmergencyFundCoverage(totalBalance, expenses, transactions),
  };
}
