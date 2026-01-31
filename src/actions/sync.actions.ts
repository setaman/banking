"use server";

import { loadCredentials } from "@/config/credentials";
import { getAdapter } from "@/lib/banking/adapters";
import { syncBank } from "@/lib/banking/sync";
import { getDb, invalidateDbCache, getDbMode } from "@/lib/db";
import type { SyncMetadata } from "@/lib/banking/types";
import { revalidatePath } from "next/cache";

export async function triggerSync(
  institutionId: string = "dkb"
): Promise<SyncMetadata> {
  // Prevent sync in demo mode
  if (getDbMode() === "demo") {
    return {
      institutionId,
      lastSyncAt: new Date().toISOString(),
      accountsSynced: 0,
      transactionsFetched: 0,
      newTransactions: 0,
      status: "error",
      error: "Cannot sync in demo mode. Disable demo mode first.",
    };
  }

  const config = loadCredentials();

  if (!config) {
    return {
      institutionId,
      lastSyncAt: new Date().toISOString(),
      accountsSynced: 0,
      transactionsFetched: 0,
      newTransactions: 0,
      status: "error",
      error: "No banking.config.json found. Create one in the project root.",
    };
  }

  const adapter = getAdapter(institutionId);
  if (!adapter) {
    return {
      institutionId,
      lastSyncAt: new Date().toISOString(),
      accountsSynced: 0,
      transactionsFetched: 0,
      newTransactions: 0,
      status: "error",
      error: `No adapter registered for institution: ${institutionId}`,
    };
  }

  const credentialKey = institutionId as keyof typeof config;
  const credentials = config[credentialKey];
  if (!credentials) {
    return {
      institutionId,
      lastSyncAt: new Date().toISOString(),
      accountsSynced: 0,
      transactionsFetched: 0,
      newTransactions: 0,
      status: "error",
      error: `No credentials found for ${institutionId} in banking.config.json`,
    };
  }

  const result = await syncBank(adapter, credentials);

  // Invalidate cache to ensure fresh data on next read
  invalidateDbCache();

  // Revalidate all paths to refresh UI
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/insights");

  return result;
}

export async function getSyncStatus(): Promise<{
  lastSyncAt: string | null;
  syncHistory: SyncMetadata[];
  hasCredentials: boolean;
}> {
  const db = await getDb();
  const config = loadCredentials();

  const successfulSyncs = db.data.syncHistory
    .filter((s) => s.status === "success")
    .sort((a, b) => b.lastSyncAt.localeCompare(a.lastSyncAt));

  return {
    lastSyncAt: successfulSyncs[0]?.lastSyncAt ?? null,
    syncHistory: db.data.syncHistory.slice(-10), // Last 10 syncs
    hasCredentials: !!config,
  };
}
