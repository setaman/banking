/**
 * Example usage of IncomeExpensesChart component
 *
 * This file demonstrates how to integrate the Income vs Expenses chart
 * into your dashboard pages.
 */

import { IncomeExpensesChart } from "./income-expenses-chart";
import type { UnifiedTransaction } from "@/lib/banking/types";

// Example 1: Basic usage in a dashboard page
export function DashboardExample() {
  // Assuming you have transactions from a server action or state
  const transactions: UnifiedTransaction[] = []; // Replace with actual data from getTransactions()

  return (
    <div className="grid gap-6">
      <IncomeExpensesChart transactions={transactions} />
    </div>
  );
}

// Example 2: With custom className for layout
export function GridLayoutExample() {
  const transactions: UnifiedTransaction[] = []; // Replace with actual data

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <IncomeExpensesChart
        transactions={transactions}
        className="lg:col-span-2" // Full width on large screens
      />
    </div>
  );
}

// Example 3: Integration with server actions
// In your page.tsx file:
/*
import { getTransactions } from "@/actions/transactions.actions";
import { IncomeExpensesChart } from "@/components/dashboard/income-expenses-chart";

export default async function DashboardPage() {
  const transactions = await getTransactions();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-6">
        <IncomeExpensesChart transactions={transactions} />
      </div>
    </div>
  );
}
*/

// Example 4: With filtered transactions (client-side filtering)
/*
"use client";

import { useState } from "react";
import { IncomeExpensesChart } from "@/components/dashboard/income-expenses-chart";
import type { UnifiedTransaction } from "@/lib/banking/types";

export function FilteredChartExample({ allTransactions }: { allTransactions: UnifiedTransaction[] }) {
  const [accountId, setAccountId] = useState<string | null>(null);

  const filteredTransactions = accountId
    ? allTransactions.filter(tx => tx.accountId === accountId)
    : allTransactions;

  return (
    <div className="space-y-4">
      <select
        value={accountId || ""}
        onChange={(e) => setAccountId(e.target.value || null)}
        className="px-4 py-2 rounded-lg border"
      >
        <option value="">All Accounts</option>
        <option value="account-1">Account 1</option>
        <option value="account-2">Account 2</option>
      </select>

      <IncomeExpensesChart transactions={filteredTransactions} />
    </div>
  );
}
*/
