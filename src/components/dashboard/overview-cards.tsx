"use client";

import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
  Coins,
} from "lucide-react";
import { motion } from "motion/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { getDashboardStats } from "@/actions/stats.actions";
import type { TransactionFilters } from "@/actions/transactions.actions";
import type { DateRangePreset } from "@/hooks/use-date-range";

const MotionCard = motion.create(Card);

interface CardData {
  title: string;
  amount: string;
  change: string;
  trendLabel: string;
  trend: "up" | "down" | "neutral";
  icon: typeof Wallet;
  gradient: string;
  border: string;
  textGradient: string;
}

interface OverviewCardsProps {
  filters?: TransactionFilters;
  preset?: DateRangePreset;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatPercentage = (value: number): string => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};

/** Returns the human-readable comparison label for the given preset. */
function getTrendLabel(preset: DateRangePreset | undefined): string | null {
  switch (preset) {
    case "last7days":
      return "vs previous 7 days";
    case "last30days":
      return "vs previous 30 days";
    case "thisMonth":
      return "vs last month";
    case "lastMonth":
      return "vs month before";
    case "thisYear":
      return "vs last year";
    case "lastYear":
      return "vs year before";
    case "allTime":
      return null; // no meaningful comparison
    case "custom":
      return "vs previous period";
    default:
      return "vs previous period";
  }
}

/** Computes a percentage change, returning null when previous is zero. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function OverviewCards({ filters, preset }: OverviewCardsProps) {
  const [cards, setCards] = useState<CardData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const stats = await getDashboardStats(filters);

        const trendLabel = getTrendLabel(preset);
        const prev = stats.previousPeriod;

        // Helper: build change text + trend direction from a pct value
        const makeTrend = (
          pct: number | null,
        ): { change: string; trend: "up" | "down" | "neutral" } => {
          if (pct === null || trendLabel === null) {
            return { change: "—", trend: "neutral" };
          }
          return {
            change: formatPercentage(pct),
            trend: pct > 0 ? "up" : pct < 0 ? "down" : "neutral",
          };
        };

        // Income
        const incomePct = prev ? pctChange(stats.totalIncome, prev.totalIncome) : null;
        const incomeTrend = makeTrend(incomePct);

        // Expenses
        const expensesPct = prev ? pctChange(stats.totalExpenses, prev.totalExpenses) : null;
        const expensesTrend = makeTrend(expensesPct);

        // Net cash flow
        const cashFlowPct = prev ? pctChange(stats.netCashFlow, prev.netCashFlow) : null;
        const cashFlowTrend = makeTrend(cashFlowPct);

        // Savings rate (absolute percentage points, not pct-of-pct)
        const savingsPct = prev ? pctChange(stats.savingsRate, prev.savingsRate) : null;
        const savingsTrend = makeTrend(savingsPct);

        // Expense-to-income ratio
        const ratioPct = prev
          ? pctChange(stats.expenseToIncomeRatio, prev.expenseToIncomeRatio)
          : null;
        const ratioTrend = makeTrend(ratioPct);

        const sharedLabel = trendLabel ?? "—";

        const cardData: CardData[] = [
          {
            title: "Total Balance",
            amount: formatCurrency(stats.totalBalance),
            // Balance is a point-in-time value — no period comparison makes sense
            change: "—",
            trendLabel: "current balance",
            trend: "neutral",
            icon: Wallet,
            gradient: "from-blue-500/20 to-purple-500/20",
            border: "border-blue-500/20",
            textGradient: "from-blue-400 to-purple-400",
          },
          {
            title: "Income",
            amount: formatCurrency(stats.totalIncome),
            change: incomeTrend.change,
            trendLabel: sharedLabel,
            trend: incomeTrend.trend,
            icon: ArrowUpRight,
            gradient: "from-emerald-500/20 to-teal-500/20",
            border: "border-emerald-500/20",
            textGradient: "from-emerald-400 to-teal-400",
          },
          {
            title: "Expenses",
            amount: formatCurrency(stats.totalExpenses),
            change: expensesTrend.change,
            trendLabel: sharedLabel,
            trend: expensesTrend.trend,
            icon: ArrowDownRight,
            gradient: "from-rose-500/20 to-orange-500/20",
            border: "border-rose-500/20",
            textGradient: "from-rose-400 to-orange-400",
          },
          {
            title: "Net Cash Flow",
            amount: formatCurrency(stats.netCashFlow),
            change: cashFlowTrend.change,
            trendLabel: sharedLabel,
            trend: cashFlowTrend.trend,
            icon: Coins,
            gradient: "from-cyan-500/20 to-blue-500/20",
            border: "border-cyan-500/20",
            textGradient: "from-cyan-400 to-blue-400",
          },
          {
            title: "Savings Rate",
            amount: stats.savingsRate.toFixed(1) + "%",
            change: savingsTrend.change,
            trendLabel: sharedLabel,
            trend: savingsTrend.trend,
            icon: PiggyBank,
            gradient: "from-green-500/20 to-emerald-500/20",
            border: "border-green-500/20",
            textGradient: "from-green-400 to-emerald-400",
          },
          {
            title: "Expense-to-Income Ratio",
            amount: stats.expenseToIncomeRatio.toFixed(1) + "%",
            change: ratioTrend.change,
            trendLabel: sharedLabel,
            trend: ratioTrend.trend,
            icon: Percent,
            gradient: "from-orange-500/20 to-red-500/20",
            border: "border-orange-500/20",
            textGradient: "from-orange-400 to-red-400",
          },
        ];

        setCards(cardData);
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      }
    }

    fetchData();
  }, [filters, preset]);

  // Loading state
  if (!cards && !error) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {[...Array(3)].map((_, index) => (
          <Card key={index} className="relative overflow-hidden border-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-32 mb-3" />
              <Skeleton className="h-4 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-3 border-rose-500/20">
          <CardContent className="flex items-center justify-center p-6">
            <p className="text-rose-400 text-sm">
              Failed to load overview data: {error}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Data loaded successfully
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {cards!.map((card, index) => {
        const TrendIcon =
          card.trend === "up"
            ? TrendingUp
            : card.trend === "down"
              ? TrendingDown
              : null;
        const isBadIfUp =
          card.title === "Expenses" || card.title === "Expense-to-Income Ratio";
        const trendColor = isBadIfUp
          ? card.trend === "down"
            ? "text-emerald-400"
            : card.trend === "up"
              ? "text-rose-400"
              : "text-muted-foreground"
          : card.trend === "up"
            ? "text-emerald-400"
            : card.trend === "down"
              ? "text-rose-400"
              : "text-muted-foreground";

        return (
          <MotionCard
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`relative overflow-hidden ${card.border}`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50`}
            />

            <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-2">
              <p className="text-muted-foreground text-sm font-medium">
                {card.title}
              </p>
              <div className="bg-background/20 rounded-xl p-2 backdrop-blur-md">
                <card.icon className="h-4 w-4 text-current opacity-80" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <h3
                className={`bg-gradient-to-r text-3xl font-bold ${card.textGradient} bg-clip-text text-transparent`}
              >
                {card.amount}
              </h3>
              <div className="mt-2 flex items-center text-sm">
                <span
                  className={`${trendColor} flex items-center gap-1 font-medium`}
                >
                  {TrendIcon && <TrendIcon className="h-3 w-3" />}
                  {card.change}
                </span>
                <span className="text-muted-foreground ml-2">
                  {card.trendLabel}
                </span>
              </div>
            </CardContent>
          </MotionCard>
        );
      })}
    </div>
  );
}
