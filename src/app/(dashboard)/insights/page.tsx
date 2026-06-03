/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import {
  TrendingUp,
  Activity,
  Zap,
  Calendar,
  Repeat,
  Target,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getTransactions } from "@/actions/transactions.actions";
import { getTotalBalance } from "@/actions/accounts.actions";
import {
  calculateEmergencyFund,
  calculateExpenseVolatility,
  calculateBalancePrediction,
  calculateMonthlyCashFlow,
  type EmergencyFund,
  type ExpenseVolatility,
} from "@/lib/stats/calculations";
import {
  detectRecurring,
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
          getTransactions(undefined, { excludeInternal: true }),
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
    const weekdayDays = new Set<string>();
    const weekendDays = new Set<string>();

    expenses.forEach((tx) => {
      const date = parseISO(tx.bookingDate);
      const dayOfWeek = getDay(date);
      const absAmount = Math.abs(tx.amount);

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Sunday or Saturday
        weekendTotal += absAmount;
        weekendDays.add(tx.bookingDate);
      } else {
        weekdayTotal += absAmount;
        weekdayDays.add(tx.bookingDate);
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
    [balance, transactions]
  );

  // Detect recurring expenses
  const recurringExpenses = useMemo(
    (): RecurringTransactionGroup[] => detectRecurring(transactions),
    [transactions]
  );

  // Calculate expense volatility
  const expenseVolatility = useMemo(
    (): ExpenseVolatility => calculateExpenseVolatility(transactions),
    [transactions]
  );

  // Balance prediction — client-side, uses full transaction history + current balance
  const balancePrediction = useMemo(
    () =>
      calculateBalancePrediction({
        totalBalance: balance,
        monthlyCashFlow: calculateMonthlyCashFlow(transactions),
      }),
    [balance, transactions]
  );

  // Calculate daily spending with income markers
  const dailySpending = useMemo(() => {
    const dailyMap = new Map<
      string,
      { expenses: number; income: number; net: number }
    >();

    transactions.forEach((tx) => {
      if (!dailyMap.has(tx.bookingDate)) {
        dailyMap.set(tx.bookingDate, { expenses: 0, income: 0, net: 0 });
      }
      const day = dailyMap.get(tx.bookingDate)!;
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
  const textColor = isDark
    ? "rgba(241, 245, 249, 0.9)"
    : "rgba(30, 41, 59, 0.8)";
  const gridColor = isDark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(0, 0, 0, 0.12)";

  // Weekend vs Weekday Chart
  const weekendChartOption = useMemo((): EChartsOption => {
    return {
      animation: true,
      backgroundColor: "transparent",
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
          ? "rgba(30, 41, 59, 0.95)"
          : "rgba(255, 255, 255, 0.95)",
        borderColor: isDark
          ? "rgba(255, 255, 255, 0.15)"
          : "rgba(0, 0, 0, 0.1)",
        borderWidth: 1,
        textStyle: {
          color: isDark ? "rgba(241, 245, 249, 1)" : "rgba(30, 41, 59, 1)",
          fontSize: 12,
        },
        padding: [8, 12],
        formatter: (params: any) => {
          const data = params[0];
          return `<div style="padding: 4px 0;">
            <div style="font-weight: 600; margin-bottom: 6px;">${data.name}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: rgba(139, 92, 246, 1);"></span>
              <span style="flex: 1;">Avg/Day:</span>
              <span style="font-weight: 600;">${formatCurrency(data.value)}</span>
            </div>
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
        const month = tx.bookingDate.substring(0, 7);
        monthlyExpenses.set(
          month,
          (monthlyExpenses.get(month) || 0) + Math.abs(tx.amount)
        );
      });

    const sortedMonths = Array.from(monthlyExpenses.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    return {
      animation: true,
      backgroundColor: "transparent",
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
          ? "rgba(30, 41, 59, 0.95)"
          : "rgba(255, 255, 255, 0.95)",
        borderColor: isDark
          ? "rgba(255, 255, 255, 0.15)"
          : "rgba(0, 0, 0, 0.1)",
        textStyle: {
          color: isDark ? "rgba(241, 245, 249, 1)" : "rgba(30, 41, 59, 1)",
          fontSize: 12,
        },
        padding: [8, 12],
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const param = params[0];
          return `
            <div style="padding: 4px 0;">
              <div style="font-weight: 600; margin-bottom: 6px;">${param.name}</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: rgba(251, 146, 60, 1);"></span>
                <span style="flex: 1;">Total Expenses:</span>
                <span style="font-weight: 600;">${formatCurrency(param.value)}</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: "category",
        data: sortedMonths.map(([month]) =>
          format(parseISO(month + "-01"), "MMM yy")
        ),
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
      backgroundColor: "transparent",
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
        borderWidth: 1,
        textStyle: {
          color: isDark ? "rgba(241, 245, 249, 1)" : "rgba(30, 41, 59, 1)",
          fontSize: 12,
        },
        padding: [8, 12],
        formatter: (params: any) => {
          const data = params[0];
          const dayData = last30Days[data.dataIndex];
          const dateStr = format(parseISO(dayData.date), "MMM dd");
          return `<div style="padding: 4px 0;">
            <div style="font-weight: 600; margin-bottom: 6px;">${dateStr}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: rgba(244, 114, 182, 1);"></span>
              <span style="flex: 1;">Expenses:</span>
              <span style="font-weight: 600;">${formatCurrency(dayData.expenses)}</span>
            </div>
            ${
              dayData.income > 0
                ? `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: rgba(20, 184, 166, 1);"></span>
              <span style="flex: 1;">Income:</span>
              <span style="font-weight: 600;">${formatCurrency(dayData.income)}</span>
            </div>`
                : ""
            }
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

  // Balance Forecast Chart — self-contained, never shares state with other charts
  const forecastChartOption = useMemo((): EChartsOption | null => {
    if (!balancePrediction.available) return null;

    const { points } = balancePrediction.prediction;
    const projLineColor = isDark
      ? "rgba(139, 92, 246, 0.9)"
      : "rgba(124, 58, 237, 0.9)";
    const bandTopAlpha = isDark ? 0.12 : 0.08;
    const bandBotAlpha = isDark ? 0.03 : 0.02;

    // x-axis labels: "Now" + 12 projected month labels
    const xLabels = [
      "Now",
      ...points.map((p) => format(parseISO(p.month + "-01"), "MMM yy")),
    ];

    // Projected line: anchor at current balance (index 0) then 12 points
    const projectedValues = [balance, ...points.map((p) => p.projected)];

    // Confidence band lower series (transparent base, stacked)
    const bandBaseValues = [balance, ...points.map((p) => p.lowerBound)];

    // Confidence band fill series: height = upper - lower (stacked on base)
    const bandFillValues = [
      0,
      ...points.map((p) => p.upperBound - p.lowerBound),
    ];

    return {
      animation: true,
      backgroundColor: "transparent",
      grid: {
        left: "5%",
        right: "4%",
        bottom: "10%",
        top: "15%",
        containLabel: true,
      },
      legend: {
        show: true,
        top: 0,
        right: 0,
        textStyle: { color: textColor, fontSize: 12 },
        // Only show the projected balance series; exclude underscore-named helpers
        data: [
          {
            name: "Projected Balance",
            icon: "path://M0,5 L4,5 M8,5 L12,5 M16,5 L20,5",
            itemStyle: { color: projLineColor },
            lineStyle: { color: projLineColor, type: "dashed", width: 2 },
          },
        ],
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark
          ? "rgba(30, 41, 59, 0.95)"
          : "rgba(255, 255, 255, 0.95)",
        borderColor: isDark
          ? "rgba(255, 255, 255, 0.15)"
          : "rgba(0, 0, 0, 0.1)",
        borderWidth: 1,
        textStyle: {
          color: isDark ? "rgba(241, 245, 249, 1)" : "rgba(30, 41, 59, 1)",
          fontSize: 12,
        },
        padding: [8, 12],
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const idx = params[0].dataIndex as number;
          const label = xLabels[idx];

          // Index 0 is "Now" (current balance anchor) — show actual balance
          if (idx === 0) {
            return `<div style="padding: 4px 0;">
              <div style="font-weight: 600; margin-bottom: 6px;">Now</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 10px; height: 2px; border-top: 2px dashed ${projLineColor}; flex-shrink: 0;"></span>
                <span style="flex: 1;">Current Balance:</span>
                <span style="font-weight: 600;">${formatCurrency(balance)}</span>
              </div>
            </div>`;
          }

          const pt = points[idx - 1];
          return `<div style="padding: 4px 0;">
            <div style="font-weight: 600; margin-bottom: 6px;">${label}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 10px; height: 2px; border-top: 2px dashed ${projLineColor}; flex-shrink: 0;"></span>
              <span style="flex: 1;">Projected:</span>
              <span style="font-weight: 600;">~${formatCurrency(pt.projected)}</span>
            </div>
            <div style="margin-top: 4px; font-size: 11px; color: ${isDark ? "rgba(148, 163, 184, 0.8)" : "rgba(100, 116, 139, 0.8)"};">
              Range: ${formatCurrency(pt.lowerBound)} — ${formatCurrency(pt.upperBound)}
            </div>
            <div style="margin-top: 2px; font-size: 11px; font-style: italic; color: ${isDark ? "rgba(148, 163, 184, 0.6)" : "rgba(100, 116, 139, 0.6)"};">(estimated)</div>
          </div>`;
        },
      },
      xAxis: {
        type: "category",
        data: xLabels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: textColor, fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: (value: number) => {
            if (Math.abs(value) >= 1000) {
              return `€${(value / 1000).toFixed(1)}k`;
            }
            return `€${value.toFixed(0)}`;
          },
        },
        splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
      },
      series: [
        // Band base — transparent floor at lowerBound (stacked, no visible area)
        {
          name: "_bandBase",
          type: "line",
          smooth: true,
          showSymbol: false,
          stack: "forecastBand",
          lineStyle: { width: 0, color: "transparent" },
          areaStyle: { color: "transparent", opacity: 0 },
          itemStyle: { color: "transparent", opacity: 0 },
          legendHoverLink: false,
          silent: true,
          data: bandBaseValues,
        },
        // Band fill — stacked height of upper - lower, violet gradient
        {
          name: "_bandFill",
          type: "line",
          smooth: true,
          showSymbol: false,
          stack: "forecastBand",
          lineStyle: { width: 0, color: "transparent" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `rgba(139, 92, 246, ${bandTopAlpha})` },
                { offset: 1, color: `rgba(139, 92, 246, ${bandBotAlpha})` },
              ],
            },
          },
          itemStyle: { color: "transparent", opacity: 0 },
          legendHoverLink: false,
          silent: true,
          data: bandFillValues,
        },
        // Projected balance dashed violet line
        {
          name: "Projected Balance",
          type: "line",
          smooth: true,
          showSymbol: false,
          z: 8,
          lineStyle: {
            width: 2.5,
            color: projLineColor,
            type: "dashed",
          },
          itemStyle: { color: projLineColor },
          emphasis: {
            focus: "series",
            lineStyle: { width: 3 },
          },
          data: projectedValues,
        },
      ],
    };
  }, [balancePrediction, balance, isDark, textColor, gridColor]);

  // Safety Net Gauge
  const safetyNetBaseColor = useMemo(() => {
    if (emergencyFund.months >= 6) return "0.7 0.18 150"; // Green
    if (emergencyFund.months >= 3) return "0.8 0.15 80"; // Orange
    return "0.7 0.2 340"; // Pink/Red
  }, [emergencyFund.months]);

  const safetyNetColor = `oklch(${safetyNetBaseColor})`;

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
              <p className="text-lg font-semibold text-rose-400">
                Failed to load insights
              </p>
              <p className="text-muted-foreground mt-2 text-sm">{error}</p>
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
        <h1 className="text-glow text-4xl font-bold tracking-tight">
          <span className="from-foreground to-foreground/50 bg-gradient-to-r bg-clip-text text-transparent">
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
              <Activity className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground text-lg">
                No transaction data available
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Sync your accounts to see behavioral insights
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* ── Balance Forecast (flagship forward-looking section) ── */}
          <div>
            {/* Section heading */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Target className="text-muted-foreground h-4 w-4" />
              <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                Balance Forecast
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-violet-500/20 to-transparent" />
              {balancePrediction.available && (
                <span className="text-muted-foreground text-xs">
                  based on your last {balancePrediction.prediction.monthsUsed}{" "}
                  month
                  {balancePrediction.prediction.monthsUsed === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {balancePrediction.available ? (
              <MotionCard
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="border-primary/10 relative overflow-hidden md:col-span-2"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-indigo-500/5 opacity-50" />

                <CardHeader className="relative z-10 flex flex-row items-start justify-between gap-4 pb-4">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-violet-400" />
                      12-Month Balance Projection
                    </CardTitle>
                    <p className="text-muted-foreground mt-1 text-sm">
                      A rough estimate of where your total balance is heading,
                      based on your recent monthly income vs spending. Not a
                      guarantee.
                    </p>
                  </div>
                  {/* Summary stat */}
                  <div className="shrink-0 text-right">
                    <p className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-2xl font-bold text-transparent">
                      ~
                      {formatCurrency(
                        balancePrediction.prediction.points[11].projected
                      )}
                    </p>
                    <p className="text-muted-foreground/80 text-xs">
                      expected in 12 months
                    </p>
                    <p className="text-muted-foreground/70 mt-0.5 text-xs">
                      between{" "}
                      {formatCurrency(
                        balancePrediction.prediction.points[11].lowerBound
                      )}{" "}
                      and{" "}
                      {formatCurrency(
                        balancePrediction.prediction.points[11].upperBound
                      )}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="relative z-10">
                  {/* Confidence notes */}
                  {balancePrediction.prediction.confidence === "volatile" && (
                    <p className="text-muted-foreground/70 mb-3 text-xs">
                      Your monthly cash flow varies a lot, so treat this as a
                      rough guide.
                    </p>
                  )}
                  {balancePrediction.prediction.confidence === "low" && (
                    <p className="text-muted-foreground/70 mb-3 text-xs">
                      Based on limited history — this will sharpen over time.
                    </p>
                  )}

                  {/* Self-contained forecast chart */}
                  {forecastChartOption && (
                    <div className="h-[280px]">
                      <ReactECharts
                        option={forecastChartOption}
                        style={{ height: "100%", width: "100%" }}
                        notMerge={true}
                      />
                    </div>
                  )}
                </CardContent>
              </MotionCard>
            ) : (
              /* Unavailable state */
              <MotionCard
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="relative overflow-hidden border-violet-500/20"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-indigo-500/5 opacity-50" />
                <CardContent className="relative z-10 flex items-center justify-between gap-6 p-6">
                  <div>
                    <p className="text-3xl font-bold text-violet-400/60">—</p>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Not enough history yet — we need at least 3 months to
                      forecast your balance. Keep tracking and check back soon.
                    </p>
                  </div>
                  <Target className="h-10 w-10 shrink-0 text-violet-400/30" />
                </CardContent>
              </MotionCard>
            )}
          </div>

          {/* ── Existing analytics grid ── */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Weekend vs Weekday Spending */}
            <MotionCard
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border-primary/10 relative overflow-hidden"
            >
              <div className="from-primary/5 to-chart-2/5 absolute inset-0 bg-gradient-to-br via-transparent opacity-50" />
              <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="text-primary h-5 w-5" />
                    Weekend vs Weekday
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
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
              className="border-primary/10 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-50" />
              <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-emerald-400" />
                    Safety Net
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
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
                        stroke={
                          isDark
                            ? "oklch(0.3 0.05 260 / 0.2)"
                            : "oklch(0.92 0.02 260 / 0.4)"
                        }
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
                      <p
                        className="text-5xl font-bold"
                        style={{ color: safetyNetColor }}
                      >
                        {emergencyFund.months.toFixed(1)}
                      </p>
                      <p className="text-muted-foreground text-sm">months</p>
                    </div>
                  </div>
                  <div className="mt-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      Current Balance: {formatCurrency(emergencyFund.balance)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Avg Monthly Expenses:{" "}
                      {formatCurrency(emergencyFund.avgMonthlyExpenses)}
                    </p>
                    <Badge
                      className="mt-4 px-3 py-1 font-semibold"
                      style={{
                        backgroundColor: `oklch(${safetyNetBaseColor} / 0.15)`,
                        color: isDark
                          ? `oklch(0.9 ${safetyNetBaseColor.split(" ").slice(1).join(" ")})`
                          : `oklch(0.4 ${safetyNetBaseColor.split(" ").slice(1).join(" ")})`,
                        borderColor: `oklch(${safetyNetBaseColor} / 0.3)`,
                      }}
                    >
                      {emergencyFund.months >= 6
                        ? "Excellent Coverage"
                        : emergencyFund.months >= 3
                          ? "Good Coverage"
                          : "Building Funds"}
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
              className="border-primary/10 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 opacity-50" />
              <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Repeat className="h-5 w-5 text-purple-400" />
                    Recurring Expenses
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Detected monthly patterns
                  </p>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                {recurringExpenses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Repeat className="text-muted-foreground mb-4 h-12 w-12" />
                    <p className="text-muted-foreground">
                      No recurring expenses detected
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Need at least 3 similar transactions to detect patterns
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[320px] space-y-3 overflow-y-auto pr-2">
                    {recurringExpenses.slice(0, 10).map((group, idx) => {
                      const baseColors = [
                        "0.6 0.2 260", // Blue
                        "0.65 0.2 310", // Magenta
                        "0.7 0.18 150", // Green
                        "0.8 0.15 80", // Orange
                        "0.7 0.2 340", // Pink
                      ];
                      const baseColor = baseColors[idx % 5];
                      const [L, C, H] = baseColor.split(" ");

                      return (
                        <div
                          key={idx}
                          className="glass-panel bg-card/30 hover:bg-card/50 flex items-center justify-between rounded-xl border border-white/5 p-4 transition-all duration-200"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground truncate text-base font-semibold">
                              {group.counterparty}
                            </p>
                            <div className="mt-1.5 flex items-center gap-3">
                              <Badge
                                className="px-2 py-0.5 text-xs font-bold"
                                style={{
                                  backgroundColor: `oklch(${L} ${C} ${H} / 0.15)`,
                                  color: isDark
                                    ? `oklch(0.9 ${C} ${H})`
                                    : `oklch(0.4 ${C} ${H})`,
                                  borderColor: `oklch(${L} ${C} ${H} / 0.3)`,
                                }}
                              >
                                {group.category}
                              </Badge>
                              <span className="text-muted-foreground/90 text-xs font-medium">
                                ~{Math.round(group.averageInterval)} days
                              </span>
                            </div>
                          </div>
                          <div className="ml-4 text-right">
                            <p className="text-foreground text-lg font-bold">
                              {formatCurrency(group.averageAmount)}
                            </p>
                            <p className="text-muted-foreground/80 mt-0.5 text-xs font-medium">
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
              className="border-primary/10 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-amber-500/5 opacity-50" />
              <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-4">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-orange-400" />
                    Expense Volatility
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Monthly spending variation
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Std Dev</p>
                  <p className="text-foreground text-lg font-bold">
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
              className="border-primary/10 relative overflow-hidden md:col-span-2"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 via-transparent to-purple-500/5 opacity-50" />
              <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-pink-400" />
                    Financial Pulse
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
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
        </div>
      )}
    </div>
  );
}
