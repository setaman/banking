"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Calendar,
  Repeat,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getTransactions } from "@/actions/transactions.actions";
import { getTotalBalance } from "@/actions/accounts.actions";
import {
  calculateEmergencyFund,
  calculateExpenseVolatility,
  type EmergencyFund,
  type ExpenseVolatility,
} from "@/lib/stats/calculations";
import {
  detectRecurring,
  categorizeTransaction,
  type RecurringTransactionGroup,
} from "@/lib/stats/categories";
import type { UnifiedTransaction } from "@/lib/banking/types";
import { format, parseISO, getDay } from "date-fns";

const MotionCard = motion.create(Card);

interface WeekendVsWeekdayData {
  weekdayAvg: number;
  weekendAvg: number;
  weekdayTotal: number;
  weekendTotal: number;
  weekdayDays: number;
  weekendDays: number;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export default function InsightsPage() {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [txData, balanceData] = await Promise.all([
          getTransactions(),
          getTotalBalance(),
        ]);
        setTransactions(txData);
        setBalance(balanceData);
      } catch (err) {
        console.error("Failed to load insights data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calculate weekend vs weekday spending
  const weekendVsWeekday = useMemo((): WeekendVsWeekdayData => {
    const expenses = transactions.filter((tx) => tx.amount < 0);
    let weekdayTotal = 0;
    let weekendTotal = 0;
    let weekdayDays = new Set<string>();
    let weekendDays = new Set<string>();

    expenses.forEach((tx) => {
      const date = parseISO(tx.date);
      const dayOfWeek = getDay(date);
      const absAmount = Math.abs(tx.amount);

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Sunday or Saturday
        weekendTotal += absAmount;
        weekendDays.add(tx.date);
      } else {
        weekdayTotal += absAmount;
        weekdayDays.add(tx.date);
      }
    });

    return {
      weekdayTotal,
      weekendTotal,
      weekdayDays: weekdayDays.size,
      weekendDays: weekendDays.size,
      weekdayAvg: weekdayDays.size > 0 ? weekdayTotal / weekdayDays.size : 0,
      weekendAvg: weekendDays.size > 0 ? weekendTotal / weekendDays.size : 0,
    };
  }, [transactions]);

  // Calculate emergency fund
  const emergencyFund = useMemo(
    (): EmergencyFund => calculateEmergencyFund(balance, transactions),
    [balance, transactions],
  );

  // Detect recurring expenses
  const recurringExpenses = useMemo(
    (): RecurringTransactionGroup[] => detectRecurring(transactions),
    [transactions],
  );

  // Calculate expense volatility
  const expenseVolatility = useMemo(
    (): ExpenseVolatility => calculateExpenseVolatility(transactions),
    [transactions],
  );

  // Calculate daily spending with income markers
  const dailySpending = useMemo(() => {
    const dailyMap = new Map<
      string,
      { expenses: number; income: number; net: number }
    >();

    transactions.forEach((tx) => {
      if (!dailyMap.has(tx.date)) {
        dailyMap.set(tx.date, { expenses: 0, income: 0, net: 0 });
      }
      const day = dailyMap.get(tx.date)!;
      if (tx.amount < 0) {
        day.expenses += Math.abs(tx.amount);
      } else {
        day.income += tx.amount;
      }
      day.net += tx.amount;
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  const isDark = resolvedTheme === "dark";
  const textColor = isDark ? "oklch(0.7 0.05 260)" : "oklch(0.55 0.05 260)";
  const gridColor = isDark
    ? "oklch(0.3 0.05 260 / 0.2)"
    : "oklch(0.92 0.02 260 / 0.4)";

  // Weekend vs Weekday Chart
  const weekendChartOption = useMemo((): EChartsOption => {
    return {
      animation: true,
      grid: {
        left: "5%",
        right: "5%",
        bottom: "10%",
        top: "5%",
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark
          ? "oklch(0.16 0.05 260 / 0.95)"
          : "oklch(1 0 0 / 0.95)",
        borderColor: isDark
          ? "oklch(0.3 0.05 260 / 0.3)"
          : "oklch(0.92 0.02 260 / 0.6)",
        textStyle: {
          color: isDark ? "oklch(0.95 0.02 260)" : "oklch(0.15 0.04 260)",
        },
        formatter: (params: any) => {
          const data = params[0];
          return `<div style="padding: 4px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${data.name}</div>
            <div>Avg/Day: <strong>${formatCurrency(data.value)}</strong></div>
          </div>`;
        },
      },
      xAxis: {
        type: "category",
        data: ["Weekday", "Weekend"],
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: textColor, fontSize: 12 },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: (value: number) => `€${value.toFixed(0)}`,
        },
        splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
      },
      series: [
        {
          type: "bar",
          data: [weekendVsWeekday.weekdayAvg, weekendVsWeekday.weekendAvg],
          itemStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(139, 92, 246, 1)" },
                { offset: 1, color: "rgba(217, 70, 239, 1)" },
              ],
            },
            borderRadius: [8, 8, 0, 0],
          },
          barWidth: "60%",
          emphasis: {
            itemStyle: {
              color: "inherit",
            },
          },
          label: {
            show: true,
            position: "top",
            color: textColor,
            formatter: (params: any) => formatCurrency(params.value),
          },
        },
      ],
    };
  }, [weekendVsWeekday, isDark, textColor, gridColor]);

