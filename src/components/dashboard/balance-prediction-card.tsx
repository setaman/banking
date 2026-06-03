"use client";

import { Target } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DashboardStats } from "@/actions/stats.actions";

const MotionCard = motion.create(Card);

interface BalancePredictionCardProps {
  stats: DashboardStats | null;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export function BalancePredictionCard({ stats }: BalancePredictionCardProps) {
  // Loading state — stats not yet available
  if (stats === null) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-40" />
          <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
        </div>
        <Card className="relative overflow-hidden border-violet-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-8 w-8 rounded-xl" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mb-1 h-9 w-40" />
            <Skeleton className="mb-2 h-3 w-48" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const prediction = stats.balancePrediction;

  // Section heading row — always render with gradient/icon alive
  const sectionHeading = (monthsUsed?: number) => (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Target className="text-muted-foreground h-4 w-4" />
      <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
        Balance Forecast
      </h2>
      <div className="h-px flex-1 bg-gradient-to-r from-violet-500/20 to-transparent" />
      {monthsUsed !== undefined && (
        <span className="text-muted-foreground text-xs">
          based on your last {monthsUsed} month{monthsUsed === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );

  // Unavailable state (insufficient-history or no-data)
  if (!prediction.available) {
    return (
      <div>
        {sectionHeading()}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="relative overflow-hidden border-violet-500/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 opacity-50" />

          <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-muted-foreground cursor-default text-sm font-medium">
                    Projected Balance (1 Year)
                  </p>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  This is a rough estimate of where your total balance could be
                  in one year, based on your recent spending and income
                  patterns. It&apos;s not a guarantee — unexpected expenses or
                  changes in income will shift this number.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="bg-background/20 rounded-xl p-2 backdrop-blur-md">
              <Target className="h-4 w-4 text-current opacity-80" />
            </div>
          </CardHeader>

          <CardContent className="relative z-10">
            <h3 className="bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-3xl font-bold text-transparent">
              —
            </h3>
            <p className="text-muted-foreground/80 mt-0.5 text-xs font-medium">
              not enough data yet
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              We need at least 3 months of history to estimate your future
              balance. Keep tracking and check back soon.
            </p>
          </CardContent>
        </MotionCard>
      </div>
    );
  }

  const { points, monthsUsed, confidence } = prediction.prediction;
  const lastPoint = points[points.length - 1];

  return (
    <div>
      {sectionHeading(monthsUsed)}
      <MotionCard
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
        className="relative overflow-hidden border-violet-500/20"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 opacity-50" />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-muted-foreground cursor-default text-sm font-medium">
                  Projected Balance (1 Year)
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                This is a rough estimate of where your total balance could be in
                one year, based on your recent spending and income patterns.
                It&apos;s not a guarantee — unexpected expenses or changes in
                income will shift this number.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="bg-background/20 rounded-xl p-2 backdrop-blur-md">
            <Target className="h-4 w-4 text-current opacity-80" />
          </div>
        </CardHeader>

        <CardContent className="relative z-10">
          <h3 className="bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-3xl font-bold text-transparent">
            ~{formatCurrency(lastPoint.projected)}
          </h3>
          <p className="text-muted-foreground/80 mt-0.5 text-xs font-medium">
            between {formatCurrency(lastPoint.lowerBound)} and{" "}
            {formatCurrency(lastPoint.upperBound)}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            expected in 12 months
          </p>
          {confidence === "volatile" && (
            <p className="text-muted-foreground/70 mt-1.5 text-xs">
              Your monthly cash flow varies a lot, so treat this as a rough
              guide.
            </p>
          )}
          {confidence === "low" && (
            <p className="text-muted-foreground/70 mt-1.5 text-xs">
              Based on limited history — this will sharpen as more data comes
              in.
            </p>
          )}
        </CardContent>
      </MotionCard>
    </div>
  );
}
