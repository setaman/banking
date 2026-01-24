"use client";

import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { getDashboardStats } from "@/actions/stats.actions";
import type { TransactionFilters } from "@/actions/transactions.actions";

const MotionCard = motion.create(Card);

interface CardData {
  title: string;
  amount: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: typeof Wallet;
  gradient: string;
  border: string;
  textGradient: string;
}

interface OverviewCardsProps {
  filters?: TransactionFilters;
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

export function OverviewCards({ filters }: OverviewCardsProps) {
  const [cards, setCards] = useState<CardData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const stats = await getDashboardStats(filters);

        // Calculate month-over-month trends
        const monthlyCashFlow = stats.monthlyCashFlow;
        let balanceTrend: "up" | "down" | "neutral" = "neutral";
        let balanceChange = "0.0%";
        let incomeTrend: "up" | "down" | "neutral" = "neutral";
        let incomeChange = "0.0%";
        let expenseTrend: "up" | "down" | "neutral" = "neutral";
        let expenseChange = "0.0%";

        if (monthlyCashFlow.length >= 2) {
          const currentMonth = monthlyCashFlow[monthlyCashFlow.length - 1];
          const previousMonth = monthlyCashFlow[monthlyCashFlow.length - 2];

          // Calculate trends
          if (previousMonth.net !== 0) {
            const netChange = ((currentMonth.net - previousMonth.net) / Math.abs(previousMonth.net)) * 100;
            balanceTrend = netChange > 0 ? "up" : netChange < 0 ? "down" : "neutral";
            balanceChange = formatPercentage(netChange);
          }

          if (previousMonth.income !== 0) {
            const incChange = ((currentMonth.income - previousMonth.income) / previousMonth.income) * 100;
            incomeTrend = incChange > 0 ? "up" : incChange < 0 ? "down" : "neutral";
            incomeChange = formatPercentage(incChange);
          }

          if (previousMonth.expenses !== 0) {
            const expChange = ((currentMonth.expenses - previousMonth.expenses) / previousMonth.expenses) * 100;
            // For expenses, down is good (less spending)
            expenseTrend = expChange > 0 ? "up" : expChange < 0 ? "down" : "neutral";
            expenseChange = formatPercentage(expChange);
          }
        }

        const cardData: CardData[] = [
          {
            title: "Total Balance",
            amount: formatCurrency(stats.totalBalance),
            change: balanceChange,
            trend: balanceTrend,
            icon: Wallet,
            gradient: "from-blue-500/20 to-purple-500/20",
            border: "border-blue-500/20",
            textGradient: "from-blue-400 to-purple-400",
          },
          {
            title: "Income",
            amount: formatCurrency(stats.totalIncome),
            change: incomeChange,
            trend: incomeTrend,
            icon: ArrowUpRight,
            gradient: "from-emerald-500/20 to-teal-500/20",
            border: "border-emerald-500/20",
            textGradient: "from-emerald-400 to-teal-400",
          },
          {
            title: "Expenses",
            amount: formatCurrency(stats.totalExpenses),
            change: expenseChange,
            trend: expenseTrend,
            icon: ArrowDownRight,
            gradient: "from-rose-500/20 to-orange-500/20",
            border: "border-rose-500/20",
            textGradient: "from-rose-400 to-orange-400",
          },
        ];

        setCards(cardData);
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      }
    }

    fetchData();
  }, [filters]);

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
        const TrendIcon = card.trend === "up" ? TrendingUp : card.trend === "down" ? TrendingDown : null;
        const trendColor = card.title === "Expenses"
          ? (card.trend === "down" ? "text-emerald-400" : card.trend === "up" ? "text-rose-400" : "text-muted-foreground")
          : (card.trend === "up" ? "text-emerald-400" : card.trend === "down" ? "text-rose-400" : "text-muted-foreground");

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
                <span className="text-muted-foreground ml-2">vs last month</span>
              </div>
            </CardContent>
          </MotionCard>
        );
      })}
    </div>
  );
}
