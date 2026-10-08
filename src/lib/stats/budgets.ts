/**
 * Pure budget-progress calculations (no I/O).
 *
 * Spent amounts cover the current calendar month (by `bookingDate`),
 * debit transactions only, excluding internal transfers. Categories are
 * resolved like everywhere else: stored category, else `classifyTransaction`.
 */

import { isInternalTransfer } from "@/lib/banking/internal-transfer";
import type { UnifiedTransaction } from "@/lib/banking/types";
import type { Budget } from "@/lib/db/schema";
import { classifyTransaction } from "@/lib/stats/categories";

/** Usage thresholds: "warning" at >= 80%, "over" above 100%. */
export const BUDGET_WARNING_THRESHOLD = 80;

export type BudgetStatus = "ok" | "warning" | "over";

export interface BudgetProgress {
  budget: Budget;
  /** Spent so far this month (>= 0). */
  spent: number;
  /** Limit minus spent; negative when over budget. */
  remaining: number;
  /** spent / limit * 100 (not capped). */
  percentUsed: number;
  status: BudgetStatus;
  /** Linear extrapolation: spent / dayOfMonth * daysInMonth. */
  projectedMonthEnd: number;
  projectedStatus: BudgetStatus;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function statusFor(percent: number): BudgetStatus {
  if (percent > 100) return "over";
  if (percent >= BUDGET_WARNING_THRESHOLD) return "warning";
  return "ok";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Computes progress of one budget for the calendar month containing `now`.
 * Transactions dated after `now` (future-dated/pending) are ignored.
 *
 * @param budget - The budget to evaluate.
 * @param transactions - Candidate transactions (any month/direction).
 * @param now - Reference date, defaults to the current time.
 * @returns Progress including projected month-end spending.
 */
export function computeBudgetProgress(
  budget: Budget,
  transactions: readonly UnifiedTransaction[],
  now: Date = new Date()
): BudgetProgress {
  const year = now.getFullYear();
  const month = now.getMonth();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prefix = `${year}-${pad(month + 1)}-`;
  const today = `${prefix}${pad(dayOfMonth)}`;

  let total = 0;
  for (const tx of transactions) {
    const booked = tx.bookingDate.slice(0, 10);
    if (!booked.startsWith(prefix) || booked > today) continue;
    if (tx.direction !== "debit" || isInternalTransfer(tx)) continue;
    const category =
      tx.category || classifyTransaction(tx.description, tx.counterparty);
    if (category !== budget.category) continue;
    total += Math.abs(tx.amount);
  }

  const spent = round2(total);
  const limit = budget.monthlyLimit;
  const hasLimit = Number.isFinite(limit) && limit > 0;
  const percentUsed = hasLimit
    ? (spent / limit) * 100
    : spent > 0
      ? Infinity
      : 0;
  const projectedMonthEnd = round2((spent / dayOfMonth) * daysInMonth);
  const projectedPercent = hasLimit
    ? (projectedMonthEnd / limit) * 100
    : projectedMonthEnd > 0
      ? Infinity
      : 0;

  return {
    budget,
    spent,
    remaining: round2((hasLimit ? limit : 0) - spent),
    percentUsed: Number.isFinite(percentUsed)
      ? Math.round(percentUsed * 10) / 10
      : 100,
    status: statusFor(percentUsed),
    projectedMonthEnd,
    projectedStatus: statusFor(projectedPercent),
  };
}

/**
 * Computes progress for all budgets, sorted by `percentUsed` descending.
 *
 * @param budgets - Budgets to evaluate.
 * @param transactions - Candidate transactions.
 * @param now - Reference date, defaults to the current time.
 * @returns Progress entries, most-used budget first.
 */
export function computeAllBudgetProgress(
  budgets: readonly Budget[],
  transactions: readonly UnifiedTransaction[],
  now: Date = new Date()
): BudgetProgress[] {
  return budgets
    .map((b) => computeBudgetProgress(b, transactions, now))
    .sort((a, b) => b.percentUsed - a.percentUsed);
}
