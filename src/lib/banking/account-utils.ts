import type { UnifiedAccount } from "@/lib/banking/types";

/**
 * Determines whether an account should be included in balance calculations.
 *
 * Staleness rule:
 * An account is considered stale (and therefore excluded) when the institution
 * that owns it completed a *successful* sync AFTER the last time this account
 * was actually returned by that institution's API. Concretely:
 *
 *   seenAt  = account.lastSeenAt ?? account.lastSyncedAt
 *   latestSync = latestSyncByInstitution.get(account.institutionId)
 *
 *   stale  ⟺  latestSync exists  AND  seenAt < latestSync
 *
 * A manually closed account (`status === "closed"`) is also excluded regardless
 * of sync timestamps. Brand-new accounts that have never synced (seenAt is
 * undefined) are given the benefit of the doubt and treated as current.
 *
 * @param account - The account to evaluate.
 * @param latestSyncByInstitution - Map of institutionId → ISO timestamp of the
 *   most recent *successful* sync for that institution.
 * @returns `true` if the account should be included in active balance totals.
 */
export function isAccountCurrent(
  account: UnifiedAccount,
  latestSyncByInstitution: Map<string, string>
): boolean {
  // Explicitly closed accounts are always excluded.
  if (account.status === "closed") {
    return false;
  }

  const seenAt = account.lastSeenAt ?? account.lastSyncedAt;

  // Brand-new / never-synced account — treat as current.
  if (seenAt === undefined) {
    return true;
  }

  const latestSync = latestSyncByInstitution.get(account.institutionId);

  // No successful sync recorded for this institution yet — treat as current.
  if (latestSync === undefined) {
    return true;
  }

  // If the account was not seen in the most recent successful sync, it is stale.
  if (seenAt < latestSync) {
    return false;
  }

  return true;
}
