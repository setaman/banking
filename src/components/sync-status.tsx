"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { useSync } from "@/contexts/sync-context";
import { useDemoMode } from "@/contexts/demo-context";
import { cn } from "@/lib/utils";

export function SyncStatus() {
  const { lastSyncAt, isSyncing, syncStatus } = useSync();
  const { isDemoMode } = useDemoMode();
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  // Update relative time every minute
  React.useEffect(() => {
    const interval = setInterval(forceUpdate, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isDemoMode) {
    return <span className="text-xs text-amber-500/80">Demo data</span>;
  }

  if (isSyncing) {
    return (
      <span className="text-muted-foreground animate-pulse text-xs">
        Syncing...
      </span>
    );
  }

  if (!lastSyncAt) {
    return <span className="text-muted-foreground text-xs">Never synced</span>;
  }

  const timeAgo = formatDistanceToNow(lastSyncAt, { addSuffix: true });

  return (
    <span
      className={cn(
        "text-xs",
        syncStatus === "error" ? "text-destructive" : "text-muted-foreground"
      )}
    >
      Synced {timeAgo}
    </span>
  );
}
