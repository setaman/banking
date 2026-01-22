import type { Transaction, TransactionCategory } from '../types';

/**
 * Calculate current balance from transactions
 * 
 * Sums all transaction amounts (positive = income, negative = expense)
 * 
 * @param transactions - Array of transactions
 * @returns Total balance in cents
 * 
 * @example
 * ```typescript
 * const balance = calculateBalance([
 *   { amount: 50000 },  // +500.00 EUR
 *   { amount: -20000 }, // -200.00 EUR
 * ]);
 * // balance = 30000 (300.00 EUR)
 * ```
 */
export function calculateBalance(transactions: Transaction[]): number {
  if (!transactions || transactions.length === 0) {
    return 0;
  }

  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
}

/**
 * Balance history data point
 */
export interface BalanceHistoryPoint {
  date: Date;
  balance: number;
}

/**
 * Calculate balance history over time
 * 
 * Returns daily balance snapshots for the last N days.
 * Each point shows the cumulative balance up to that date.
 * 
 * @param transactions - Array of transactions (should be sorted by bookingDate)
 * @param days - Number of days to calculate history for
 * @returns Array of balance history points
 * 
 * @example
 * ```typescript
 * const history = calculateBalanceHistory(transactions, 30);
 * // Returns 30 data points showing daily balance
 * ```
 */
export function calculateBalanceHistory(
  transactions: Transaction[],
  days: number
): BalanceHistoryPoint[] {
  if (!transactions || transactions.length === 0 || days <= 0) {
    return [];
  }

  // Sort transactions by booking date (oldest first)
  const sortedTransactions = [...transactions].sort(
    (a, b) => a.bookingDate.getTime() - b.bookingDate.getTime()
  );

  // Calculate date range
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  // Initialize result array
  const history: BalanceHistoryPoint[] = [];
  let currentBalance = 0;
  let transactionIndex = 0;

  // Iterate through each day
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + i);
    currentDate.setHours(23, 59, 59, 999);

    // Add all transactions up to and including current date
    while (
      transactionIndex < sortedTransactions.length &&
      sortedTransactions[transactionIndex].bookingDate <= currentDate
    ) {
      currentBalance += sortedTransactions[transactionIndex].amount;
      transactionIndex++;
    }

    history.push({
      date: new Date(currentDate),
      balance: currentBalance,
    });
  }

  return history;
}

/**
 * Income and expense summary
 */
export interface IncomeExpenseSummary {
  income: number;
  expense: number;
}

/**
 * Calculate total income and expenses for a period
 * 
 * @param transactions - Array of transactions
 * @param period - 'month' for current month, 'year' for current year
 * @returns Object with income and expense totals (both positive values in cents)
 * 
 * @example
 * ```typescript
 * const summary = calculateIncomeExpense(transactions, 'month');
 * // { income: 300000, expense: 150000 }
 * ```
 */
export function calculateIncomeExpense(
  transactions: Transaction[],
  period: 'month' | 'year'
): IncomeExpenseSummary {
  if (!transactions || transactions.length === 0) {
    return { income: 0, expense: 0 };
  }

  // Calculate date range for period
  const now = new Date();
  const startDate = new Date(now);

  if (period === 'month') {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
  } else {
    // year
    startDate.setMonth(0, 1);
    startDate.setHours(0, 0, 0, 0);
  }

  // Filter transactions within period
  const periodTransactions = transactions.filter(
    (tx) => tx.bookingDate >= startDate
  );

  // Separate income (positive) and expenses (negative)
  let income = 0;
  let expense = 0;

  for (const transaction of periodTransactions) {
    if (transaction.amount > 0) {
      income += transaction.amount;
    } else if (transaction.amount < 0) {
      expense += Math.abs(transaction.amount);
    }
  }

  return { income, expense };
}

/**
 * Calculate spending breakdown by category
 * 
 * Returns the total amount (as positive value) for each category.
 * Only includes expenses (negative amounts).
 * 
 * @param transactions - Array of transactions
 * @returns Object mapping category to total amount in cents
 * 
 * @example
 * ```typescript
 * const breakdown = calculateCategoryBreakdown(transactions);
 * // { groceries: 50000, restaurants: 30000, ... }
 * ```
 */
export function calculateCategoryBreakdown(
  transactions: Transaction[]
): Record<TransactionCategory, number> {
  const breakdown: Record<TransactionCategory, number> = {
    groceries: 0,
    restaurants: 0,
    transport: 0,
    utilities: 0,
    entertainment: 0,
    shopping: 0,
    health: 0,
    income: 0,
    transfer: 0,
    other: 0,
  };

  if (!transactions || transactions.length === 0) {
    return breakdown;
  }

  for (const transaction of transactions) {
    const category = transaction.category || 'other';
    
    // Convert negative amounts to positive for breakdown
    // Income stays positive, expenses become positive
    const amount = Math.abs(transaction.amount);
    
    breakdown[category] += amount;
  }

  return breakdown;
}

/**
 * Average monthly summary
 */
export interface AverageMonthly {
  income: number;
  expense: number;
}

/**
 * Calculate average monthly income and expenses
 * 
 * Calculates averages based on the full month range of transactions.
 * If transactions span less than a month, returns the totals.
 * 
 * @param transactions - Array of transactions
 * @returns Object with average monthly income and expense in cents
 * 
 * @example
 * ```typescript
 * const avg = calculateAverageMonthly(transactions);
 * // { income: 400000, expense: 250000 }
 * ```
 */
export function calculateAverageMonthly(
  transactions: Transaction[]
): AverageMonthly {
  if (!transactions || transactions.length === 0) {
    return { income: 0, expense: 0 };
  }

  // Find date range
  const sortedTransactions = [...transactions].sort(
    (a, b) => a.bookingDate.getTime() - b.bookingDate.getTime()
  );

  const firstDate = sortedTransactions[0].bookingDate;
  const lastDate = sortedTransactions[sortedTransactions.length - 1].bookingDate;

  // Calculate number of months between first and last transaction
  const monthsDiff =
    (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
    (lastDate.getMonth() - firstDate.getMonth()) +
    1; // Include both start and end month

  // Calculate total income and expenses
  let totalIncome = 0;
  let totalExpense = 0;

  for (const transaction of transactions) {
    if (transaction.amount > 0) {
      totalIncome += transaction.amount;
    } else if (transaction.amount < 0) {
      totalExpense += Math.abs(transaction.amount);
    }
  }

  // Calculate averages
  const income = Math.round(totalIncome / monthsDiff);
  const expense = Math.round(totalExpense / monthsDiff);

  return { income, expense };
}
