"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronUp, Info, SearchX } from "lucide-react";

import {
  DataTable,
  type ColumnAlign,
} from "@/components/assistant/charts/data-table";
import type {
  AppliedFilters,
  TransactionEntry,
  TransactionEvidence,
} from "@/lib/ai/parse-tool-evidence";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE_ROWS = 8;
const DESCRIPTION_TRUNCATE_LENGTH = 60;

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const signedCurrencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  signDisplay: "always",
});

// ---------------------------------------------------------------------------
// Provenance derivation — all computed purely from the returned rows (no
// extra tool call), so the header can never say something the data doesn't
// already show.
// ---------------------------------------------------------------------------

function formatShortDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd.MM.yyyy");
  } catch {
    return iso;
  }
}

/**
 * `DD.MM.YYYY` for a single date, `DD.MM–DD.MM.YYYY` when both ends fall in
 * the same year, or `DD.MM.YYYY–DD.MM.YYYY` across a year boundary. Dates
 * are ISO `YYYY-MM-DD` strings, so lexicographic min/max is also
 * chronological min/max — no `Date` parsing needed to find the range ends.
 */
function buildDateRangeText(rows: readonly TransactionEntry[]): string | null {
  if (rows.length === 0) return null;
  let minIso = rows[0].date;
  let maxIso = rows[0].date;
  for (const row of rows) {
    if (row.date < minIso) minIso = row.date;
    if (row.date > maxIso) maxIso = row.date;
  }
  if (minIso === maxIso) return formatShortDate(minIso);

  try {
    const minDate = parseISO(minIso);
    const maxDate = parseISO(maxIso);
    const sameYear = minDate.getFullYear() === maxDate.getFullYear();
    return sameYear
      ? `${format(minDate, "dd.MM")}–${format(maxDate, "dd.MM.yyyy")}`
      : `${format(minDate, "dd.MM.yyyy")}–${format(maxDate, "dd.MM.yyyy")}`;
  } catch {
    return `${minIso}–${maxIso}`;
  }
}

/**
 * The third provenance segment. For `search_transactions`, sums the
 * returned rows and labels the (always positive, absolute) figure by what
 * kind of rows they are — "total" for an all-expense result (the common
 * case: "how much did I spend on X"), "income" when all rows are credits,
 * "net" for a mixed result. For `get_largest_expenses`, a top-N list of the
 * biggest expenses is not a complete spending total for any period, so a
 * sum would overstate what the figure represents — a static label is shown
 * instead.
 */
function buildAmountSegment(evidence: TransactionEvidence): string | null {
  if (evidence.rows.length === 0) return null;
  if (evidence.rowLabel === "expenses") return "largest expenses";

  const sum = evidence.rows.reduce((total, row) => total + row.amount, 0);
  const allExpenses = evidence.rows.every((row) => row.amount < 0);
  const allIncome = evidence.rows.every((row) => row.amount > 0);
  const label = allExpenses ? "total" : allIncome ? "income" : "net";
  return `${currencyFormatter.format(Math.abs(sum))} ${label}`;
}

function buildCountText(evidence: TransactionEvidence): string {
  const returnedCount = evidence.rows.length;
  if (evidence.totalMatches > returnedCount) {
    return `${returnedCount} of ${evidence.totalMatches} ${evidence.rowLabel} shown`;
  }
  return `${returnedCount} ${evidence.rowLabel} found`;
}

function buildProvenanceParts(evidence: TransactionEvidence): string[] {
  return [
    buildCountText(evidence),
    buildDateRangeText(evidence.rows),
    buildAmountSegment(evidence),
  ].filter((part): part is string => part !== null);
}

/**
 * "Searched: hotel flug · Travel · 01.08–22.08.2026" — surfaces what was
 * actually searched for, so the client can verify the assistant looked for
 * the right thing, not merely that real rows came back. Rendered as a
 * separate, more muted line below the main provenance header rather than
 * folded into it, so it can't crowd the header's own count/date/total on
 * narrow screens. Omitted entirely when no filter beyond `limit` was
 * applied (an unscoped search has nothing meaningful to report here).
 */
function buildAppliedFiltersText(
  filters: AppliedFilters | null
): string | null {
  if (!filters) return null;
  const parts: string[] = [];
  if (filters.search) parts.push(filters.search);
  if (filters.category) parts.push(filters.category);

  const dateRange =
    filters.startDate && filters.endDate
      ? `${formatShortDate(filters.startDate)}–${formatShortDate(filters.endDate)}`
      : filters.startDate
        ? `from ${formatShortDate(filters.startDate)}`
        : filters.endDate
          ? `until ${formatShortDate(filters.endDate)}`
          : null;
  if (dateRange) parts.push(dateRange);

  if (filters.direction === "debit") parts.push("expenses only");
  else if (filters.direction === "credit") parts.push("income only");

  const minText =
    filters.minAmount !== null && filters.minAmount !== undefined
      ? currencyFormatter.format(filters.minAmount)
      : null;
  const maxText =
    filters.maxAmount !== null && filters.maxAmount !== undefined
      ? currencyFormatter.format(filters.maxAmount)
      : null;
  if (minText && maxText) parts.push(`${minText}–${maxText}`);
  else if (minText) parts.push(`≥ ${minText}`);
  else if (maxText) parts.push(`≤ ${maxText}`);

  return parts.length > 0 ? parts.join(" · ") : null;
}

