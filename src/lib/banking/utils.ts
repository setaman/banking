import { createHash } from "crypto";
import type { UnifiedTransaction } from "./types";

/**
 * Creates a deterministic ID for a transaction based on its key fields.
 * Used for deduplication across syncs.
 */
export function createTransactionId(
  tx: Pick<
    UnifiedTransaction,
    "accountId" | "date" | "amount" | "description" | "counterparty"
  >,
): string {
  const input = [
    tx.accountId,
    tx.date,
    tx.amount.toString(),
    tx.description,
    tx.counterparty,
  ].join("|");

  return createHash("sha256").update(input).digest("hex");
}
