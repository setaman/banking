/**
 * Shared internal-transfer detection.
 *
 * Internal transfers (money moved between the user's own accounts) are
 * flagged during sync (see `src/lib/banking/sync.ts`) and must be excluded
 * from income/expense figures. This is the single source of truth for that
 * check, used by both `getTransactions({ excludeInternal })` and the
 * transaction summary strip.
 */

import type { UnifiedTransaction } from "@/lib/banking/types";

/**
 * Whether a transaction is an internal transfer.
 *
 * Two signals are honoured, either of which is sufficient:
 *
 * 1. `category === "internal-transfer"` — the category literal that sync
 *    assigns when it detects a transfer between the user's own accounts.
 * 2. `raw.__internalTransfer` — a truthy marker sync also writes onto the
 *    stored raw payload. It survives even if the category was already set
 *    to something else (sync only fills the category when empty).
 *
 * `raw` is untyped on `UnifiedTransaction` (it holds each adapter's original
 * payload verbatim), so the marker is read through a narrow structural type
 * rather than `any`.
 *
 * @param tx - The transaction to inspect.
 * @returns `true` if the transaction is flagged as an internal transfer.
 */
export function isInternalTransfer(tx: UnifiedTransaction): boolean {
  return (
    tx.category === "internal-transfer" ||
    Boolean(
      tx.raw && (tx.raw as { __internalTransfer?: unknown }).__internalTransfer
    )
  );
}
