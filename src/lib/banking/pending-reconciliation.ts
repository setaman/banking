import type { UnifiedTransaction } from "@/lib/banking/types";

/**
 * Default number of days after which a pending transaction is considered
 * stale (i.e. no longer expected to ever transition to "booked" as-is).
 */
const DEFAULT_STALE_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReconcilePendingOptions {
  /** Account whose stored transactions should be reconciled. */
  readonly accountId: string;
  /** Start of the freshly-fetched window (same value passed to the adapter's fetch). */
  readonly since?: Date;
  /** Reference "now" instant; defaults to `new Date()`. Overridable for tests. */
  readonly now?: Date;
  /** Days after which an untouched pending transaction is considered stale. */
  readonly staleDays?: number;
}

export interface ReconcilePendingResult {
  readonly kept: UnifiedTransaction[];
  readonly removedCount: number;
}

/**
 * Extracts a transaction's raw status (e.g. "pending" | "booked") without
 * assuming the exact shape of the bank-specific `raw` payload.
 */
function extractStatus(tx: UnifiedTransaction): string | undefined {
  const raw = tx.raw;
  if (!raw || typeof raw !== "object") return undefined;

  const attributes = (raw as Record<string, unknown>).attributes;
  if (!attributes || typeof attributes !== "object") return undefined;

  const status = (attributes as Record<string, unknown>).status;
  return typeof status === "string" ? status : undefined;
}

/**
 * Truncates a date to the start of its calendar day (UTC) for conservative,
 * timezone-agnostic date-only comparisons.
 */
function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Parses a transaction's `date` (YYYY-MM-DD, date-only) into a UTC day
 * timestamp. Returns `undefined` if the value cannot be parsed.
 */
function parseTransactionDay(dateStr: string): number | undefined {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return startOfUtcDay(parsed);
}

/**
 * Reconciles previously-stored pending transactions for a single account
 * against a freshly-completed fetch, preventing permanent duplicates when a
 * pending transaction later books under a rewritten description/date.
 *
 * Two independent removal rules apply only to STORED transactions on the
 * given account whose `raw.attributes.status === "pending"`:
 *
 * - Rule A (refresh window): the fresh fetch re-delivers the current truth
 *   for anything dated on/after `since` (or everything, when `since` is
 *   undefined, i.e. an initial/full sync). If the transaction is still
 *   pending, the fetch re-inserts it with the same identity; if it has since
 *   booked, the fetch inserts the booked version under its own identity. The
 *   stale pending record is safe to drop either way.
 * - Rule B (staleness): a pending transaction older than `staleDays` (default
 *   14) relative to `now` is dropped regardless of the fetch window, since a
 *   real-world charge is never left pending at the bank for that long — its
 *   outcome is already represented elsewhere (a booked record) or it was
 *   voided.
 *
 * All other stored transactions (non-pending, or belonging to a different
 * account) are returned unchanged.
 */
export function reconcilePendingTransactions(
  transactions: readonly UnifiedTransaction[],
  opts: ReconcilePendingOptions
): ReconcilePendingResult {
  const { accountId, since } = opts;
  const now = opts.now ?? new Date();
  const staleDays = opts.staleDays ?? DEFAULT_STALE_DAYS;

  const sinceDay = since ? startOfUtcDay(since) : undefined;
  const staleThresholdDay = startOfUtcDay(now) - staleDays * MS_PER_DAY;

  const kept: UnifiedTransaction[] = [];
  let removedCount = 0;

  for (const tx of transactions) {
    if (tx.accountId !== accountId || extractStatus(tx) !== "pending") {
      kept.push(tx);
      continue;
    }

    const txDay = parseTransactionDay(tx.date);

    // If the date can't be parsed, be conservative and keep the record.
    if (txDay === undefined) {
      kept.push(tx);
      continue;
    }

    // Rule A: within the freshly-fetched window (or no window = full refetch).
    const withinRefreshWindow = sinceDay === undefined || txDay >= sinceDay;

    // Rule B: older than the staleness threshold.
    const isStale = txDay < staleThresholdDay;

    if (withinRefreshWindow || isStale) {
      removedCount += 1;
      continue;
    }

    kept.push(tx);
  }

  return { kept, removedCount };
}
