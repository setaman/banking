"use server";

import { getDb } from "@/lib/db";
import type { UnifiedAccount, UnifiedBalance } from "@/lib/banking/types";

export async function getAccounts(): Promise<UnifiedAccount[]> {
  const db = await getDb();
  return db.data.accounts;
}

export async function getAccountById(
  id: string,
): Promise<UnifiedAccount | undefined> {
  const db = await getDb();
  return db.data.accounts.find((a) => a.id === id);
}

export async function getLatestBalances(): Promise<
  Map<string, UnifiedBalance>
> {
  const db = await getDb();
  const latest = new Map<string, UnifiedBalance>();

  for (const balance of db.data.balances) {
    const existing = latest.get(balance.accountId);
    if (!existing || balance.fetchedAt > existing.fetchedAt) {
      latest.set(balance.accountId, balance);
    }
  }

  return latest;
}

export async function getTotalBalance(): Promise<number> {
  const balances = await getLatestBalances();
  let total = 0;
  for (const balance of balances.values()) {
    total += balance.amount;
  }
  return total;
}

export async function getBalanceHistory(
  accountId?: string,
): Promise<UnifiedBalance[]> {
  const db = await getDb();
  const balances = accountId
    ? db.data.balances.filter((b) => b.accountId === accountId)
    : db.data.balances;

  return balances.sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt));
}
