import { tool } from "ai";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { detectRecurring } from "@/lib/stats/categories";

import { isoDateParam, round2 } from "./shared";

const paramsSchema = z.object({
  startDate: isoDateParam(
    "Inclusive start date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  endDate: isoDateParam(
    "Inclusive end date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
});

const MAX_RESULTS = 20;

export interface RecurringExpenseEntry {
  readonly counterparty: string;
  readonly averageAmount: number;
  readonly category: string;
  readonly occurrences: number;
  readonly averageIntervalDays: number;
}

export interface GetRecurringExpensesResult {
  readonly recurringExpenses: readonly RecurringExpenseEntry[];
}

export const getRecurringExpensesTool = tool({
  description:
    "Detects recurring expenses (subscriptions, rent, memberships) — same counterparty, similar amount, roughly monthly interval — and returns each as a summary (counterparty, average amount in EUR, category, occurrence count, average interval in days). Never returns individual transaction line items. Use this to answer 'what subscriptions/recurring payments do I have' style questions.",
  inputSchema: paramsSchema,
  execute: async ({
    startDate,
    endDate,
  }): Promise<GetRecurringExpensesResult> => {
    const transactions = await getTransactions(
      { startDate, endDate },
      { excludeInternal: true }
    );

    const recurringExpenses = detectRecurring(transactions)
      .slice(0, MAX_RESULTS)
      .map((group) => ({
        counterparty: group.counterparty,
        averageAmount: round2(group.averageAmount),
        category: group.category,
        occurrences: group.transactions.length,
        averageIntervalDays: round2(group.averageInterval),
      }));

    return { recurringExpenses };
  },
});
