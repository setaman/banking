"use client";

import * as React from "react";
import { RefreshCw, Check, AlertCircle, CloudOff } from "lucide-react";
import { useSync } from "@/contexts/sync-context";
import { useDemoMode } from "@/contexts/demo-context";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SyncErrorDetails } from "@/components/sync-error-details";

export function SyncButton() {
  const {
    isSyncing,
    syncStatus,
    syncError,
    triggerManualSync,
    hasCredentials,
    syncHistory,
  } = useSync();
  const { isDemoMode } = useDemoMode();
  const [isOpen, setIsOpen] = React.useState(false);

  // Auto-open popover on error
  React.useEffect(() => {
    if (syncStatus === "error" && syncError) {
      setIsOpen(true);
    }
  }, [syncStatus, syncError]);

  const handleSync = async () => {
    if (isSyncing || isDemoMode) return;
    setIsOpen(false);
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

  // If we have an error, we wrap in Popover. Otherwise just a button/tooltip.
  const button = (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-9 w-9 rounded-full transition-all duration-500",
        syncStatus === "success" && "bg-green-500/10 text-green-500",
        syncStatus === "error" &&
          "text-destructive bg-destructive/10 ring-destructive/20 ring-2",
        isSyncing && "cursor-not-allowed opacity-80"
      )}
      onClick={syncStatus === "error" ? undefined : handleSync}
      disabled={
        isSyncing || isDemoMode || (!hasCredentials && syncStatus !== "error")
      }
      aria-label="Sync with bank"
    >
      {getIcon()}
    </Button>
  );

  if (syncStatus === "error" && syncError) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>{button}</PopoverTrigger>
        <PopoverContent
          className="bg-card/80 animate-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2 w-auto border-white/10 p-4 shadow-2xl backdrop-blur-xl dark:border-white/5"
          align="end"
        >
          <SyncErrorDetails
            error={syncError}
            onRetry={handleSync}
            syncHistory={syncHistory}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Fallback for non-error states (keep tooltip logic if desired, or simplify)
  return button;
}
