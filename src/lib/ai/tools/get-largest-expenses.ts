import { tool } from "ai";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { classifyTransaction } from "@/lib/stats/categories";

import { isoDateParam, round2 } from "./shared";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const DESCRIPTION_MAX_LENGTH = 200;

const paramsSchema = z.object({
  startDate: isoDateParam(
    "Inclusive start date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  endDate: isoDateParam(
    "Inclusive end date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(
      `Maximum number of expenses to return, largest first. Defaults to ${DEFAULT_LIMIT}, max ${MAX_LIMIT}.`
    ),
});

export interface LargestExpenseEntry {
  readonly date: string;
  readonly amount: number;
  readonly description: string;
  readonly counterparty: string;
  readonly category: string;
}

export interface GetLargestExpensesResult {
  readonly expenses: readonly LargestExpenseEntry[];
  readonly totalMatches: number;
}

export const getLargestExpensesTool = tool({
  description:
    "Returns the single largest individual expenses (by absolute amount, EUR) in a period, most expensive first. Internal transfers between the user's own accounts are excluded. Use this to answer 'what was my biggest expense' style questions.",
  inputSchema: paramsSchema,
  execute: async ({
    startDate,
    endDate,
    limit,
  }): Promise<GetLargestExpensesResult> => {
    const matches = await getTransactions(
      { startDate, endDate, direction: "debit" },
      { excludeInternal: true }
    );

    const sorted = [...matches].sort(
      (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
    );

    const effectiveLimit = limit ?? DEFAULT_LIMIT;

    const expenses: LargestExpenseEntry[] = sorted
      .slice(0, effectiveLimit)
      .map((tx) => ({
        date: tx.bookingDate,
        amount: round2(tx.amount),
        description:
          tx.description.length > DESCRIPTION_MAX_LENGTH
            ? `${tx.description.slice(0, DESCRIPTION_MAX_LENGTH)}…`
            : tx.description,
        counterparty: tx.counterparty,
        category:
          tx.category ?? classifyTransaction(tx.description, tx.counterparty),
      }));

    return { expenses, totalMatches: sorted.length };
  },
});
