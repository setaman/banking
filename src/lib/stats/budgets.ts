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

/** Rounds to two decimal places. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Maps a usage percentage to a {@link BudgetStatus}. */
function statusFor(percent: number): BudgetStatus {
  if (percent > 100) return "over";
  if (percent >= BUDGET_WARNING_THRESHOLD) return "warning";
  return "ok";
}

/** Timezone in which budget months roll over (bookingDate is a Berlin date). */
export const BUDGET_TIMEZONE = "Europe/Berlin";

/** Calendar facts about "today" in {@link BUDGET_TIMEZONE}. */
export interface BudgetCalendarToday {
  /** Today as yyyy-MM-dd. */
  today: string;
  /** Month prefix "yyyy-MM-". */
  prefix: string;
  year: number;
  /** 1-based month. */
  month: number;
  dayOfMonth: number;
  daysInMonth: number;
  /** Days left in the month including today. */
  daysLeft: number;
}

/**
 * Resolves the current calendar date in {@link BUDGET_TIMEZONE}, independent
 * of the server/browser timezone, so client and server agree.
 *
 * @param now - Reference instant, defaults to the current time.
 * @returns Today's date parts, e.g. 2026-10-31T23:30Z gives 2026-11-01.
 */
export function getBudgetCalendarToday(
  now: Date = new Date()
): BudgetCalendarToday {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUDGET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, dayOfMonth] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    today,
    prefix: today.slice(0, 8),
    year,
    month,
    dayOfMonth,
    daysInMonth,
    daysLeft: daysInMonth - dayOfMonth + 1,
  };
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
  const { prefix, today, dayOfMonth, daysInMonth } =
    getBudgetCalendarToday(now);

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
