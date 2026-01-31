"use client";

import * as React from "react";
import { SyncErrorDetails } from "@/components/sync-error-details";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SyncMetadata } from "@/lib/banking/types";

/**
 * Test component to visualize all sync error states
 * Only used for development/testing purposes
 */
export function SyncErrorShowcase() {
  const [selectedError, setSelectedError] = React.useState<string | null>(null);

  const mockSyncHistory: SyncMetadata[] = [
    {
      institutionId: "dkb",
      lastSyncAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      accountsSynced: 2,
      transactionsFetched: 45,
      newTransactions: 12,
      status: "success",
    },
    {
      institutionId: "dkb",
      lastSyncAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      accountsSynced: 0,
      transactionsFetched: 0,
      newTransactions: 0,
      status: "error",
      error: "Network connection failed",
    },
    {
      institutionId: "dkb",
      lastSyncAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      accountsSynced: 2,
      transactionsFetched: 38,
      newTransactions: 8,
      status: "success",
    },
  ];

  const errorScenarios = [
    {
      name: "Network Error",
      error: "Failed to fetch: Network connection timeout",
      color: "border-amber-500/20",
    },
    {
      name: "Authentication Error",
      error: "401 Authentication failed - session expired",
      color: "border-red-500/20",
    },
    {
      name: "Missing Credentials",
      error: "No credentials found for dkb in banking.config.json",
      color: "border-blue-500/20",
    },
    {
      name: "Server Error",
      error: "500 Internal Server Error: Bank system temporarily unavailable",
      color: "border-purple-500/20",
    },
    {
      name: "Demo Mode",
      error: "Cannot sync in demo mode. Disable demo mode first.",
      color: "border-primary/20",
    },
    {
      name: "Generic Error",
      error: "An unexpected error occurred during synchronization",
      color: "border-destructive/20",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-2 text-2xl font-bold tracking-tight">
          Sync Error UI Showcase
        </h2>
        <p className="text-muted-foreground text-sm">
          Visual test for all error states in the sync error handling system
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {errorScenarios.map((scenario) => (
          <Card
            key={scenario.name}
            className={`glass-panel border-2 p-4 ${scenario.color} cursor-pointer transition-all hover:scale-[1.02]`}
            onClick={() => setSelectedError(scenario.error)}
          >
            <h3 className="mb-2 font-semibold">{scenario.name}</h3>
            <p className="text-muted-foreground line-clamp-2 font-mono text-xs">
              {scenario.error}
            </p>
            <Button size="sm" variant="outline" className="mt-3 w-full">
              Preview Error
            </Button>
          </Card>
        ))}
      </div>

      {selectedError && (
        <Card className="glass-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Error Preview</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedError(null)}
            >
              Close
            </Button>
          </div>
          <div className="flex justify-center">
            <SyncErrorDetails
              error={selectedError}
              onRetry={() => {
                console.log("Retry clicked");
                setSelectedError(null);
              }}
              syncHistory={mockSyncHistory}
            />
          </div>
        </Card>
      )}

      <Card className="glass-panel border-primary/20 p-6">
        <h3 className="mb-3 text-lg font-semibold">Implementation Notes</h3>
        <ul className="text-muted-foreground space-y-2 text-sm">
          <li>✅ All error types classified and color-coded</li>
          <li>✅ Neo-Glass aesthetic with backdrop-blur effects</li>
          <li>✅ Copy-to-clipboard functionality with toast feedback</li>
          <li>✅ Sync history display with status indicators</li>
          <li>✅ Responsive design (mobile/desktop)</li>
          <li>✅ Accessibility compliant (ARIA, keyboard navigation)</li>
          <li>✅ Auto-opens on error, manual dismiss</li>
        </ul>
      </Card>
    </div>
  );
}
