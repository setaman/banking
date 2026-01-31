# Implementation Plan: Sync & Test-Mode Improvements

**Version:** 1.0
**Status:** Approved for Implementation
**Created:** 2026-01-31
**Author:** Claude Code Planning Agent

---

## Executive Summary

This document outlines a comprehensive plan to address four critical issues with the current BanKing application:

1. **No way to trigger sync via UI** - The sync functionality exists but has no UI trigger
2. **Test-Mode wipes real transactions** - Toggling demo mode destroys production data
3. **No last sync indicator** - Users can't see when data was last synced
4. **Data only available after restart** - Server-side caching prevents real-time updates

---

## 1. Problem Analysis

### 1.1 Issue: No UI Sync Trigger

**Current State:**

- `triggerSync()` server action exists in `src/actions/sync.actions.ts`
- `POST /api/sync` route exists in `src/app/api/sync/route.ts`
- No UI component calls either of these

**Impact:** Users must restart the server to sync new transactions.

### 1.2 Issue: Test-Mode Destroys Real Data

**Current State:**

```typescript
// In demo.actions.ts
export async function enableDemoMode() {
  const db = await getDb();
  db.data = demoData; // OVERWRITES everything
  await db.write();
}

export async function disableDemoMode() {
  await resetDb(); // Resets to DEFAULT_DB (empty)
}
```

**Impact:** Users who toggle demo mode lose all synced real transactions permanently.

### 1.3 Issue: No Last Sync Indicator

**Current State:**

- `syncHistory` array stores sync metadata with timestamps
- `meta.lastModifiedAt` tracks last DB write
- No UI displays this information

**Impact:** Users don't know if their data is current.

### 1.4 Issue: Data Not Available Until Restart

**Current State:**

- LowDB uses a singleton pattern (`dbInstance` cached in memory)
- After sync writes to `db.json`, the cached instance doesn't refresh
- Next.js server components continue reading stale data

**Impact:** Synced transactions don't appear until server restart.

---

## 2. Solution Architecture

### 2.1 Data Separation Strategy

**Approach:** Separate storage files for real and demo data.

```
data/
├── db.json           # Real data (current)
├── db-demo.json      # Demo data (NEW)
└── db-backup.json    # Auto-backup before mode switch (NEW)
```

**Key Changes:**

1. Demo mode reads/writes from `db-demo.json`
2. Real mode reads/writes from `db.json`
3. Switching modes just changes the active file reference
4. No data is destroyed when switching

### 2.2 Database Instance Management

**Approach:** Invalidate cached instance after writes.

```typescript
// New export in db/index.ts
export function invalidateDbCache(): void {
  dbInstance = null;
}
```

Call `invalidateDbCache()` after every `db.write()` to force re-read on next access.

### 2.3 Sync Status Context

**Approach:** New React context for sync state management.

```typescript
interface SyncContextValue {
  lastSyncAt: Date | null;
  isSyncing: boolean;
  syncError: string | null;
  triggerSync: () => Promise<SyncResult>;
  syncStatus: "idle" | "syncing" | "success" | "error";
}
```

### 2.4 UI Component Strategy

**Approach:** Enhanced header with sync controls and status.

```
┌─────────────────────────────────────────────────────────────────┐
│  [B] BanKing   │  Dashboard  Transactions  Insights  │  [Controls]  │
├─────────────────────────────────────────────────────────────────┤
│                                          [Sync Status Panel]   │
│                                          Last sync: 2 min ago  │
│                                          [🔄 Sync Now] [⚗️ Demo] │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Requirements

### 3.1 Functional Requirements

| ID  | Requirement                                | Priority |
| --- | ------------------------------------------ | -------- |
| FR1 | Add "Sync Now" button to header            | High     |
| FR2 | Display last sync timestamp                | High     |
| FR3 | Show sync progress indicator               | High     |
| FR4 | Preserve real data when enabling demo mode | Critical |
| FR5 | Restore real data when disabling demo mode | Critical |
| FR6 | Refresh UI data after successful sync      | High     |
| FR7 | Show sync error messages                   | Medium   |
| FR8 | Add confirmation dialog for mode switch    | Medium   |

### 3.2 Non-Functional Requirements

| ID   | Requirement               | Target                                |
| ---- | ------------------------- | ------------------------------------- |
| NFR1 | Sync button response time | < 100ms to show loading state         |
| NFR2 | Data refresh after sync   | < 500ms to update UI                  |
| NFR3 | Mode switch time          | < 200ms                               |
| NFR4 | Zero data loss            | 100% data preservation on mode switch |

---

## 4. Technical Specification

### 4.1 Database Layer Changes

#### 4.1.1 New File: `src/lib/db/storage.ts`

```typescript
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