  // Expense Volatility Chart (Line chart showing monthly expenses)
  const volatilityChartOption = useMemo((): EChartsOption => {
    const monthlyExpenses = new Map<string, number>();
    transactions
      .filter((tx) => tx.amount < 0)
      .forEach((tx) => {
        const month = tx.date.substring(0, 7);
        monthlyExpenses.set(
          month,
          (monthlyExpenses.get(month) || 0) + Math.abs(tx.amount),
        );
      });

    const sortedMonths = Array.from(monthlyExpenses.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    return {
      animation: true,
      grid: {
        left: "5%",
        right: "5%",
        bottom: "10%",
        top: "10%",
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark
          ? "rgba(30, 41, 59, 0.95)"
          : "rgba(255, 255, 255, 0.95)",
        borderColor: isDark
          ? "rgba(255, 255, 255, 0.15)"
          : "rgba(0, 0, 0, 0.1)",
        textStyle: {
          color: isDark ? "rgba(241, 245, 249, 1)" : "rgba(30, 41, 59, 1)",
        },
      },
      xAxis: {
        type: "category",
        data: sortedMonths.map(([month]) => format(parseISO(month + "-01"), "MMM yy")),
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: textColor, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: (value: number) => `€${(value / 1000).toFixed(1)}k`,
        },
        splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
      },
      series: [
        {
          type: "line",
          data: sortedMonths.map(([, amount]) => amount),
          smooth: true,
          lineStyle: {
            width: 3,
            color: "rgba(251, 146, 60, 1)", // orange-400 equivalent
          },
          itemStyle: {
            color: "rgba(251, 146, 60, 1)",
          },
          emphasis: {
            itemStyle: {
              color: "inherit",
            },
            lineStyle: {
              color: "inherit",
            },
            areaStyle: {
              color: "inherit",
            },
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(251, 146, 60, 0.3)" },
                { offset: 1, color: "rgba(251, 146, 60, 0.05)" },
              ],
            },
          },
        },
      ],
    };
  }, [transactions, isDark, textColor, gridColor]);

  // Financial Pulse Chart (Sparkline with income markers)
  const pulseChartOption = useMemo((): EChartsOption => {
    const last30Days = dailySpending.slice(-30);

    return {
      animation: true,
      grid: {
        left: "5%",
        right: "5%",
        bottom: "5%",
        top: "5%",
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark
          ? "oklch(0.16 0.05 260 / 0.95)"
          : "oklch(1 0 0 / 0.95)",
        borderColor: isDark
          ? "oklch(0.3 0.05 260 / 0.3)"
          : "oklch(0.92 0.02 260 / 0.6)",
        textStyle: {
          color: isDark ? "rgba(241, 245, 249, 1)" : "rgba(30, 41, 59, 1)",
        },
        formatter: (params: any) => {
          const data = params[0];
          const dayData = last30Days[data.dataIndex];
          const dateStr = format(parseISO(dayData.date), "MMM dd");
          return `<div style="padding: 4px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${dateStr}</div>
            <div>Expenses: ${formatCurrency(dayData.expenses)}</div>
            ${dayData.income > 0 ? `<div style="color: rgba(20, 184, 166, 1);">Income: ${formatCurrency(dayData.income)}</div>` : ""}
          </div>`;
        },
      },
      xAxis: {
        type: "category",
        data: last30Days.map((d) => format(parseISO(d.date), "MMM dd")),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
      },
      yAxis: {
        type: "value",
        show: false,
      },
      series: [
        {
          type: "line",
          data: last30Days.map((d) => d.expenses),
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 2,
            color: "rgba(244, 114, 182, 1)", // pink-400 equivalent
          },
          emphasis: {
            itemStyle: {
              color: "inherit",
            },
            lineStyle: {
              color: "inherit",
            },
            areaStyle: {
              color: "inherit",
            },
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(244, 114, 182, 0.3)" },
                { offset: 1, color: "rgba(244, 114, 182, 0.05)" },
              ],
            },
          },
        },
        {
          type: "scatter",
          data: last30Days
            .map((d, idx) => (d.income > 0 ? [idx, d.expenses] : null))
            .filter((d) => d !== null),
          symbolSize: 8,
          emphasis: {
            itemStyle: {
              color: "inherit",
            },
          },
          itemStyle: {
            color: "rgba(20, 184, 166, 1)",
            shadowBlur: 5,
            shadowColor: "rgba(20, 184, 166, 0.5)",
          },
        },
      ],
    };
  }, [dailySpending, isDark]);

  // Safety Net Gauge
  const safetyNetColor = useMemo(() => {
    if (emergencyFund.months >= 6) return "oklch(0.7 0.18 150)"; // Green
    if (emergencyFund.months >= 3) return "oklch(0.8 0.15 80)"; // Orange
    return "oklch(0.7 0.2 340)"; // Pink/Red
  }, [emergencyFund.months]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card className="border-rose-500/20">
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <p className="text-rose-400 text-lg font-semibold">
                Failed to load insights
              </p>
              <p className="text-muted-foreground text-sm mt-2">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasData = transactions.length > 0;

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight text-glow">
          <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
            Behavioral Insights
          </span>
        </h1>
        <p className="text-muted-foreground">
          Advanced analytics on your spending patterns and financial health
        </p>
      </div>

      {!hasData ? (
        <Card className="border-primary/10">
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                No transaction data available
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                Sync your accounts to see behavioral insights
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Weekend vs Weekday Spending */}
          <MotionCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden border-primary/10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5 opacity-50" />
            <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Weekend vs Weekday
                </CardTitle>
                <p className="text-muted-foreground text-sm mt-1">
                  Average daily spending comparison
                </p>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="h-[250px]">
                <ReactECharts
                  option={weekendChartOption}
                  style={{ height: "100%", width: "100%" }}
                  notMerge={true}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground">Weekday Total</p>
                  <p className="text-foreground font-semibold">
                    {formatCurrency(weekendVsWeekday.weekdayTotal)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {weekendVsWeekday.weekdayDays} days
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Weekend Total</p>
                  <p className="text-foreground font-semibold">
                    {formatCurrency(weekendVsWeekday.weekendTotal)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {weekendVsWeekday.weekendDays} days
                  </p>
                </div>
              </div>
            </CardContent>
          </MotionCard>

          {/* Safety Net Gauge */}
          <MotionCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden border-primary/10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-50" />
            <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-emerald-400" />
                  Safety Net
                </CardTitle>
                <p className="text-muted-foreground text-sm mt-1">
                  Emergency fund coverage
                </p>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative">
                  <svg className="h-48 w-48 -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="80"
                      fill="none"
                      stroke={isDark ? "oklch(0.3 0.05 260 / 0.2)" : "oklch(0.92 0.02 260 / 0.4)"}
                      strokeWidth="16"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="80"
                      fill="none"
                      stroke={safetyNetColor}
                      strokeWidth="16"
                      strokeDasharray={`${(emergencyFund.months / 12) * 502.65} 502.65`}
                      strokeLinecap="round"
                      style={{
                        filter: `drop-shadow(0 0 8px ${safetyNetColor})`,
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-5xl font-bold" style={{ color: safetyNetColor }}>
                      {emergencyFund.months.toFixed(1)}
                    </p>
                    <p className="text-muted-foreground text-sm">months</p>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Current Balance: {formatCurrency(emergencyFund.balance)}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Avg Monthly Expenses: {formatCurrency(emergencyFund.avgMonthlyExpenses)}
                  </p>
                  <Badge
                    className="mt-3"
                    style={{
                      backgroundColor: safetyNetColor + "20",
                      color: safetyNetColor,
                      borderColor: safetyNetColor + "40",
                    }}
                  >
                    {emergencyFund.months >= 6
                      ? "Excellent"
                      : emergencyFund.months >= 3
                        ? "Good"
                        : "Build Up"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </MotionCard>

          {/* Recurring Expenses List */}
          <MotionCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden border-primary/10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 opacity-50" />
            <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Repeat className="h-5 w-5 text-purple-400" />
                  Recurring Expenses
                </CardTitle>
                <p className="text-muted-foreground text-sm mt-1">
                  Detected monthly patterns
                </p>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              {recurringExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Repeat className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No recurring expenses detected
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Need at least 3 similar transactions to detect patterns
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
                  {recurringExpenses.slice(0, 10).map((group, idx) => {
                    const categoryColor = [
                      "oklch(0.6 0.2 260)",
                      "oklch(0.65 0.2 310)",
                      "oklch(0.7 0.18 150)",
                      "oklch(0.8 0.15 80)",
                      "oklch(0.7 0.2 340)",
                    ][idx % 5];

                    return (
                      <div
                        key={idx}
                        className="glass-panel flex items-center justify-between p-3 rounded-lg border border-white/5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground font-medium truncate">
                            {group.counterparty}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              className="text-xs"
                              style={{
                                backgroundColor: categoryColor + "20",
                                color: categoryColor,
                                borderColor: categoryColor + "40",
                              }}
                            >
                              {group.category}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              ~{Math.round(group.averageInterval)} days
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-foreground font-semibold">
                            {formatCurrency(group.averageAmount)}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {group.transactions.length}× occurrences
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </MotionCard>

          {/* Expense Volatility Chart */}
          <MotionCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="relative overflow-hidden border-primary/10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-amber-500/5 opacity-50" />
            <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-4">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-orange-400" />
                  Expense Volatility
                </CardTitle>
                <p className="text-muted-foreground text-sm mt-1">
                  Monthly spending variation
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-xs">Std Dev</p>
                <p className="text-foreground font-bold text-lg">
                  {expenseVolatility.formatted}
                </p>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="h-[250px]">
                <ReactECharts
                  option={volatilityChartOption}
                  style={{ height: "100%", width: "100%" }}
                  notMerge={true}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground">Mean</p>
                  <p className="text-foreground font-semibold">
                    {formatCurrency(expenseVolatility.mean)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Coefficient</p>
                  <p className="text-foreground font-semibold">
                    {(expenseVolatility.coefficient * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </MotionCard>

          {/* Financial Pulse (Full Width) */}
          <MotionCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="relative overflow-hidden border-primary/10 md:col-span-2"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 via-transparent to-purple-500/5 opacity-50" />
            <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-pink-400" />
                  Financial Pulse
                </CardTitle>
                <p className="text-muted-foreground text-sm mt-1">
                  Last 30 days spending rhythm (green dots = income)
                </p>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="h-[200px]">
                <ReactECharts
                  option={pulseChartOption}
                  style={{ height: "100%", width: "100%" }}
                  notMerge={true}
                />
              </div>
            </CardContent>
          </MotionCard>
        </div>
      )}
    </div>
  );
}