// ---------------------------------------------------------------------------
// Table cell rendering
// ---------------------------------------------------------------------------

const COLUMN_HEADERS: readonly ReactNode[] = [
  <span key="h-date">Date</span>,
  <span key="h-counterparty">Counterparty</span>,
  <span key="h-description" className="hidden md:inline">
    Description
  </span>,
  <span key="h-category">Category</span>,
  <span key="h-amount">Amount</span>,
];

const COLUMN_ALIGNS: readonly ColumnAlign[] = [
  "left",
  "left",
  "left",
  "left",
  "right",
];

function truncateDescription(description: string): string {
  return description.length > DESCRIPTION_TRUNCATE_LENGTH
    ? `${description.slice(0, DESCRIPTION_TRUNCATE_LENGTH)}...`
    : description;
}

function buildTableRows(
  rows: readonly TransactionEntry[]
): readonly (readonly ReactNode[])[] {
  return rows.map((row, i) => [
    <span key={`date-${i}`} className="tabular-nums">
      {formatShortDate(row.date)}
    </span>,
    <span
      key={`counterparty-${i}`}
      className="block max-w-[200px] truncate font-medium"
      title={row.counterparty}
    >
      {row.counterparty}
    </span>,
    <span
      key={`description-${i}`}
      className="text-muted-foreground hidden max-w-[240px] truncate md:block"
      title={row.description}
    >
      {truncateDescription(row.description)}
    </span>,
    <span
      key={`category-${i}`}
      className="bg-muted rounded-full px-2 py-0.5 text-[11px]"
    >
      {row.category}
    </span>,
    <span
      key={`amount-${i}`}
      className={cn(
        "font-medium whitespace-nowrap tabular-nums",
        row.amount > 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-foreground"
      )}
    >
      {signedCurrencyFormatter.format(row.amount)}
    </span>,
  ]);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ToolEvidencePanelProps {
  readonly evidence: TransactionEvidence;
}

function EmptyEvidence(): React.JSX.Element {
  return (
    <div className="bg-card text-muted-foreground dark:bg-card/80 border-border mb-2 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm backdrop-blur-xl">
      <SearchX className="h-4 w-4 shrink-0" />
      <span>No matching transactions found for this search.</span>
    </div>
  );
}

export function ToolEvidencePanel({
  evidence,
}: ToolEvidencePanelProps): React.JSX.Element | null {
  const panelId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const prefersReducedMotion = useReducedMotion() === true;

  const tableRows = useMemo(
    () => buildTableRows(evidence.rows),
    [evidence.rows]
  );
  const provenanceParts = useMemo(
    () => buildProvenanceParts(evidence),
    [evidence]
  );
  const appliedFiltersText = useMemo(
    () => buildAppliedFiltersText(evidence.appliedFilters),
    [evidence.appliedFilters]
  );

  if (evidence.rows.length === 0) {
    return <EmptyEvidence />;
  }

  const provenanceAriaLabel = `Source data: ${provenanceParts.join(", ")}`;
  const maxVisibleRows =
    evidence.rows.length > INITIAL_VISIBLE_ROWS && !showAll
      ? INITIAL_VISIBLE_ROWS
      : undefined;
  const entranceTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.3, delay: 0.1 };
  const collapseTransition = { duration: prefersReducedMotion ? 0 : 0.2 };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={entranceTransition}
      className="dark:bg-muted/20 border-primary/30 bg-muted/30 mb-2 rounded-lg border-l-2 p-3"
      role="region"
      aria-label={provenanceAriaLabel}
      id={panelId}
    >
      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 px-1 py-2 text-xs tabular-nums">
        {provenanceParts.flatMap((part, i) =>
          i === 0
            ? [<span key={`part-${i}`}>{part}</span>]
            : [
                <span
                  key={`sep-${i}`}
                  className="text-border"
                  aria-hidden="true"
                >
                  ·
                </span>,
                <span key={`part-${i}`}>{part}</span>,
              ]
        )}
      </div>

      {appliedFiltersText && (
        <p className="text-muted-foreground/70 flex flex-wrap items-center gap-1 px-1 pb-1.5 text-[11px]">
          <span className="italic">Searched:</span>
          <span>{appliedFiltersText}</span>
        </p>
      )}

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={
              prefersReducedMotion ? undefined : { opacity: 0, height: 0 }
            }
            animate={
              prefersReducedMotion ? undefined : { opacity: 1, height: "auto" }
            }
            exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0 }}
            transition={collapseTransition}
            className="overflow-hidden"
          >
            <DataTable
              columns={COLUMN_HEADERS}
              rows={tableRows}
              aligns={COLUMN_ALIGNS}
              maxVisibleRows={maxVisibleRows}
              rowKeyPrefix={panelId}
            />

            {evidence.rows.length > INITIAL_VISIBLE_ROWS && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-primary hover:text-primary/80 mt-1.5 text-[11px] font-medium transition-colors"
              >
                Show all {evidence.rows.length} rows
              </button>
            )}

            {evidence.truncated && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <Info className="h-3 w-3 shrink-0" />
                <span>
                  Showing {evidence.rows.length} of {evidence.totalMatches}{" "}
                  matching {evidence.rowLabel}. Ask me to narrow the search for
                  the full picture.
                </span>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-controls={panelId}
        className="text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1 text-[11px] transition-colors"
      >
        {collapsed ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        )}
        {collapsed ? "Show source data" : "Hide source data"}
      </button>
    </motion.div>
  );
}
