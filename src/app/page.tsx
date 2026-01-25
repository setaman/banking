"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { BalanceHistoryChart } from "@/components/dashboard/balance-history-chart";
import { IncomeExpensesChart } from "@/components/dashboard/income-expenses-chart";
import { CategoryBreakdownChart } from "@/components/dashboard/category-breakdown-chart";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { useDateRange } from "@/hooks/use-date-range";
import { getTransactions } from "@/actions/transactions.actions";
import { getAccounts } from "@/actions/accounts.actions";
import type { UnifiedTransaction, UnifiedAccount } from "@/lib/banking/types";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const MotionDiv = motion.create("div");

export default function Home() {
  // Date range state
  const { range, preset, setPreset, setCustomRange } = useDateRange("last30days");

  // Data state
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [accounts, setAccounts] = useState<UnifiedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert date range to ISO strings for filtering
  const startDate = format(range.from, "yyyy-MM-dd");
  const endDate = format(range.to, "yyyy-MM-dd");

  // Fetch accounts on mount
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const accountsData = await getAccounts();
        setAccounts(accountsData);
      } catch (err) {
        console.error("Failed to fetch accounts:", err);
        // Non-critical error, continue with empty accounts
      }
    }
    fetchAccounts();
  }, []);

  // Fetch transactions when date range or account changes
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build filters. If preset is 'allTime', omit date filters to fetch all transactions
      const isAllTime = preset === "allTime";
      const filters = {
        ...(isAllTime ? {} : { startDate, endDate }),
        ...(selectedAccountId !== "all" && { accountId: selectedAccountId }),
      };

      // Fetch transactions with filters, excluding internal transfers by default
      const transactionsData = await getTransactions(filters, { excludeInternal: true });

      // If the user selected 'allTime', update the date-range hook to the true data span (excluding internals)
      if (isAllTime && transactionsData && transactionsData.length > 0) {
        // Compute min/max bookingDate or date
        const dates = transactionsData
          .map((t) => t.bookingDate || t.date)
          .filter(Boolean)
          .map((d) => new Date(d));

        if (dates.length > 0) {
          const min = new Date(Math.min(...dates.map((d) => d.getTime())));
          const max = new Date(Math.max(...dates.map((d) => d.getTime())));
          // Only update if dates are valid
          if (!isNaN(min.getTime()) && !isNaN(max.getTime())) {
            setCustomRange({ from: min, to: max });
          }
        }
      }

      // Set transactions
      setTransactions(transactionsData);
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedAccountId]);

  // Fetch data when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoized filtered transactions for performance
  const filteredTransactions = useMemo(() => {
    return transactions;
  }, [transactions]);

  // Loading state UI
  const LoadingSkeleton = () => (
    <DashboardShell>
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Filters Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-64" />
      </div>

      {/* Overview Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="relative overflow-hidden border-white/5">
            <div className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-9 w-32 mb-3" />
              <Skeleton className="h-4 w-28" />
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/5">
          <div className="p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        </Card>
        <Card className="border-white/5">
          <div className="p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        </Card>
      </div>
    </DashboardShell>
  );

  // Error state UI
  if (error && !loading) {
    return (
      <DashboardShell>
        <Card className="border-rose-500/20">
          <CardContent className="flex flex-col items-center justify-center p-12 gap-4">
            <div className="text-rose-400 text-4xl mb-2">⚠️</div>
            <h3 className="text-xl font-semibold text-rose-400">
              Failed to Load Dashboard
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              {error}
            </p>
            <button
              onClick={() => fetchData()}
              className="mt-4 px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  // Loading state
  if (loading && transactions.length === 0) {
    return <LoadingSkeleton />;
  }

  // Main dashboard UI
  return (
    <DashboardShell>
      {/* Header */}
      <MotionDiv
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-2"
      >
        <h1 className="text-4xl font-bold tracking-tight text-glow">
          <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
            Welcome back
          </span>
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your finances today.
        </p>
      </MotionDiv>

      {/* Filters Section */}
      <MotionDiv
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        {/* Account Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Filter by Account:
          </span>
          <Select
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
          >
            <SelectTrigger
              className="w-[200px] bg-card/50 backdrop-blur-xl border-white/10 dark:border-white/5 hover:bg-card/70 hover:border-primary/20 transition-all duration-200"
            >
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10 dark:border-white/5">
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                  {account.iban && ` (${account.iban.slice(-4)})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Picker */}
        <DateRangePicker
          range={range}
          preset={preset}
          onPresetChange={setPreset}
          onCustomRangeChange={setCustomRange}
          className="w-full sm:w-auto min-w-[280px]"
        />
      </MotionDiv>

      {/* Overview Cards - Passes date range filters via getDashboardStats */}
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        key={`overview-${startDate}-${endDate}-${selectedAccountId}`}
      >
        <OverviewCards
          filters={{
            startDate,
            endDate,
            ...(selectedAccountId !== "all" && { accountId: selectedAccountId }),
          }}
        />
      </MotionDiv>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Balance History Chart */}
        <MotionDiv
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <BalanceHistoryChart
            accountId={selectedAccountId === "all" ? undefined : selectedAccountId}
          />
        </MotionDiv>

        {/* Category Breakdown Chart */}
        <MotionDiv
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <CategoryBreakdownChart
            transactions={filteredTransactions}
            limit={10}
          />
        </MotionDiv>
      </div>

      {/* Income vs Expenses Chart - Full Width */}
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <IncomeExpensesChart transactions={filteredTransactions} />
      </MotionDiv>

      {/* Data Stats Footer */}
      {filteredTransactions.length > 0 && (
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="flex items-center justify-center gap-6 text-sm text-muted-foreground border-t border-white/5 pt-6"
        >
          <span>
            Showing <strong className="text-foreground">{filteredTransactions.length}</strong>{" "}
            transactions
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            From <strong className="text-foreground">{format(range.from, "dd MMM yyyy")}</strong>{" "}
            to <strong className="text-foreground">{format(range.to, "dd MMM yyyy")}</strong>
          </span>
        </MotionDiv>
      )}

      {/* Empty State */}
      {filteredTransactions.length === 0 && !loading && (
        <MotionDiv
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-white/5">
            <CardContent className="flex flex-col items-center justify-center p-12 gap-4">
              <div className="text-6xl mb-2 opacity-50">📊</div>
              <h3 className="text-xl font-semibold">No Transactions Found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {selectedAccountId !== "all"
                  ? "No transactions found for the selected account and date range. Try adjusting your filters."
                  : "No transactions found for the selected date range. Try selecting a different time period or sync your accounts."}
              </p>
            </CardContent>
          </Card>
        </MotionDiv>
      )}
    </DashboardShell>
  );
}
