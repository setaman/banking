"use client";

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getBalanceHistory, getAccounts } from "@/actions/accounts.actions";
import type { UnifiedBalance, UnifiedAccount } from "@/lib/banking/types";
import { format, parseISO } from "date-fns";

const MotionCard = motion.create(Card);

interface BalanceHistoryChartProps {
  accountId?: string;
  className?: string;
}

export function BalanceHistoryChart({
  accountId,
  className,
}: BalanceHistoryChartProps) {
  const [balances, setBalances] = useState<UnifiedBalance[]>([]);
  const [accounts, setAccounts] = useState<UnifiedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch both balances and accounts in parallel
        const [balanceData, accountsData] = await Promise.all([
          getBalanceHistory(accountId),
          getAccounts(),
        ]);
        setBalances(balanceData);
        setAccounts(accountsData);
      } catch (error) {
        console.error("Failed to fetch balance history:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [accountId]);

  // Group balances by account for multi-account support
  const balancesByAccount = balances.reduce(
    (acc, balance) => {
      if (!acc[balance.accountId]) {
        acc[balance.accountId] = [];
      }
      acc[balance.accountId].push(balance);
      return acc;
    },
    {} as Record<string, UnifiedBalance[]>
  );

  const accountIds = Object.keys(balancesByAccount);
  const hasData = accountIds.length > 0 && balances.length > 0;

  // Create account name lookup map
  const accountNameMap = new Map(accounts.map((acc) => [acc.id, acc.name]));

  // Calculate total balance timeline (aggregate by calendar date)
  const totalBalanceData: [number, number][] = [];
  if (!accountId && accountIds.length > 1) {
    // Group balances by calendar date (YYYY-MM-DD)
    const balancesByDate = new Map<
      string,
      Map<string, { amount: number; time: number }>
    >();

    balances.forEach((balance) => {
      // Extract date only (ignore time)
      const date = balance.fetchedAt.split("T")[0]; // "2026-01-31"

      if (!balancesByDate.has(date)) {
        balancesByDate.set(date, new Map());
      }

      const dateBalances = balancesByDate.get(date)!;
      const existingTime = parseISO(balance.fetchedAt).getTime();

      // Store latest balance for each account on this date
      const currentEntry = dateBalances.get(balance.accountId);
      if (!currentEntry || existingTime > currentEntry.time) {
        dateBalances.set(balance.accountId, {
          amount: balance.amount,
          time: existingTime,
        });
      }
    });

    // Calculate total balance per date
    for (const [dateStr, accountBalances] of balancesByDate.entries()) {
      const totalForDate = Array.from(accountBalances.values()).reduce(
        (sum, entry) => sum + entry.amount,
        0
      );

      // Use noon UTC for consistent charting (avoids timezone issues)
      const timestamp = new Date(`${dateStr}T12:00:00Z`).getTime();
      totalBalanceData.push([timestamp, totalForDate]);
    }

    // Sort by date ascending
    totalBalanceData.sort((a, b) => a[0] - b[0]);
  }

  // Generate chart colors from theme
  const isDark = resolvedTheme === "dark";
  const primaryColor = isDark
    ? "rgba(139, 92, 246, 1)"
    : "rgba(124, 58, 237, 1)";
  const chart2Color = isDark
    ? "rgba(217, 70, 239, 1)"
    : "rgba(192, 38, 211, 1)";
  const chart3Color = isDark
    ? "rgba(20, 184, 166, 1)"
    : "rgba(13, 148, 136, 1)";
  const chart4Color = isDark ? "rgba(244, 63, 94, 1)" : "rgba(225, 29, 72, 1)";
  const chart5Color = isDark
    ? "rgba(236, 72, 153, 1)"
    : "rgba(219, 39, 119, 1)";
  const accountColors = [
    primaryColor,
    chart2Color,
    chart3Color,
    chart4Color,
    chart5Color,
  ];

  const textColor = isDark ? "rgba(226, 232, 240, 1)" : "rgba(71, 85, 105, 1)"; // slate-700 instead of slate-400 equivalent
  const gridColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";

  // Build ECharts option
  const getOption = (): EChartsOption => {
    const series = accountIds.map((accId, index) => {
      const accountBalances = balancesByAccount[accId];
      const color = accountColors[index % accountColors.length];

      return {
        name: accountNameMap.get(accId) || "Unknown Account",
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
              { offset: 0, color: color.replace(", 1)", ", 0.2)") },
              { offset: 1, color: color.replace(", 1)", ", 0.05)") },
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
            color: "inherit",
            borderWidth: 3,
          },
          lineStyle: {
            color: "inherit",
          },
          areaStyle: {
            color: "inherit",
          },
        },
        data: accountBalances.map((b) => [
          parseISO(b.fetchedAt).getTime(),
          b.amount,
        ]),
      };
    });

    // Add Total Balance series (the "Luminance" design)
    if (!accountId && accountIds.length > 1 && totalBalanceData.length > 0) {
      const masterLineColor = isDark ? "#ffffff" : "#020617"; // Pure white / Slate-950
      const glowColor = isDark
        ? "rgba(139, 92, 246, 0.6)" // Primary purple glow (stronger in dark)
        : "rgba(124, 58, 237, 0.25)"; // Primary purple glow (subtle in light)

      series.push({
        name: "Total Balance",
        type: "line" as const,
        smooth: true,
        showSymbol: true,
        symbol: "diamond", // Distinct from account circles
        symbolSize: 8,
        z: 10,
        itemStyle: {
          color: masterLineColor,
          borderColor: masterLineColor,
          borderWidth: 2,
        },
        lineStyle: {
          width: 3,
          color: masterLineColor,
          // THE KEY: Colored shadow creates "neon/glass" effect
          shadowColor: glowColor,
          shadowBlur: 15,
          shadowOffsetY: 5, // Lifts the line off the chart
        } as any,
        areaStyle: {
          // Very subtle "mist" below the total line
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(15, 23, 42, 0.05)",
              },
              { offset: 1, color: "rgba(0, 0, 0, 0)" },
            ],
          },
        },
        emphasis: {
          focus: "series" as const,
          itemStyle: {
            color: "inherit",
            borderWidth: 3,
          },
          lineStyle: {
            width: 4,
            shadowBlur: 20, // Stronger glow on hover
          } as any,
          areaStyle: {
            color: "inherit",
          },
        },
        data: totalBalanceData,
      } as any);
    }

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
          if (!Array.isArray(params)) return "";

          const date = format(new Date(params[0].value[0]), "dd MMM yyyy");

          // Separate Total Balance from individual accounts
          const totalParam = params.find(
            (p: any) => p.seriesName === "Total Balance"
          );
          const accountParams = params.filter(
            (p: any) => p.seriesName !== "Total Balance"
          );

          let html = `<div style="padding: 4px 0;">`;
          html += `<div style="font-weight: 600; margin-bottom: 8px; color: ${isDark ? "rgba(148, 163, 184, 1)" : "rgba(100, 116, 139, 1)"};">${date}</div>`;

          // Show Total Balance first (if present) with prominence
          if (totalParam) {
            const value = new Intl.NumberFormat("de-DE", {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 2,
            }).format(totalParam.value[1]);

            html += `
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"};">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${totalParam.color}; box-shadow: 0 0 8px ${totalParam.color};"></span>
                <span style="flex: 1; font-weight: 700; font-size: 13px;">${totalParam.seriesName}:</span>
                <span style="font-weight: 700; font-size: 13px;">${value}</span>
              </div>
            `;
          }

          // Show individual accounts
          accountParams.forEach((param: any) => {
            const value = new Intl.NumberFormat("de-DE", {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 2,
            }).format(param.value[1]);

            html += `
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${param.color};"></span>
                <span style="flex: 1;">${param.seriesName}:</span>
                <span style="font-weight: 600; font-family: monospace; font-size: 12px;">${value}</span>
              </div>
            `;
          });

          html += `</div>`;
          return html;
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
        accountIds.length > 1 || totalBalanceData.length > 0
          ? {
              show: true,
              top: 0,
              right: 0,
              textStyle: {
                color: textColor,
                fontSize: 12,
                rich: {
                  bold: {
                    fontWeight: 700,
                    color: isDark ? "#ffffff" : "#020617", // Match masterLineColor
                    fontSize: 13,
                  },
                },
              },
              itemGap: 16,
              formatter: (name: string) => {
                // Bold the Total Balance in legend
                if (name === "Total Balance") {
                  return `{bold|${name}}`;
                }
                return name;
              },
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
            {!accountId && totalBalanceData.length > 0 && " with total balance"}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-6 pt-0">
        {loading ? (
          <div className="flex h-[300px] items-center justify-center">
            <div className="border-primary/30 border-t-primary h-8 w-8 animate-spin rounded-full border-4" />
          </div>
        ) : !hasData ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2">
            <p className="text-muted-foreground text-sm">
              No balance history available
            </p>
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
            />
          </div>
        )}
      </CardContent>
    </MotionCard>
  );
}