export const DB_PATHS = {
  real: join(DATA_DIR, "db.json"),
  demo: join(DATA_DIR, "db-demo.json"),
  backup: join(DATA_DIR, "db-backup.json"),
} as const;

export type DbMode = "real" | "demo";
```

#### 4.1.2 Modified: `src/lib/db/index.ts`

```typescript
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { Database, DEFAULT_DB } from "./schema";
import { DB_PATHS, DbMode } from "./storage";

let dbInstance: Low<Database> | null = null;
let currentMode: DbMode = "real";

export async function getDb(): Promise<Low<Database>> {
  if (dbInstance) return dbInstance;

  const dbPath = currentMode === "demo" ? DB_PATHS.demo : DB_PATHS.real;
  const adapter = new JSONFile<Database>(dbPath);
  const db = new Low<Database>(adapter, DEFAULT_DB);

  await db.read();

  if (!db.data) {
    db.data = { ...DEFAULT_DB };
    await db.write();
  }

  dbInstance = db;
  return db;
}

export function invalidateDbCache(): void {
  dbInstance = null;
}

export function setDbMode(mode: DbMode): void {
  if (mode !== currentMode) {
    currentMode = mode;
    invalidateDbCache();
  }
}

export function getDbMode(): DbMode {
  return currentMode;
}

export async function resetDb(): Promise<void> {
  const db = await getDb();
  db.data = {
    ...DEFAULT_DB,
    meta: {
      ...DEFAULT_DB.meta,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
    },
  };
  await db.write();
  invalidateDbCache();
}
```

#### 4.1.3 Schema Addition

Add to `src/lib/db/schema.ts`:

```typescript
meta: z.object({
  version: z.number().default(1),
  createdAt: z.string().datetime().optional(),
  lastModifiedAt: z.string().datetime().optional(),
  isDemoMode: z.boolean().default(false),
  lastSyncAt: z.string().datetime().optional(), // NEW
});
```

### 4.2 Demo Actions Rewrite

#### 4.2.1 Modified: `src/actions/demo.actions.ts`

```typescript
"use server";

import { getDb, setDbMode, getDbMode, invalidateDbCache } from "@/lib/db";
import { generateDemoData } from "@/lib/db/seed";
import { revalidatePath } from "next/cache";

export async function enableDemoMode(): Promise<{
  success: boolean;
  transactionCount: number;
}> {
  // Switch to demo mode (uses db-demo.json)
  setDbMode("demo");

  const db = await getDb();

  // Only generate if demo DB is empty or outdated
  if (db.data.transactions.length === 0) {
    const demoData = generateDemoData();
    db.data = demoData;
    await db.write();
  }

  invalidateDbCache();
  revalidatePath("/");

  return {
    success: true,
    transactionCount: db.data.transactions.length,
  };
}

export async function disableDemoMode(): Promise<{ success: boolean }> {
  // Switch back to real mode (uses db.json)
  setDbMode("real");
  invalidateDbCache();
  revalidatePath("/");

  return { success: true };
}

export async function isDemoMode(): Promise<boolean> {
  return getDbMode() === "demo";
}

