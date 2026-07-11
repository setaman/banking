import { tool } from "ai";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import type { UnifiedTransaction } from "@/lib/banking/types";
import {
  calculateSavingsRate,
  calculateTopCategories,
} from "@/lib/stats/calculations";

import { isoDateParam, percentChange, round2 } from "./shared";

const TOP_CATEGORIES_LIMIT = 5;

const paramsSchema = z.object({
  period1Start: isoDateParam(
    "Inclusive start date (YYYY-MM-DD) of the first (baseline) period."
  ),
  period1End: isoDateParam(
    "Inclusive end date (YYYY-MM-DD) of the first (baseline) period."
  ),
  period2Start: isoDateParam(
    "Inclusive start date (YYYY-MM-DD) of the second (comparison) period."
  ),
  period2End: isoDateParam(
    "Inclusive end date (YYYY-MM-DD) of the second (comparison) period."
  ),
});

export interface PeriodSummary {
  readonly income: number;
  readonly expenses: number;
  readonly net: number;
  readonly savingsRate: number;
  readonly topCategories: readonly {
    readonly category: string;
    readonly amount: number;
    readonly percentage: number;
  }[];
}

export interface ComparePeriodsResult {
  readonly period1: PeriodSummary;
  readonly period2: PeriodSummary;
  readonly changes: {
    /** Percentage change in income from period 1 to period 2. `null` when period 1 income is 0 and period 2 is not. */
    readonly incomeChange: number | null;
    /** Percentage change in expenses from period 1 to period 2. `null` when period 1 expenses is 0 and period 2 is not. */
    readonly expenseChange: number | null;
    /** Percentage change in net cash flow from period 1 to period 2. `null` when period 1 net is 0 and period 2 is not. */
    readonly netChange: number | null;
    /** Percentage-point difference in savings rate (period2 - period1), e.g. +5 means 5pp higher. */
    readonly savingsRateChange: number;
  };
}

function summarizePeriod(
  transactions: readonly UnifiedTransaction[]
): PeriodSummary {
  const income = transactions
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = Math.abs(
    transactions
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const savingsRate = calculateSavingsRate([...transactions]).rate;
  const topCategories = calculateTopCategories(
    [...transactions],
    TOP_CATEGORIES_LIMIT
  ).map((entry) => ({
    category: entry.category,
    amount: round2(entry.amount),
    percentage: round2(entry.percentage),
  }));

  return {
    income: round2(income),
    expenses: round2(expenses),
    net: round2(income - expenses),
    savingsRate: round2(savingsRate),
    topCategories,
  };
}

/**
 * Composite tool: composes existing single-period statistics functions
 * (`calculateSavingsRate`, `calculateTopCategories`) for two independent
 * periods rather than reimplementing any calculation.
 */
export const comparePeriodsTool = tool({
  description:
    "Compares income, expenses, net cash flow, savings rate, and top spending categories between two date ranges, in EUR, and returns the percentage change between them (e.g. period 1 = last month, period 2 = this month). Use this for 'how does this month compare to last month' style questions.",
  inputSchema: paramsSchema,
  execute: async ({
    period1Start,
    period1End,
    period2Start,
    period2End,
  }): Promise<ComparePeriodsResult> => {
    const [period1Transactions, period2Transactions] = await Promise.all([
      getTransactions(
        { startDate: period1Start, endDate: period1End },
        { excludeInternal: true }
      ),
      getTransactions(
        { startDate: period2Start, endDate: period2End },
        { excludeInternal: true }
      ),
    ]);

    const period1 = summarizePeriod(period1Transactions);
    const period2 = summarizePeriod(period2Transactions);

    return {
      period1,
      period2,
      changes: {
        incomeChange: percentChange(period1.income, period2.income),
        expenseChange: percentChange(period1.expenses, period2.expenses),
        netChange: percentChange(period1.net, period2.net),
        savingsRateChange: round2(period2.savingsRate - period1.savingsRate),
      },
    };
  },
});
