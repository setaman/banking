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
  /** True when `totalMatches` exceeds the returned `expenses` array — i.e.
   * this is a partial result, not the complete set of matching expenses. */
  readonly truncated: boolean;
  /** Always present, plain-language guidance on how to read this result:
   * explicitly states whether nothing matched, whether the list was capped,
   * or that it is complete — so a partial or empty result can never be
   * mistaken for tool failure and cause invented transactions. */
  readonly note: string;
}

export const getLargestExpensesTool = tool({
  description:
    "Returns the single largest individual expenses (by absolute amount, EUR; amounts are negative, since these are expenses) in a period, most expensive first. Internal transfers between the user's own accounts are excluded. Returns `totalMatches`, a `truncated` flag, and a plain-language `note` — always check these before treating the list as complete. Use this to answer 'what was my biggest expense' style questions.",
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
    const totalMatches = sorted.length;

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

    const truncated = totalMatches > expenses.length;

    let note: string;
    if (totalMatches === 0) {
      note =
        "No expenses matched this period. Do not invent transactions; report that nothing was found and suggest broadening the date range.";
    } else if (truncated) {
      note = `Showing the top ${expenses.length} of ${totalMatches} matching expenses (largest first). ${totalMatches - expenses.length} smaller matching expense(s) exist but are NOT included below — do not treat this list as complete; increase "limit" (max ${MAX_LIMIT}) to see more.`;
    } else {
      note = `All ${totalMatches} matching expense(s) are included below — this is the complete result set for the applied filters.`;
    }

    return { expenses, totalMatches, truncated, note };
  },
});
