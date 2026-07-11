import { tool } from "ai";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { classifyTransaction } from "@/lib/stats/categories";

import { isoDateParam, round2 } from "./shared";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DESCRIPTION_MAX_LENGTH = 200;

const paramsSchema = z.object({
  search: z
    .string()
    .describe(
      "Free-text search matched against transaction description and counterparty (case-insensitive substring match)."
    )
    .optional(),
  category: z
    .string()
    .describe(
      "Exact category name to filter by (e.g. 'Groceries', 'Rent', 'Dining'). Only matches transactions with this exact stored category."
    )
    .optional(),
  startDate: isoDateParam(
    "Inclusive start date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  endDate: isoDateParam(
    "Inclusive end date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  direction: z
    .enum(["debit", "credit"])
    .describe("Filter to only expenses ('debit') or only income ('credit').")
    .optional(),
  minAmount: z
    .number()
    .min(0)
    .describe("Minimum absolute transaction amount in EUR.")
    .optional(),
  maxAmount: z
    .number()
    .min(0)
    .describe("Maximum absolute transaction amount in EUR.")
    .optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(
      `Maximum number of transactions to return, most recent first. Defaults to ${DEFAULT_LIMIT}, max ${MAX_LIMIT}.`
    ),
});

export interface SearchTransactionEntry {
  readonly date: string;
  readonly amount: number;
  readonly description: string;
  readonly counterparty: string;
  readonly category: string;
}

export interface SearchTransactionsResult {
  readonly transactions: readonly SearchTransactionEntry[];
  readonly totalMatches: number;
}

/**
 * The only finance tool that returns individual transaction line items — all
 * other tools return aggregated statistics. Internal transfers are NOT
 * excluded here (mirrors the transactions list page), since the user may be
 * looking for a specific transfer.
 */
export const searchTransactionsTool = tool({
  description:
    "Searches individual transactions by free text, category, date range, direction (debit/credit), and amount range. Returns at most `limit` transactions (most recent first) plus the total number of matches, in EUR. This is the only finance tool that returns individual transaction details — use aggregate tools instead when a summary suffices.",
  inputSchema: paramsSchema,
  execute: async ({
    search,
    category,
    startDate,
    endDate,
    direction,
    minAmount,
    maxAmount,
    limit,
  }): Promise<SearchTransactionsResult> => {
    const matches = await getTransactions({
      search,
      category,
      startDate,
      endDate,
      direction,
      minAmount,
      maxAmount,
    });

    const effectiveLimit = limit ?? DEFAULT_LIMIT;

    const transactions: SearchTransactionEntry[] = matches
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

    return { transactions, totalMatches: matches.length };
  },
});
