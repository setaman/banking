"use client";

import * as React from "react";
import {
  WifiOff,
  Lock,
  ServerCrash,
  Copy,
  RotateCw,
  FileKey,
  Database,
  ShieldAlert,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { SyncMetadata } from "@/lib/banking/types";

interface SyncErrorDetailsProps {
  error: string;
  onRetry: () => void;
  syncHistory?: SyncMetadata[];
  className?: string;
}

// Map technical errors to user-friendly UI configurations
const getErrorConfig = (error: string) => {
  const err = error.toLowerCase();

  if (
    err.includes("network") ||
    err.includes("fetch") ||
    err.includes("connection")
  ) {
    return {
      icon: WifiOff,
      title: "Connection Failed",
      desc: "We couldn't reach the bank servers. Please check your internet connection.",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    };
  }

  if (
    err.includes("401") ||
    err.includes("auth") ||
    err.includes("session") ||
    err.includes("login")
  ) {
    return {
      icon: Lock,
      title: "Authentication Failed",
      desc: "Your session may have expired or credentials are invalid.",
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
    };
  }

  if (err.includes("credentials") || err.includes("config")) {
    return {
      icon: FileKey,
      title: "Missing Credentials",
      desc: "Bank credentials are not configured properly.",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    };
  }

  if (err.includes("500") || err.includes("internal")) {
    return {
      icon: ServerCrash,
      title: "Bank System Error",
      desc: "The bank's server reported an internal error. Please try again later.",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    };
  }

  if (err.includes("demo")) {
    return {
      icon: Database,
      title: "Demo Mode Active",
      desc: "Sync is disabled in demo mode. Disable demo mode to connect to real banks.",
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    };
  }

  // Default Catch-all
  return {
    icon: ShieldAlert,
    title: "Sync Error",
    desc: "An unexpected error occurred during synchronization.",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
  };
};

export function SyncErrorDetails({
  error,
  onRetry,
  syncHistory,
  className,
}: SyncErrorDetailsProps) {
  const config = getErrorConfig(error);
  const Icon = config.icon;
  const [showHistory, setShowHistory] = React.useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(error);
    toast.success("Error log copied to clipboard");
  };

  const lastSuccessfulSync = syncHistory?.find((s) => s.status === "success");

  return (
    <div className={cn("w-[340px] p-1", className)}>
      <div className="mb-4 flex items-start gap-4">
        <div
          className={cn(
            "shrink-0 rounded-xl p-2.5 shadow-inner backdrop-blur-md",
            config.bg,
            config.color
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-foreground text-sm font-semibold tracking-tight">
            {config.title}
          </h4>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {config.desc}
          </p>
        </div>
      </div>

      {/* Technical Error Log - Glass Well */}
      <div className="group border-border/40 bg-muted/20 hover:bg-muted/30 hover:border-border/60 relative mb-4 rounded-lg border p-3 backdrop-blur-sm transition-colors">
        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-6 w-6"
            onClick={copyToClipboard}
            title="Copy error"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <p className="text-muted-foreground custom-scrollbar max-h-[100px] overflow-y-auto pr-6 font-mono text-[10px] leading-relaxed break-all">
          {error}
        </p>
      </div>

      <div className="mb-3 flex gap-2">
        <Button
          onClick={onRetry}
          size="sm"
          className="bg-primary/90 text-primary-foreground hover:bg-primary shadow-primary/20 flex-1 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]"
        >
          <RotateCw className="mr-2 h-3.5 w-3.5" />
          Retry Sync
        </Button>
        {syncHistory && syncHistory.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="shrink-0"
            title="View History"
          >
            <History className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showHistory && syncHistory && (
        <div className="animate-in fade-in slide-in-from-top-2 border-border/40 border-t pt-2">
          <h5 className="text-muted-foreground mb-2 flex items-center justify-between text-xs font-medium">
            Recent Activity
            {lastSuccessfulSync && (
              <span className="text-[10px] text-green-500/80">
                Last success:{" "}
                {formatDistanceToNow(new Date(lastSuccessfulSync.lastSyncAt))}{" "}
                ago
              </span>
            )}
          </h5>
          <div className="custom-scrollbar max-h-[120px] space-y-1.5 overflow-y-auto pr-1">
            {syncHistory.slice(0, 5).map((sync, i) => (
              <div
                key={i}
                className="bg-muted/10 border-border/20 flex items-center justify-between rounded-md border p-2 text-[10px]"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      sync.status === "success" ? "bg-green-500" : "bg-red-500"
                    )}
                  />
                  <span className="text-foreground/80">
                    {new Date(sync.lastSyncAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {sync.status === "success"
                    ? `+${sync.newTransactions} txns`
                    : "Failed"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
