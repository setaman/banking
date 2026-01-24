"use client";

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getBalanceHistory } from "@/actions/accounts.actions";
import type { UnifiedBalance } from "@/lib/banking/types";
import { format, parseISO } from "date-fns";

const MotionCard = motion.create(Card);

interface BalanceHistoryChartProps {
  accountId?: string;
  className?: string;
}

export function BalanceHistoryChart({ accountId, className }: BalanceHistoryChartProps) {
  const [balances, setBalances] = useState<UnifiedBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const data = await getBalanceHistory(accountId);
        setBalances(data);
      } catch (error) {
        console.error("Failed to fetch balance history:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [accountId]);

  // Group balances by account for multi-account support
  const balancesByAccount = balances.reduce((acc, balance) => {
    if (!acc[balance.accountId]) {
      acc[balance.accountId] = [];
    }
    acc[balance.accountId].push(balance);
    return acc;
  }, {} as Record<string, UnifiedBalance[]>);

  const accountIds = Object.keys(balancesByAccount);
  const hasData = accountIds.length > 0 && balances.length > 0;

  // Generate chart colors from theme
  const isDark = resolvedTheme === "dark";
  const primaryColor = isDark ? "oklch(0.7 0.2 260)" : "oklch(0.6 0.2 260)";
  const chart2Color = isDark ? "oklch(0.7 0.2 310)" : "oklch(0.65 0.2 310)";
  const chart3Color = isDark ? "oklch(0.75 0.18 150)" : "oklch(0.7 0.18 150)";
  const chart4Color = isDark ? "oklch(0.85 0.15 80)" : "oklch(0.8 0.15 80)";
  const chart5Color = isDark ? "oklch(0.75 0.2 340)" : "oklch(0.7 0.2 340)";
  const accountColors = [primaryColor, chart2Color, chart3Color, chart4Color, chart5Color];

  const textColor = isDark ? "oklch(0.7 0.05 260)" : "oklch(0.55 0.05 260)";
  const gridColor = isDark ? "oklch(0.3 0.05 260 / 0.2)" : "oklch(0.92 0.02 260 / 0.4)";

  // Build ECharts option
  const getOption = (): EChartsOption => {
    const series = accountIds.map((accId, index) => {
      const accountBalances = balancesByAccount[accId];
      const color = accountColors[index % accountColors.length];

      return {
        name: `Account ${index + 1}`,
        type: "line" as const,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: color.replace(")", " / 0.2)") },
              { offset: 1, color: color.replace(")", " / 0.05)") },
            ],
          },
        },
        lineStyle: {
          width: 2,
          color: color,
        },
        itemStyle: {
          color: color,
          borderColor: color,
          borderWidth: 2,
        },
        emphasis: {
          focus: "series" as const,
          itemStyle: {
            borderWidth: 3,
            shadowBlur: 10,
            shadowColor: color.replace(")", " / 0.3)"),
          },
        },
        data: accountBalances.map((b) => [
          parseISO(b.fetchedAt).getTime(),
          b.amount,
        ]),
      };
    });

    return {
      animation: true,
      animationDuration: 1000,
      animationEasing: "cubicOut",
      grid: {
        left: "3%",
        right: "4%",
        bottom: "10%",
        top: "15%",
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
        borderWidth: 1,
        textStyle: {
          color: isDark ? "oklch(0.95 0.02 260)" : "oklch(0.15 0.04 260)",
          fontSize: 12,
        },
        padding: [8, 12],
        formatter: (params: any) => {
          if (!Array.isArray(params)) return "";
          const date = format(new Date(params[0].value[0]), "dd MMM yyyy");
          let content = `<div style="font-weight: 600; margin-bottom: 4px;">${date}</div>`;
          params.forEach((param: any) => {
            const value = new Intl.NumberFormat("de-DE", {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 2,
            }).format(param.value[1]);
            content += `<div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${param.color};"></span>
              <span style="flex: 1;">${param.seriesName}:</span>
              <span style="font-weight: 600;">${value}</span>
            </div>`;
          });
          return content;
        },
      },
      xAxis: {
        type: "time",
        boundaryGap: false as any,
        axisLine: {
          lineStyle: {
            color: gridColor,
          },
        },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: (value: number) => format(new Date(value), "MMM yy"),
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: gridColor,
            type: "dashed",
          },
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
      series,
      legend:
        accountIds.length > 1
          ? {
              show: true,
              top: 0,
              right: 0,
              textStyle: {
                color: textColor,
                fontSize: 12,
              },
              itemGap: 16,
            }
          : undefined,
    };
  };

  return (
    <MotionCard
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={className}
    >
      <CardHeader className="flex flex-col gap-2 p-6">
        <CardTitle>Balance History</CardTitle>
        {accountIds.length > 1 && (
          <p className="text-muted-foreground text-sm">
            Tracking {accountIds.length} accounts
          </p>
        )}
      </CardHeader>

      <CardContent className="p-6 pt-0">
        {loading ? (
          <div className="flex h-[300px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
          </div>
        ) : !hasData ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2">
            <p className="text-muted-foreground text-sm">No balance history available</p>
            <p className="text-muted-foreground text-xs">
              Start syncing your accounts to see balance trends over time
            </p>
          </div>
        ) : (
          <div className="h-[300px] w-full sm:h-[350px] md:h-[400px]">
            <ReactECharts
              option={getOption()}
              style={{ height: "100%", width: "100%" }}
              notMerge={true}
              lazyUpdate={true}
              theme={isDark ? "dark" : "light"}
            />
          </div>
        )}
      </CardContent>
    </MotionCard>
  );
}