export async function getLastSyncTime(): Promise<string | null> {
  // Only applicable in real mode
  if (getDbMode() === "demo") return null;

  const db = await getDb();
  const lastSync = db.data.syncHistory
    .filter((s) => s.status === "success")
    .sort((a, b) => b.lastSyncAt.localeCompare(a.lastSyncAt))[0];

  return lastSync?.lastSyncAt ?? db.data.meta.lastModifiedAt ?? null;
}
```

### 4.3 Sync Actions Enhancement

#### 4.3.1 Modified: `src/actions/sync.actions.ts`

```typescript
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
```

### 4.4 Sync Context

#### 4.4.1 New File: `src/contexts/sync-context.tsx`

```typescript
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
  hasCredentials: boolean;
  triggerManualSync: () => Promise<SyncMetadata>;
  refreshSyncStatus: () => Promise<void>;
}

const SyncContext = React.createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [lastSyncAt, setLastSyncAt] = React.useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>("idle");
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = React.useState<SyncMetadata | null>(null);
  const [hasCredentials, setHasCredentials] = React.useState(false);

  const refreshSyncStatus = React.useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setLastSyncAt(status.lastSyncAt ? new Date(status.lastSyncAt) : null);
      setHasCredentials(status.hasCredentials);
    } catch (error) {
      console.error("Failed to fetch sync status:", error);
    }
  }, []);

  // Initialize sync status on mount
  React.useEffect(() => {
    refreshSyncStatus();
  }, [refreshSyncStatus]);

  const triggerManualSync = React.useCallback(async (): Promise<SyncMetadata> => {
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
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
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
      hasCredentials,
      triggerManualSync,
      refreshSyncStatus,
    }),
    [lastSyncAt, isSyncing, syncStatus, syncError, lastSyncResult, hasCredentials, triggerManualSync, refreshSyncStatus]
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
```

### 4.5 UI Components

#### 4.5.1 New File: `src/components/sync-button.tsx`

```typescript
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
    lastSyncResult
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
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    if (!hasCredentials) {
      return <CloudOff className="h-4 w-4 text-muted-foreground" />;
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
              "rounded-full h-9 w-9",
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
```

#### 4.5.2 New File: `src/components/sync-status.tsx`

```typescript
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
    return (
      <span className="text-xs text-amber-500/80">
        Demo data
      </span>
    );
  }

  if (isSyncing) {
    return (
      <span className="text-xs text-muted-foreground animate-pulse">
        Syncing...
      </span>
    );
  }

  if (!lastSyncAt) {
    return (
      <span className="text-xs text-muted-foreground">
        Never synced
      </span>
    );
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
```

#### 4.5.3 Enhanced Demo Toggle: `src/components/demo-toggle.tsx`

Add confirmation dialog before switching modes:

```typescript
"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";
import { useDemoMode } from "@/contexts/demo-context";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function DemoToggle() {
  const { isDemoMode, enableDemo, disableDemo, isLoading } = useDemoMode();
  const [mounted, setMounted] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<"enable" | "disable" | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        <Switch disabled size="sm" />
      </div>
    );
  }

  const handleToggleRequest = (checked: boolean) => {
    setPendingAction(checked ? "enable" : "disable");
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (pendingAction === "enable") {
      await enableDemo();
    } else {
      await disableDemo();
    }
    setShowConfirm(false);
    setPendingAction(null);
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setPendingAction(null);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical
            className={cn(
              "h-4 w-4 transition-colors",
              isDemoMode ? "text-amber-500" : "text-muted-foreground"
            )}
          />
          <Switch
            checked={isDemoMode}
            onCheckedChange={handleToggleRequest}
            disabled={isLoading}
            size="sm"
            className={cn(
              isDemoMode &&
                "data-[state=checked]:bg-amber-500 dark:data-[state=checked]:bg-amber-500"
            )}
            aria-label="Toggle demo mode"
          />
        </div>
        {isDemoMode && (
          <Badge
            variant="outline"
            className={cn(
              "border-amber-500/30 bg-amber-500/10 text-amber-600 backdrop-blur-sm",
              "dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400",
              "shadow-sm shadow-amber-500/20"
            )}
          >
            Demo Mode
          </Badge>
        )}
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === "enable" ? "Enable Demo Mode?" : "Disable Demo Mode?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === "enable"
                ? "This will switch to sample data. Your real banking data will be preserved and restored when you disable demo mode."
                : "This will switch back to your real banking data. Demo data will be preserved for later."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {pendingAction === "enable" ? "Enable Demo" : "Show Real Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

#### 4.5.4 Updated Header: `src/components/layout/Header.tsx`

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { Nav } from "./nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { DemoToggle } from "@/components/demo-toggle";
import { SyncButton } from "@/components/sync-button";
import { SyncStatus } from "@/components/sync-status";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full pt-4 px-4 sm:px-6">
      <div className="glass-panel mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full px-6 sm:px-8 transition-all hover:bg-card/70">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center space-x-2 transition-transform hover:scale-105"
          >
            <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md">
              <span className="text-primary text-xl font-bold">B</span>
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-xl font-bold text-transparent">
              BanKing
            </span>
          </Link>
          <div className="hidden md:block">
            <Nav />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Sync Status - Desktop only */}
          <div className="hidden lg:flex items-center">
            <SyncStatus />
          </div>

          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            <SyncButton />
            <div className="w-px h-6 bg-border/50" />
            <DemoToggle />
            <ThemeToggle />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden rounded-full h-10 w-10"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav Overlay */}
      <div
        className={cn(
          "absolute top-24 left-4 right-4 z-40 md:hidden transition-all duration-300 transform origin-top",
          isOpen
            ? "scale-100 opacity-100 pointer-events-auto"
            : "scale-95 opacity-0 pointer-events-none",
        )}
      >
        <div className="glass-panel p-6 rounded-3xl shadow-2xl border border-white/10 dark:border-white/5 space-y-6">
          <div className="flex flex-col gap-4">
            <Nav />
          </div>

          {/* Sync status in mobile menu */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <SyncStatus />
            <SyncButton />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <span className="text-sm font-medium text-muted-foreground">
              Settings
            </span>
            <div className="flex items-center gap-4">
              <DemoToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
```

### 4.6 Layout Integration

#### 4.6.1 Updated: `src/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { DemoProvider } from "@/contexts/demo-context";
import { SyncProvider } from "@/contexts/sync-context";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/footer";

// ... fonts ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DemoProvider>
            <SyncProvider>
              <div className="flex min-h-screen flex-col">
                <Header />
                <main className="flex-1 pt-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
                  {children}
                </main>
                <Footer />
              </div>
            </SyncProvider>
          </DemoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## 5. UI/UX Specification

### 5.1 Sync Button States

| State          | Icon                   | Color       | Interaction            |
| -------------- | ---------------------- | ----------- | ---------------------- |
| Idle           | `RefreshCw`            | muted       | Clickable              |
| Syncing        | `RefreshCw` (spinning) | primary     | Disabled               |
| Success        | `Check`                | green-500   | Fades to idle after 3s |
| Error          | `AlertCircle`          | destructive | Clickable to retry     |
| No Credentials | `CloudOff`             | muted       | Disabled with tooltip  |
| Demo Mode      | `RefreshCw`            | muted       | Disabled with tooltip  |

### 5.2 Sync Status Text

| Condition    | Display                                |
| ------------ | -------------------------------------- |
| Demo Mode    | "Demo data" (amber text)               |
| Syncing      | "Syncing..." (pulsing animation)       |
| Never synced | "Never synced"                         |
| Synced       | "Synced X minutes ago" (relative time) |
| Error        | "Sync failed" (red text)               |

### 5.3 Demo Toggle Behavior

1. **Enable Demo:**
   - Show confirmation dialog
   - Explain that real data is preserved
   - Switch to demo database file
   - Badge appears: "Demo Mode"

2. **Disable Demo:**
   - Show confirmation dialog
   - Explain switching to real data
   - Switch back to real database file
   - Badge disappears

### 5.4 Neo-Glass Theme Consistency

All new components must follow:

- Glass effect: `bg-card/50 backdrop-blur-xl`
- Border: `border-white/10 dark:border-white/5`
- Shadows: `shadow-primary/20` on hover
- Animations: Motion transitions on state changes

---

## 6. Implementation Steps

### Phase 1: Database Layer (Backend)

| Step | File                      | Action                                            | Complexity |
| ---- | ------------------------- | ------------------------------------------------- | ---------- |
| 1.1  | `src/lib/db/storage.ts`   | Create new file with path constants               | Low        |
| 1.2  | `src/lib/db/index.ts`     | Add `invalidateDbCache`, `setDbMode`, `getDbMode` | Medium     |
| 1.3  | `src/lib/db/schema.ts`    | Add `lastSyncAt` to meta schema                   | Low        |
| 1.4  | `src/lib/banking/sync.ts` | Call `invalidateDbCache()` after write            | Low        |

### Phase 2: Server Actions (Backend)

| Step | File                          | Action                                     | Complexity |
| ---- | ----------------------------- | ------------------------------------------ | ---------- |
| 2.1  | `src/actions/demo.actions.ts` | Rewrite to use mode switching              | Medium     |
| 2.2  | `src/actions/sync.actions.ts` | Add `getSyncStatus`, enhance `triggerSync` | Medium     |
| 2.3  | All actions                   | Add `revalidatePath` calls after writes    | Low        |

### Phase 3: Context Providers (Frontend)

| Step | File                            | Action                          | Complexity |
| ---- | ------------------------------- | ------------------------------- | ---------- |
| 3.1  | `src/contexts/sync-context.tsx` | Create new sync context         | Medium     |
| 3.2  | `src/contexts/demo-context.tsx` | Update to work with new backend | Low        |
| 3.3  | `src/app/layout.tsx`            | Add `SyncProvider`              | Low        |

### Phase 4: UI Components (Frontend)

| Step | File                               | Action                    | Complexity |
| ---- | ---------------------------------- | ------------------------- | ---------- |
| 4.1  | `src/components/sync-button.tsx`   | Create new component      | Medium     |
| 4.2  | `src/components/sync-status.tsx`   | Create new component      | Low        |
| 4.3  | `src/components/demo-toggle.tsx`   | Add confirmation dialog   | Medium     |
| 4.4  | `src/components/layout/Header.tsx` | Integrate sync components | Medium     |

### Phase 5: UI Requirements

| Step | Action                                            | Complexity |
| ---- | ------------------------------------------------- | ---------- |
| 5.1  | Install AlertDialog from shadcn/ui if not present | Low        |
| 5.2  | Install Tooltip from shadcn/ui if not present     | Low        |

### Phase 6: Testing & Polish

| Step | Action                               | Complexity |
| ---- | ------------------------------------ | ---------- |
| 6.1  | Test sync flow end-to-end            | Medium     |
| 6.2  | Test demo mode toggle preserves data | High       |
| 6.3  | Test UI updates after sync           | Medium     |
| 6.4  | Mobile responsive testing            | Low        |

---

## 7. Testing Strategy

### 7.1 Manual Test Cases

| ID  | Test Case                       | Expected Result                      |
| --- | ------------------------------- | ------------------------------------ |
| T1  | Click Sync button               | Shows spinner, then success check    |
| T2  | Enable demo mode with real data | Real data preserved, demo data shown |
| T3  | Disable demo mode               | Real data restored                   |
| T4  | Sync in demo mode               | Button disabled, tooltip explains    |
| T5  | Sync without credentials        | Button disabled, tooltip explains    |
| T6  | Multiple rapid syncs            | Only one sync runs at a time         |
| T7  | Sync error handling             | Error icon shown, can retry          |
| T8  | Last sync time updates          | Relative time updates on success     |

### 7.2 Data Integrity Tests

| ID  | Test Case                       | Verification          |
| --- | ------------------------------- | --------------------- |
| D1  | Enable demo → disable           | `db.json` unchanged   |
| D2  | Sync → enable demo → sync fails | Correct error shown   |
| D3  | Server restart                  | Correct mode restored |
| D4  | Concurrent access               | No data corruption    |

---

## 8. Risks & Mitigations

| Risk                         | Impact | Probability | Mitigation                                      |
| ---------------------------- | ------ | ----------- | ----------------------------------------------- |
| Data loss during mode switch | High   | Low         | Use separate files, backup before switch        |
| Stale data in UI             | Medium | Medium      | Call `invalidateDbCache()` + `revalidatePath()` |
| Race conditions              | Medium | Low         | Disable buttons during operations               |
| Large sync times             | Low    | Medium      | Show progress, allow cancel                     |

---

## 9. Success Criteria

- [ ] Users can trigger sync via header button
- [ ] Last sync time is displayed and updates correctly
- [ ] Toggling demo mode preserves all real data
- [ ] UI refreshes immediately after sync completes
- [ ] No server restart required for data updates
- [ ] Error states are clearly communicated
- [ ] Mobile experience is fully functional

---

## 10. Dependencies

### npm Packages (existing)

- `lowdb` - File database
- `date-fns` - Time formatting
- `motion` - Animations

### shadcn/ui Components (may need installation)

- `AlertDialog` - Confirmation dialogs
- `Tooltip` - Button tooltips

---

## Appendix A: File Changes Summary

| File                               | Action  | Lines Changed (est.) |
| ---------------------------------- | ------- | -------------------- |
| `src/lib/db/storage.ts`            | CREATE  | ~15                  |
| `src/lib/db/index.ts`              | MODIFY  | ~25                  |
| `src/lib/db/schema.ts`             | MODIFY  | ~5                   |
| `src/lib/banking/sync.ts`          | MODIFY  | ~10                  |
| `src/actions/demo.actions.ts`      | REWRITE | ~50                  |
| `src/actions/sync.actions.ts`      | MODIFY  | ~40                  |
| `src/contexts/sync-context.tsx`    | CREATE  | ~100                 |
| `src/contexts/demo-context.tsx`    | MODIFY  | ~20                  |
| `src/components/sync-button.tsx`   | CREATE  | ~80                  |
| `src/components/sync-status.tsx`   | CREATE  | ~50                  |
| `src/components/demo-toggle.tsx`   | MODIFY  | ~60                  |
| `src/components/layout/Header.tsx` | MODIFY  | ~30                  |
| `src/app/layout.tsx`               | MODIFY  | ~5                   |

**Total estimated lines:** ~490 lines

---

## Appendix B: API Reference

### Server Actions

```typescript
// Sync
triggerSync(institutionId?: string): Promise<SyncMetadata>
getSyncStatus(): Promise<{ lastSyncAt: string | null; syncHistory: SyncMetadata[]; hasCredentials: boolean }>

// Demo
enableDemoMode(): Promise<{ success: boolean; transactionCount: number }>
disableDemoMode(): Promise<{ success: boolean }>
isDemoMode(): Promise<boolean>
getLastSyncTime(): Promise<string | null>

// Database
getDb(): Promise<Low<Database>>
invalidateDbCache(): void
setDbMode(mode: DbMode): void
getDbMode(): DbMode
```

### React Hooks

```typescript
// Sync Context
useSync(): {
  lastSyncAt: Date | null;
  isSyncing: boolean;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncError: string | null;
  lastSyncResult: SyncMetadata | null;
  hasCredentials: boolean;
  triggerManualSync: () => Promise<SyncMetadata>;
  refreshSyncStatus: () => Promise<void>;
}

// Demo Context (existing, enhanced)
useDemoMode(): {
  isDemoMode: boolean;
  enableDemo: () => Promise<void>;
  disableDemo: () => Promise<void>;
  isLoading: boolean;
}
```
