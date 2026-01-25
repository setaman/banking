"use server";

import { loadCredentials } from "@/config/credentials";
import { getAdapter } from "@/lib/banking/adapters";
import { syncBank } from "@/lib/banking/sync";
import type { SyncMetadata } from "@/lib/banking/types";

export async function triggerSync(
  institutionId: string,
): Promise<SyncMetadata> {
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

  return syncBank(adapter, credentials);
}
