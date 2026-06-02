"use server";

import { revalidatePath } from "next/cache";

import { getDb, invalidateDbCache } from "@/lib/db";
import { isAccountCurrent } from "@/lib/banking/account-utils";
import type { UnifiedAccount, UnifiedBalance } from "@/lib/banking/types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds a Map of institutionId → ISO timestamp of the most recent *successful*
 * sync for that institution. Used by `isAccountCurrent` to detect stale accounts.
 */
async function buildLatestSyncMap(): Promise<Map<string, string>> {
  const db = await getDb();
  const map = new Map<string, string>();

  for (const entry of db.data.syncHistory) {
    if (entry.status !== "success") continue;
    const existing = map.get(entry.institutionId);
    if (existing === undefined || entry.lastSyncAt > existing) {
      map.set(entry.institutionId, entry.lastSyncAt);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Read actions
// ---------------------------------------------------------------------------

export async function getAccounts(): Promise<UnifiedAccount[]> {
  const db = await getDb();
  return db.data.accounts;
}

export async function getAccountById(
  id: string
): Promise<UnifiedAccount | undefined> {
  const db = await getDb();
  return db.data.accounts.find((a) => a.id === id);
}

/**
 * Returns the IDs of all accounts that are considered current/active according
 * to `isAccountCurrent` (not manually closed and not stale after a sync).
 */
export async function getActiveAccountIds(): Promise<Set<string>> {
  const db = await getDb();
  const latestSyncMap = await buildLatestSyncMap();
  const activeIds = new Set<string>();

  for (const account of db.data.accounts) {
    if (isAccountCurrent(account, latestSyncMap)) {
      activeIds.add(account.id);
    }
  }

  return activeIds;
}

export async function getLatestBalances(options?: {
  activeOnly?: boolean;
}): Promise<Map<string, UnifiedBalance>> {
  const db = await getDb();
  const latest = new Map<string, UnifiedBalance>();

  for (const balance of db.data.balances) {
    const existing = latest.get(balance.accountId);
    if (!existing || balance.fetchedAt > existing.fetchedAt) {
      latest.set(balance.accountId, balance);
    }
  }

  if (options?.activeOnly) {
    const activeIds = await getActiveAccountIds();
    for (const accountId of latest.keys()) {
      if (!activeIds.has(accountId)) {
        latest.delete(accountId);
      }
    }
  }

  return latest;
}

export async function getTotalBalance(): Promise<number> {
  const balances = await getLatestBalances({ activeOnly: true });
  let total = 0;
  for (const balance of balances.values()) {
    total += balance.amount;
  }
  return total;
}

export async function getBalanceHistory(
  accountId?: string
): Promise<UnifiedBalance[]> {
  const db = await getDb();
  const balances = accountId
    ? db.data.balances.filter((b) => b.accountId === accountId)
    : db.data.balances;

  return balances.sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt));
}

// ---------------------------------------------------------------------------
// Mutation actions
// ---------------------------------------------------------------------------

/**
 * Manually marks an account as closed. Closed accounts are excluded from the
 * Total Balance and any active-only balance calculations.
 */
export async function closeAccount(
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const account = db.data.accounts.find((a) => a.id === accountId);

  if (!account) {
    return { success: false, error: `Account not found: ${accountId}` };
  }

  if (account.status === "closed") {
    return { success: false, error: "Account is already closed." };
  }

  account.status = "closed";
  db.data.meta.lastModifiedAt = new Date().toISOString();
  await db.write();
  invalidateDbCache();

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/insights");

  return { success: true };
}

/**
 * Reactivates a previously closed account so it is included in balance totals
 * again. A stale account that was closed manually can be reactivated this way;
 * the staleness check will then determine whether it counts.
 */
export async function reactivateAccount(
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const account = db.data.accounts.find((a) => a.id === accountId);

  if (!account) {
    return { success: false, error: `Account not found: ${accountId}` };
  }

  if (account.status !== "closed") {
    return { success: false, error: "Account is not closed." };
  }

  account.status = "active";
  db.data.meta.lastModifiedAt = new Date().toISOString();
  await db.write();
  invalidateDbCache();

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/insights");

  return { success: true };
}
