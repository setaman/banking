"use client";

import { ArrowUpRight, ArrowDownRight, Scale, BarChart3 } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { getDashboardStats } from "@/actions/stats.actions";
import type { MonthlyAverages } from "@/actions/stats.actions";
import type { TransactionFilters } from "@/actions/transactions.actions";
import type { DateRangePreset } from "@/hooks/use-date-range";

const MotionCard = motion.create(Card);

interface MonthlyAverageCardsProps {
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

export function MonthlyAverageCards({
  filters,
}: MonthlyAverageCardsProps) {
  const [averages, setAverages] = useState<MonthlyAverages | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setAverages(null);
        setError(null);
        const stats = await getDashboardStats(filters);
        setAverages(stats.averages);
      } catch (err) {
        console.error("Failed to fetch monthly averages:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      }
    }

    fetchData();
  }, [filters]);

  // Loading state
  if (!averages && !error) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-36" />
          <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <Card
              key={index}
              className="relative overflow-hidden border-white/5"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-8 rounded-xl" />
              </CardHeader>
              <CardContent>
                <Skeleton className="mb-1 h-9 w-32" />
                <Skeleton className="mb-2 h-3 w-16" />
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-rose-500/20 md:col-span-3">
          <CardContent className="flex items-center justify-center p-6">
            <p className="text-sm text-rose-400">
              Failed to load monthly averages: {error}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty data — hide the section rather than showing zeros
  if (averages!.avgMonthlyIncome === 0 && averages!.avgMonthlyExpenses === 0) {
    return null;
  }

  const {
    avgMonthlyIncome,
    avgMonthlyExpenses,
    avgMonthlyNet,
    monthsCount,
    isPartialMonth,
  } = averages!;

  const netIsNegative = avgMonthlyNet < 0;

  const cards = [
    {
      title: "Avg. Monthly Income",
      icon: ArrowUpRight,
      amount: formatCurrency(avgMonthlyIncome),
      overlay: "from-emerald-500/10 to-teal-500/10",
      border: "border-emerald-500/10",
      textGradient: "from-emerald-300 to-teal-300",
    },
    {
      title: "Avg. Monthly Spending",
      icon: ArrowDownRight,
      amount: formatCurrency(avgMonthlyExpenses),
      overlay: "from-rose-500/10 to-orange-500/10",
      border: "border-rose-500/10",
      textGradient: "from-rose-300 to-orange-300",
    },
    {
      title: "Avg. Monthly Net",
      icon: Scale,
      amount: formatCurrency(avgMonthlyNet),
      overlay: netIsNegative
        ? "from-rose-500/10 to-red-500/10"
        : "from-cyan-500/10 to-blue-500/10",
      border: netIsNegative ? "border-rose-500/10" : "border-cyan-500/10",
      textGradient: netIsNegative
        ? "from-rose-300 to-red-300"
        : "from-cyan-300 to-blue-300",
    },
  ];

  return (
    <div>
      {/* Section heading */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BarChart3 className="text-muted-foreground h-4 w-4" />
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
          Monthly Averages
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
        {isPartialMonth ? (
          <span className="text-xs text-amber-400/80">
            Partial month — showing period total
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">
            over {monthsCount} month{monthsCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((card, index) => (
          <MotionCard
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`relative overflow-hidden ${card.border}`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${card.overlay} opacity-50`}
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
              <p className="text-muted-foreground/80 mt-0.5 text-xs font-medium">
                / month
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                across {monthsCount} month{monthsCount === 1 ? "" : "s"}
              </p>
            </CardContent>
          </MotionCard>
        ))}
      </div>
    </div>
  );
}
