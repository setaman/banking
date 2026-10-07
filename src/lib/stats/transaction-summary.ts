/**
 * Transaction summary for the Transactions page summary strip.
 *
 * Pure, synchronous aggregation over the currently visible (filtered)
 * transactions. Income/expense semantics deliberately mirror
 * `getDashboardStats` in `src/actions/stats.actions.ts` so the strip agrees
 * with the dashboard KPIs:
 *
 * - Internal transfers (`category === "internal-transfer"` or the sync flag
 *   `raw.__internalTransfer`) are excluded, exactly like the dashboard's
 *   `excludeInternal` option.
 * - Income = sum of `amount` for `direction === "credit"`.
 * - Expenses = sum of `Math.abs(amount)` for `direction === "debit"`
 *   (reported as a positive number).
 * - Net cash flow = income - expenses.
 * - Largest single expense (PRD §5.3 K11) reuses `findLargestExpense`.
 */

import type { UnifiedTransaction } from "@/lib/banking/types";
import { findLargestExpense } from "@/lib/stats/calculations";

/** Details of the single largest expense within a summary. */
export interface LargestExpenseSummary {
  /** Transaction description. */
  readonly description: string;
  /** Counterparty name (may be an empty string). */
  readonly counterparty: string;
  /** Absolute (positive) expense amount in EUR. */
  readonly amount: number;
  /** Booking date (ISO 8601, YYYY-MM-DD). */
  readonly date: string;
}

/** Aggregated figures for a list of transactions. */
export interface TransactionSummary {
  /** Sum of credit amounts, excluding internal transfers. */
  readonly totalIncome: number;
  /** Sum of absolute debit amounts (positive), excluding internal transfers. */
  readonly totalExpenses: number;
  /** `totalIncome - totalExpenses`. */
  readonly netCashFlow: number;
  /** Largest single expense, or `null` when there are no expenses. */
  readonly largestExpense: LargestExpenseSummary | null;
  /** Number of transactions passed in (including internal transfers). */
  readonly transactionCount: number;
}

/** Whether a transaction is an internal transfer (mirrors `excludeInternal`). */
function isInternalTransfer(tx: UnifiedTransaction): boolean {
  return (
    tx.category === "internal-transfer" ||
    Boolean(
      tx.raw && (tx.raw as { __internalTransfer?: unknown }).__internalTransfer
    )
  );
}

/**
 * Computes income, expense, net cash flow and largest-expense figures for the
 * given transactions in a single pass.
 *
 * @param transactions - The currently filtered/visible transactions.
 * @returns The aggregated {@link TransactionSummary}.
 */
export function computeTransactionSummary(
  transactions: readonly UnifiedTransaction[]
): TransactionSummary {
  let totalIncome = 0;
  let totalExpenses = 0;
  const debits: UnifiedTransaction[] = [];

  for (const tx of transactions) {
    if (isInternalTransfer(tx)) continue;

    if (tx.direction === "credit") {
      totalIncome += tx.amount;
    } else if (tx.direction === "debit") {
      totalExpenses += Math.abs(tx.amount);
      debits.push(tx);
    }
  }

  const { transaction } = findLargestExpense(debits);

  return {
    totalIncome,
    totalExpenses,
    netCashFlow: totalIncome - totalExpenses,
    largestExpense: transaction
      ? {
          description: transaction.description,
          counterparty: transaction.counterparty,
          amount: Math.abs(transaction.amount),
          date: transaction.bookingDate,
        }
      : null,
    transactionCount: transactions.length,
  };
}
