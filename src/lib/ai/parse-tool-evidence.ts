/**
 * parse-tool-evidence — defensive zod parsing of the two finance tools that
 * return individual transaction line items (`search_transactions`,
 * `get_largest_expenses`). This is the only place `part.output` is read at
 * the UI layer; every other tool returns aggregated statistics that are
 * still narrated in prose.
 *
 * `part.output` is `unknown` here — it can be malformed (a future tool
 * change, a provider quirk) or stale (a conversation restored from
 * localStorage against an older tool shape). Parsing is fully defensive via
 * `safeParse`: any mismatch returns `null` rather than throwing, so a bad
 * tool output can never crash the chat — it simply means no evidence panel
 * is rendered for that tool call.
 *
 * Zod object schemas strip unknown keys by default (confirmed against the
 * zod 4 installed in this repo), so the backend is free to return additional
 * fields (`note`, `appliedFilters`, ...) without this parser needing to list
 * every one of them. Every field beyond the row arrays themselves is kept
 * optional so the panel still degrades gracefully if a field is absent
 * (e.g. an older persisted conversation, or a future tool trimming a field).
 */

import { z } from "zod";

/**
 * Validates a REQUIRED date string as ISO `YYYY-MM-DD` via `z.iso.date()`,
 * but never fails the parse on a malformed value — `.catch()` substitutes
 * the original raw value instead (or `""` if the value wasn't even a
 * string).
 *
 * Why not just `z.iso.date()` directly: this schema sits inside
 * `z.array(transactionEntrySchema)`, and `safeParse` fails an array (and
 * everything nested above it) the moment ANY single element fails ANY
 * field. Given this module's `null`-on-failure contract (see the file
 * banner above), one row with a stale/provider-malformed date would
 * silently blank out the ENTIRE evidence panel — including every other,
 * perfectly valid row — which is a strictly worse outcome than rendering
 * that one row's raw date string. The panel already renders defensively:
 * `formatShortDate`/`buildDateRangeText` in `tool-evidence-panel.tsx` wrap
 * `date-fns` parsing in `try`/`catch` and fall back to the raw string on
 * failure, so a malformed value here degrades to an odd-looking date cell
 * rather than a crash or a missing panel.
 */
const lenientIsoDate = z.iso
  .date()
  .catch((ctx) => (typeof ctx.value === "string" ? ctx.value : ""));

/**
 * Same reasoning as `lenientIsoDate`, but for optional/nullable date
 * strings (`appliedFilters.startDate`/`endDate`). These are pure
 * provenance metadata (used only to render the "Searched: ..." caption),
 * so a malformed value here has even less business taking down the whole
 * transaction table than a malformed row date would. Also closes a
 * pre-existing hole: the previous bare `z.string().nullable().optional()`
 * already failed the ENTIRE parse for a non-string value (e.g. a stray
 * number) — `.catch()` now degrades that case to `null` instead.
 */
const lenientIsoDateNullable = z.iso
  .date()
  .nullable()
  .optional()
  .catch((ctx) => (typeof ctx.value === "string" ? ctx.value : null));

const transactionEntrySchema = z.object({
  date: lenientIsoDate,
  amount: z.number(),
  description: z.string(),
  counterparty: z.string(),
  category: z.string(),
});

export type TransactionEntry = z.infer<typeof transactionEntrySchema>;

/** Mirrors `SearchTransactionsAppliedFilters` — kept independent (not
 * imported) so this UI-layer parser has no compile-time coupling to the
 * tool implementation. Every field is optional/nullable so a partially
 * shaped or missing `appliedFilters` object still parses. */
const appliedFiltersSchema = z.object({
  search: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  startDate: lenientIsoDateNullable,
  endDate: lenientIsoDateNullable,
  direction: z.enum(["debit", "credit"]).nullable().optional(),
  minAmount: z.number().nullable().optional(),
  maxAmount: z.number().nullable().optional(),
});

export type AppliedFilters = z.infer<typeof appliedFiltersSchema>;

const searchTransactionsOutputSchema = z.object({
  transactions: z.array(transactionEntrySchema),
  totalMatches: z.number().int().nonnegative(),
  // Preferred truncation signal — an explicit flag is more trustworthy than
  // inferring it, but it's optional so older/stale outputs still parse.
  truncated: z.boolean().optional(),
  appliedFilters: appliedFiltersSchema.optional(),
});

const getLargestExpensesOutputSchema = z.object({
  expenses: z.array(transactionEntrySchema),
  totalMatches: z.number().int().nonnegative(),
  truncated: z.boolean().optional(),
});

/** Which noun to use in the panel's provenance copy ("N transactions found"
 * vs "N expenses found"). */
export type EvidenceRowLabel = "transactions" | "expenses";

export interface TransactionEvidence {
  readonly toolName: string;
  readonly rows: readonly TransactionEntry[];
  readonly totalMatches: number;
  /** True when the returned rows are a partial result. Prefers the tool's
   * own `truncated` flag; falls back to `totalMatches > rows.length` when
   * the flag is absent. */
  readonly truncated: boolean;
  readonly rowLabel: EvidenceRowLabel;
  /** Only present for `search_transactions` — the filters actually applied,
   * so the panel can show what was searched for, not just that data came
   * back. `null` when the tool doesn't provide it (or isn't a search). */
  readonly appliedFilters: AppliedFilters | null;
}

/**
 * Validates and normalizes a tool's raw `output` into evidence the panel can
 * render. Returns `null` for any tool other than `search_transactions` /
 * `get_largest_expenses`, or when the output fails validation.
 */
export function parseTransactionEvidence(
  toolName: string,
  output: unknown
): TransactionEvidence | null {
  if (toolName === "search_transactions") {
    const result = searchTransactionsOutputSchema.safeParse(output);
    if (!result.success) return null;
    const { transactions, totalMatches, truncated, appliedFilters } =
      result.data;
    return {
      toolName,
      rows: transactions,
      totalMatches,
      truncated: truncated ?? totalMatches > transactions.length,
      rowLabel: "transactions",
      appliedFilters: appliedFilters ?? null,
    };
  }

  if (toolName === "get_largest_expenses") {
    const result = getLargestExpensesOutputSchema.safeParse(output);
    if (!result.success) return null;
    const { expenses, totalMatches, truncated } = result.data;
    return {
      toolName,
      rows: expenses,
      totalMatches,
      truncated: truncated ?? totalMatches > expenses.length,
      rowLabel: "expenses",
      appliedFilters: null,
    };
  }

  return null;
}
