import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Receipt,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { TransactionSummary } from "@/lib/stats/transaction-summary";
import { cn } from "@/lib/utils";

/** Props for {@link TransactionSummaryStrip}. */
export interface TransactionSummaryStripProps {
  /** Aggregated figures for the currently visible transactions. */
  summary: TransactionSummary;
}

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const POSITIVE_COLOR = "text-green-500 dark:text-green-400";
const NEGATIVE_COLOR = "text-red-500 dark:text-red-400";

interface StatCardProps {
  title: string;
  icon: LucideIcon;
  gradient: string;
  border: string;
  children: React.ReactNode;
}

/** Compact Neo-Glass stat card shell shared by all four summary cards. */
function StatCard({
  title,
  icon: Icon,
  gradient,
  border,
  children,
}: StatCardProps): React.JSX.Element {
  return (
    <Card className={cn("relative overflow-hidden", border)}>
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50",
          gradient
        )}
      />
      <CardContent className="relative z-10 flex min-w-0 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground truncate text-sm font-medium">
            {title}
          </p>
          <div className="bg-background/20 rounded-xl p-2 backdrop-blur-md">
            <Icon className="h-4 w-4 text-current opacity-80" />
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Four compact stat cards (income, expenses, net cash flow, largest expense)
 * shown above the transactions table. Renders nothing when there are no
 * transactions.
 */
export function TransactionSummaryStrip({
  summary,
}: TransactionSummaryStripProps): React.JSX.Element | null {
  if (summary.transactionCount === 0) return null;

  const { totalIncome, totalExpenses, netCashFlow, largestExpense } = summary;
  const largestLabel = largestExpense
    ? largestExpense.counterparty || largestExpense.description
    : "";

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard
        title="Total income"
        icon={ArrowUpRight}
        gradient="from-emerald-500/20 to-teal-500/20"
        border="border-emerald-500/20"
      >
        <p
          className={cn(
            "truncate text-xl font-bold tabular-nums",
            POSITIVE_COLOR
          )}
        >
          {eurFormatter.format(totalIncome)}
        </p>
      </StatCard>

      <StatCard
        title="Total expenses"
        icon={ArrowDownRight}
        gradient="from-rose-500/20 to-orange-500/20"
        border="border-rose-500/20"
      >
        <p
          className={cn(
            "truncate text-xl font-bold tabular-nums",
            NEGATIVE_COLOR
          )}
        >
          {eurFormatter.format(totalExpenses)}
        </p>
      </StatCard>

      <StatCard
        title="Net cash flow"
        icon={Coins}
        gradient="from-cyan-500/20 to-blue-500/20"
        border="border-cyan-500/20"
      >
        <p
          className={cn(
            "truncate text-xl font-bold tabular-nums",
            netCashFlow < 0
              ? NEGATIVE_COLOR
              : netCashFlow > 0
                ? POSITIVE_COLOR
                : "text-foreground"
          )}
        >
          {eurFormatter.format(netCashFlow)}
        </p>
      </StatCard>

      <StatCard
        title="Largest expense"
        icon={Receipt}
        gradient="from-orange-500/20 to-red-500/20"
        border="border-orange-500/20"
      >
        {largestExpense ? (
          <>
            <p
              className={cn(
                "truncate text-xl font-bold tabular-nums",
                NEGATIVE_COLOR
              )}
            >
              {eurFormatter.format(largestExpense.amount)}
            </p>
            <p
              className="text-muted-foreground truncate text-xs"
              title={
                largestExpense.counterparty
                  ? `${largestExpense.description} (${largestExpense.counterparty})`
                  : largestExpense.description
              }
            >
              {largestLabel} &middot;{" "}
              {format(new Date(largestExpense.date), "MMM dd, yyyy")}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-xl font-bold">No expenses</p>
        )}
      </StatCard>
    </div>
  );
}
