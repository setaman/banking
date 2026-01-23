import { format, parseISO, differenceInDays } from "date-fns";
import type { UnifiedTransaction } from "@/lib/banking/types";

/**
 * Groups transactions by month (YYYY-MM) and calculates income/expenses/net.
 */
export function calculateMonthlyCashFlow(
  transactions: UnifiedTransaction[],
): { month: string; income: number; expenses: number; net: number }[] {
  const monthMap = new Map<
    string,
    { income: number; expenses: number }
  >();

  for (const tx of transactions) {
    const month = tx.date.substring(0, 7); // YYYY-MM
    const current = monthMap.get(month) ?? { income: 0, expenses: 0 };

    if (tx.direction === "credit") {
      current.income += tx.amount;
    } else {
      current.expenses += Math.abs(tx.amount);
    }

    monthMap.set(month, current);
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      income: Math.round(data.income * 100) / 100,
      expenses: Math.round(data.expenses * 100) / 100,
      net: Math.round((data.income - data.expenses) * 100) / 100,
    }));
}

/**
 * Savings rate = (Income - Expenses) / Income * 100
 */
export function calculateSavingsRate(
  income: number,
  expenses: number,
): number {
  if (income === 0) return 0;
  return Math.round(((income - expenses) / income) * 10000) / 100;
}

/**
 * Category breakdown sorted by amount descending.
 */
export function calculateCategoryBreakdown(
  transactions: UnifiedTransaction[],
): { category: string; amount: number; percentage: number }[] {
  const expenses = transactions.filter((t) => t.direction === "debit");
  const totalExpenses = expenses.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0,
  );

  const categoryMap = new Map<string, number>();
  for (const tx of expenses) {
    const cat = tx.category ?? "Uncategorized";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + Math.abs(tx.amount));
  }

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage:
        totalExpenses > 0
          ? Math.round((amount / totalExpenses) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Income vs Expenses grouped by month.
 */
export function calculateIncomeVsExpenses(
  transactions: UnifiedTransaction[],
): { month: string; income: number; expenses: number }[] {
  return calculateMonthlyCashFlow(transactions).map(({ month, income, expenses }) => ({
    month,
    income,
    expenses,
  }));
}

/**
 * Daily average spend = Total expenses / Days in range
 */
export function calculateDailyAverageSpend(
  transactions: UnifiedTransaction[],
  startDate?: string,
  endDate?: string,
): number {
  const expenses = transactions.filter((t) => t.direction === "debit");
  const totalExpenses = expenses.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0,
  );

  if (expenses.length === 0) return 0;

  const start = startDate
    ? parseISO(startDate)
    : parseISO(expenses[expenses.length - 1].date);
  const end = endDate ? parseISO(endDate) : parseISO(expenses[0].date);
  const days = Math.max(differenceInDays(end, start), 1);

  return Math.round((totalExpenses / days) * 100) / 100;
}

/**
 * Expense volatility = standard deviation of monthly expenses.
 */
export function calculateExpenseVolatility(
  transactions: UnifiedTransaction[],
): number {
  const monthly = calculateMonthlyCashFlow(transactions);
  if (monthly.length < 2) return 0;

  const expenses = monthly.map((m) => m.expenses);
  const mean = expenses.reduce((a, b) => a + b, 0) / expenses.length;
  const variance =
    expenses.reduce((sum, e) => sum + (e - mean) ** 2, 0) / expenses.length;

  return Math.round(Math.sqrt(variance) * 100) / 100;
}

/**
 * Month-over-month trend = (current - previous) / previous * 100
 * Positive = spending increased, negative = spending decreased.
 */
export function calculateMonthOverMonthTrend(
  transactions: UnifiedTransaction[],
): number {
  const monthly = calculateMonthlyCashFlow(transactions);
  if (monthly.length < 2) return 0;

  const current = monthly[monthly.length - 1].expenses;
  const previous = monthly[monthly.length - 2].expenses;

  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

/**
 * Emergency fund coverage = Total balance / Average monthly expenses (in months).
 */
export function calculateEmergencyFundCoverage(
  totalBalance: number,
  _totalExpenses: number,
  transactions: UnifiedTransaction[],
): number {
  const monthly = calculateMonthlyCashFlow(transactions);
  if (monthly.length === 0) return 0;

  const avgMonthlyExpenses =
    monthly.reduce((sum, m) => sum + m.expenses, 0) / monthly.length;

  if (avgMonthlyExpenses === 0) return 0;
  return Math.round((totalBalance / avgMonthlyExpenses) * 100) / 100;
}
