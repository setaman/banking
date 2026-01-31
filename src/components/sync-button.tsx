"use client";

import * as React from "react";
import { RefreshCw, Check, AlertCircle, CloudOff } from "lucide-react";
import { useSync } from "@/contexts/sync-context";
import { useDemoMode } from "@/contexts/demo-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function SyncButton() {
  const {
    isSyncing,
    syncStatus,
    triggerManualSync,
    hasCredentials,
    lastSyncResult,
  } = useSync();
  const { isDemoMode } = useDemoMode();

  const handleSync = async () => {
    if (isSyncing || isDemoMode) return;
    await triggerManualSync();
  };

  const getIcon = () => {
    if (isSyncing) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    if (syncStatus === "success") {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    if (syncStatus === "error") {
      return <AlertCircle className="text-destructive h-4 w-4" />;
    }
    if (!hasCredentials) {
      return <CloudOff className="text-muted-foreground h-4 w-4" />;
    }
    return <RefreshCw className="h-4 w-4" />;
  };

  const getTooltipContent = () => {
    if (isDemoMode) return "Disable demo mode to sync";
    if (!hasCredentials) return "Configure banking.config.json to sync";
    if (isSyncing) return "Syncing...";
    if (syncStatus === "success" && lastSyncResult) {
      return `Synced ${lastSyncResult.newTransactions} new transactions`;
    }
    if (syncStatus === "error") return "Sync failed. Click to retry.";
    return "Sync with bank";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-full",
              syncStatus === "success" && "text-green-500",
              syncStatus === "error" && "text-destructive"
            )}
            onClick={handleSync}
            disabled={isSyncing || isDemoMode || !hasCredentials}
            aria-label="Sync with bank"
          >
            {getIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
