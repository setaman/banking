"use client";

import * as React from "react";
import { triggerSync, getSyncStatus } from "@/actions/sync.actions";
import type { SyncMetadata } from "@/lib/banking/types";

type SyncStatus = "idle" | "syncing" | "success" | "error";

interface SyncContextValue {
  lastSyncAt: Date | null;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncResult: SyncMetadata | null;
  syncHistory: SyncMetadata[];
  hasCredentials: boolean;
  triggerManualSync: () => Promise<SyncMetadata>;
  refreshSyncStatus: () => Promise<void>;
}

const SyncContext = React.createContext<SyncContextValue | undefined>(
  undefined
);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [lastSyncAt, setLastSyncAt] = React.useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>("idle");
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] =
    React.useState<SyncMetadata | null>(null);
  const [syncHistory, setSyncHistory] = React.useState<SyncMetadata[]>([]);
  const [hasCredentials, setHasCredentials] = React.useState(false);

  const refreshSyncStatus = React.useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setLastSyncAt(status.lastSyncAt ? new Date(status.lastSyncAt) : null);
      setHasCredentials(status.hasCredentials);
      setSyncHistory(status.syncHistory);
    } catch (error) {
      console.error("Failed to fetch sync status:", error);
    }
  }, []);

  // Initialize sync status on mount
  React.useEffect(() => {
    refreshSyncStatus();
  }, [refreshSyncStatus]);

  const triggerManualSync =
    React.useCallback(async (): Promise<SyncMetadata> => {
      setIsSyncing(true);
      setSyncStatus("syncing");
      setSyncError(null);

      try {
        const result = await triggerSync("dkb");
        setLastSyncResult(result);

        if (result.status === "success") {
          setSyncStatus("success");
          setLastSyncAt(new Date(result.lastSyncAt));

          // Reset to idle after 3 seconds
          setTimeout(() => setSyncStatus("idle"), 3000);
        } else {
          setSyncStatus("error");
          setSyncError(result.error ?? "Sync failed");
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Sync failed";
        setSyncStatus("error");
        setSyncError(errorMessage);

        return {
          institutionId: "dkb",
          lastSyncAt: new Date().toISOString(),
          accountsSynced: 0,
          transactionsFetched: 0,
          newTransactions: 0,
          status: "error",
          error: errorMessage,
        };
      } finally {
        setIsSyncing(false);
      }
    }, []);

  const value = React.useMemo(
    () => ({
      lastSyncAt,
      isSyncing,
      syncStatus,
      syncError,
      lastSyncResult,
      syncHistory,
      hasCredentials,
      triggerManualSync,
      refreshSyncStatus,
    }),
    [
      lastSyncAt,
      isSyncing,
      syncStatus,
      syncError,
      lastSyncResult,
      syncHistory,
      hasCredentials,
      triggerManualSync,
      refreshSyncStatus,
    ]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = React.useContext(SyncContext);
  if (context === undefined) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}
