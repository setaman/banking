"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { calculateMonthlyFlow } from "@/lib/stats/calculations";
import type { UnifiedTransaction } from "@/lib/banking/types";
import { format, parseISO } from "date-fns";

const MotionCard = motion.create(Card);

interface IncomeExpensesChartProps {
  transactions: UnifiedTransaction[];
  className?: string;
}

export function IncomeExpensesChart({
  transactions,
  className,
}: IncomeExpensesChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const monthlyFlow = useMemo(
    () => calculateMonthlyFlow(transactions),
    [transactions],
  );

  const hasData = monthlyFlow.length > 0;

  // Theme colors for income (green) and expenses (red)
  const incomeColor = isDark
    ? "rgba(20, 184, 166, 1)"
    : "rgba(13, 148, 136, 1)"; // Teal/Green
  const expensesColor = isDark
    ? "rgba(244, 63, 94, 1)"
    : "rgba(225, 29, 72, 1)"; // Red/Orange-Red
  const netColor = isDark
    ? "rgba(167, 139, 250, 1)"
    : "rgba(124, 58, 237, 1)"; // Primary Purple

  const textColor = isDark
    ? "rgba(226, 232, 240, 1)"
    : "rgba(71, 85, 105, 1)";
  const gridColor = isDark
    ? "rgba(255, 255, 255, 0.1)"
    : "rgba(0, 0, 0, 0.1)";

  const getOption = (): EChartsOption => {
    // Prepare data arrays
    const months = monthlyFlow.map((item) => item.month);
    const incomeData = monthlyFlow.map((item) => item.income);
    const expensesData = monthlyFlow.map((item) => item.expenses);
    const netData = monthlyFlow.map((item) => item.net);

    return {
      animation: true,
      animationDuration: 1000,
      animationEasing: "cubicOut",
      backgroundColor: "transparent",
      grid: {
        left: "3%",
        right: "4%",
        bottom: "10%",
        top: "15%",
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: {
            color: isDark
              ? "oklch(0.3 0.05 260 / 0.1)"
              : "oklch(0.92 0.02 260 / 0.3)",
          },
        },
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
          const monthIndex = params[0].dataIndex;
          const month = months[monthIndex];
          const formattedMonth = format(parseISO(`${month}-01`), "MMM yyyy");

          const income = incomeData[monthIndex];
          const expenses = expensesData[monthIndex];
          const net = netData[monthIndex];

          const formatEUR = (value: number) =>
            new Intl.NumberFormat("de-DE", {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(value);

          return `
            <div style="padding: 4px 0;">
              <div style="font-weight: 600; margin-bottom: 6px;">${formattedMonth}</div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${incomeColor};"></span>
                <span style="flex: 1;">Income:</span>
                <span style="font-weight: 600; color: ${incomeColor};">${formatEUR(income)}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${expensesColor};"></span>
                <span style="flex: 1;">Expenses:</span>
                <span style="font-weight: 600; color: ${expensesColor};">${formatEUR(expenses)}</span>
              </div>
              <div style="border-top: 1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}; margin-top: 4px; padding-top: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="display: inline-block; width: 10px; height: 2px; background: ${netColor};"></span>
                  <span style="flex: 1;">Net:</span>
                  <span style="font-weight: 600; color: ${net >= 0 ? incomeColor : expensesColor};">${formatEUR(net)}</span>
                </div>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: "category",
        data: months.map((m) => format(parseISO(`${m}-01`), "MMM yyyy")),
        axisLine: {
          lineStyle: {
            color: gridColor,
          },
        },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          rotate: 0,
          interval: months.length > 12 ? Math.floor(months.length / 12) : 0,
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: "value",
        axisLine: {
          show: false,
        },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: (value: number) => {
            if (value >= 1000) {
              return `€${(value / 1000).toFixed(1)}k`;
            }
            return `€${value.toFixed(0)}`;
          },
        },
        splitLine: {
          lineStyle: {
            color: gridColor,
            type: "dashed",
          },
        },
      },
      legend: {
        show: true,
        top: 0,
        right: 0,
        textStyle: {
          color: textColor,
          fontSize: 12,
        },
        itemGap: 16,
        itemWidth: 14,
        itemHeight: 14,
      },
      series: [
        {
          name: "Income",
          type: "bar",
          barGap: "10%",
          barWidth: "30%",
          data: incomeData,
          itemStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: incomeColor },
                { offset: 1, color: incomeColor.replace(", 1)", ", 0.6)") },
              ],
            },
            borderRadius: [4, 4, 0, 0],
            shadowBlur: isDark ? 0 : 8,
            shadowColor: isDark ? "transparent" : incomeColor.replace(")", " / 0.2)"),
            shadowOffsetY: isDark ? 0 : 4,
          },
          emphasis: {
            itemStyle: {
              color: "inherit",
              shadowBlur: 15,
              shadowColor: incomeColor.replace(")", " / 0.4)"),
            },
          },
        },
        {
          name: "Expenses",
          type: "bar",
          barGap: "10%",
          barWidth: "30%",
          data: expensesData,
          itemStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: expensesColor },
                { offset: 1, color: expensesColor.replace(", 1)", ", 0.6)") },
              ],
            },
            borderRadius: [4, 4, 0, 0],
            shadowBlur: isDark ? 0 : 8,
            shadowColor: isDark ? "transparent" : expensesColor.replace(")", " / 0.2)"),
            shadowOffsetY: isDark ? 0 : 4,
          },
          emphasis: {
            itemStyle: {
              color: "inherit",
              shadowBlur: 15,
              shadowColor: expensesColor.replace(")", " / 0.4)"),
            },
          },
        },
        {
          name: "Net Cash Flow",
          type: "line",
          data: netData,
          smooth: true,
          symbol: "circle",
          symbolSize: 8,
          lineStyle: {
            width: 3,
            color: netColor,
            shadowBlur: 10,
            shadowColor: netColor.replace(", 1)", ", 0.3)"),
          },
          itemStyle: {
            color: netColor,
            borderColor: isDark ? "oklch(0.12 0.04 260)" : "oklch(1 0 0)",
            borderWidth: 2,
          },
          emphasis: {
            focus: "series",
            itemStyle: {
              color: "inherit",
              borderWidth: 3,
              shadowBlur: 12,
              shadowColor: netColor.replace(", 1)", ", 0.5)"),
            },
            lineStyle: {
              width: 4,
            },
          },
          z: 10, // Ensure line is on top of bars
        },
      ],
    };
  };

  return (
    <MotionCard
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={className}
    >
      <CardHeader className="flex flex-col gap-2 p-6">
        <CardTitle>Income vs Expenses</CardTitle>
        <p className="text-muted-foreground text-sm">
          Monthly cash flow analysis with net balance trend
        </p>
      </CardHeader>

      <CardContent className="p-6 pt-0">
        {!hasData ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2">
            <p className="text-muted-foreground text-sm">
              No transaction data available
            </p>
            <p className="text-muted-foreground text-xs">
              Import transactions to visualize your income and expenses
            </p>
          </div>
        ) : (
          <div className="h-[300px] w-full sm:h-[350px] md:h-[400px]">
            <ReactECharts
              option={getOption()}
              style={{ height: "100%", width: "100%" }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
        )}
      </CardContent>
    </MotionCard>
  );
}
