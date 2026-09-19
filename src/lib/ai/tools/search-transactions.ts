import { tool } from "ai";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { CATEGORIES, classifyTransaction } from "@/lib/stats/categories";

import { isoDateParam, round2 } from "./shared";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DESCRIPTION_MAX_LENGTH = 200;

const CATEGORY_LIST = CATEGORIES.join(", ");

const paramsSchema = z.object({
  search: z
    .string()
    .describe(
      "Free-text search matched against transaction description, counterparty, and (when the bank provides it) merchant name/category metadata. Case- and diacritic-insensitive (e.g. 'munchen'/'muenchen' both match 'München'). Accepts multiple space-separated terms matched as OR — a transaction matches if ANY term is found (e.g. 'hotel flug bahn' matches transactions containing 'hotel' OR 'flug' OR 'bahn'). To answer a thematic question like 'what did I spend on my trip', do NOT search for a literal word like 'vacation' — it will not appear in real transaction text. Instead combine several relevant merchant/description terms here (e.g. 'hotel flug taxi restaurant') with startDate/endDate, and/or use category: 'Travel'."
    )
    .optional(),
  category: z
    .string()
    .describe(
      `Category to filter by. Matched against each transaction's classified category — derived automatically via keyword rules when the bank doesn't supply one, exactly like the rest of this app (NOT a literal database field lookup), so this reliably matches real synced transactions. One of: ${CATEGORY_LIST}. For thematic spending like a trip, prefer category: 'Travel' (covers airlines, hotels, booking platforms, car rental, and travel-adjacent costs) optionally combined with a multi-term 'search' and a date range.`
    )
    .optional(),
  startDate: isoDateParam(
    "Inclusive start date (YYYY-MM-DD). Omit to include all history. Combine with endDate and a multi-term search to scope a query to a specific trip or period."
  ).optional(),
  endDate: isoDateParam(
    "Inclusive end date (YYYY-MM-DD). Omit to include all history. Combine with startDate and a multi-term search to scope a query to a specific trip or period."
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
      `Maximum number of transactions to return, most recent first. Defaults to ${DEFAULT_LIMIT}, max ${MAX_LIMIT}. Check the returned "truncated" flag and "totalMatches" — a capped list is never the full result set.`
    ),
});

export interface SearchTransactionEntry {
  readonly date: string;
  readonly amount: number;
  readonly description: string;
  readonly counterparty: string;
  readonly category: string;
}

/** Echoes back exactly what was searched for, so the model (and any UI
 * consuming this tool's output) can state precisely what scope it searched
 * rather than implying a broader search than what actually ran. */
export interface SearchTransactionsAppliedFilters {
  readonly search: string | null;
  readonly category: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly direction: "debit" | "credit" | null;
  readonly minAmount: number | null;
  readonly maxAmount: number | null;
  readonly limit: number;
}

export interface SearchTransactionsResult {
  readonly transactions: readonly SearchTransactionEntry[];
  readonly totalMatches: number;
  /** True when `totalMatches` exceeds the returned `transactions` array —
   * i.e. this is a partial result, not the complete set of matches. */
  readonly truncated: boolean;
  /** Always present, plain-language guidance on how to read this result:
   * explicitly states whether nothing matched, whether the list was capped,
   * or that it is complete. Exists so the model cannot mistake a partial or
   * empty result for tool failure and improvise transactions. */
  readonly note: string;
  readonly appliedFilters: SearchTransactionsAppliedFilters;
}

/**
 * The only finance tool that returns individual transaction line items — all
 * other tools return aggregated statistics. Internal transfers are NOT
 * excluded here (mirrors the transactions list page), since the user may be
 * looking for a specific transfer.
 *
 * Amounts are always in EUR; sign is meaningful and never ambiguous —
 * negative `amount` = money out (an expense/debit), positive `amount` =
 * money in (income/credit).
 */
export const searchTransactionsTool = tool({
  description:
    "Searches individual transactions by free text, category, date range, direction (debit/credit), and amount range. Returns at most `limit` transactions (most recent first, EUR amounts where negative = expense and positive = income) plus `totalMatches`, a `truncated` flag, a plain-language `note`, and the `appliedFilters` that were actually used. Always read `truncated`/`note` before treating the returned list as complete — never assume or invent transactions beyond what is returned. This is the only finance tool that returns individual transaction details — use aggregate tools instead when a summary suffices.",
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
    const totalMatches = matches.length;

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

    const truncated = totalMatches > transactions.length;

    let note: string;
    if (totalMatches === 0) {
      note =
        "No transactions matched these filters. Do not invent transactions; report that nothing was found and suggest broadening the date range or search terms.";
    } else if (truncated) {
      note = `Showing ${transactions.length} of ${totalMatches} matching transactions (most recent first). ${totalMatches - transactions.length} additional matching transaction(s) exist but are NOT included below — do not treat this list as complete; narrow the filters or increase "limit" (max ${MAX_LIMIT}) to see more.`;
    } else {
      note = `All ${totalMatches} matching transaction(s) are included below — this is the complete result set for the applied filters.`;
    }

    return {
      transactions,
      totalMatches,
      truncated,
      note,
      appliedFilters: {
        search: search ?? null,
        category: category ?? null,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
        direction: direction ?? null,
        minAmount: minAmount ?? null,
        maxAmount: maxAmount ?? null,
        limit: effectiveLimit,
      },
    };
  },
});
