"use server";

import React from "react";
import { getSyncStatus } from "@/actions/sync.actions";
import { formatDistanceToNow } from "date-fns";

export default async function SyncHistoryPage() {
  const { syncHistory, lastSyncAt, hasCredentials } = await getSyncStatus();

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Sync History</h1>
        <p className="text-muted-foreground text-sm">
          {lastSyncAt
            ? `Last successful sync ${formatDistanceToNow(
                new Date(lastSyncAt),
                {
                  addSuffix: true,
                }
              )}`
            : "Never synced"}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {hasCredentials
            ? "Credentials configured"
            : "No credentials found - sync disabled"}
        </p>
      </header>

      <div className="bg-card/70 overflow-x-auto rounded-lg border border-white/10 p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs uppercase">
              <th className="py-2">When</th>
              <th className="py-2">Institution</th>
              <th className="py-2">Status</th>
              <th className="py-2">Accounts</th>
              <th className="py-2">Fetched</th>
              <th className="py-2">New</th>
              <th className="py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {syncHistory && syncHistory.length > 0 ? (
              syncHistory.map((s) => (
                <tr key={s.lastSyncAt} className="border-t border-white/5">
                  <td className="py-3 align-top">
                    <div className="font-medium">
                      {new Date(s.lastSyncAt).toLocaleString()}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(s.lastSyncAt), {
                        addSuffix: true,
                      })}
                    </div>
                  </td>
                  <td className="py-3 align-top">{s.institutionId}</td>
                  <td className="py-3 align-top">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                        s.status === "success"
                          ? "text-green-500"
                          : "text-destructive"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 align-top">{s.accountsSynced}</td>
                  <td className="py-3 align-top">{s.transactionsFetched}</td>
                  <td className="py-3 align-top">{s.newTransactions}</td>
                  <td className="text-muted-foreground max-w-sm py-3 align-top text-xs">
                    {s.error ?? "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="text-muted-foreground py-6 text-center"
                >
                  No sync records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
