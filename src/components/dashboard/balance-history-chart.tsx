/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getBalanceHistory, getAccounts } from "@/actions/accounts.actions";
import type { UnifiedBalance, UnifiedAccount } from "@/lib/banking/types";
import type { BalancePredictionResult } from "@/actions/stats.actions";
import { format, parseISO, endOfMonth } from "date-fns";

const MotionCard = motion.create(Card);

interface BalanceHistoryChartProps {
  accountId?: string;
  className?: string;
  prediction?: BalancePredictionResult;
}

/**
 * Converts a "YYYY-MM" month string to a timestamp at end-of-month (noon UTC).
 * Using end-of-month ensures the projected point sits visually past the last
 * actual data point which is recorded at noon UTC on a mid-month date.
 */
function monthToTimestamp(month: string): number {
  const [year, mo] = month.split("-").map(Number);
  const eom = endOfMonth(new Date(year, mo - 1, 1));
  return Date.UTC(eom.getFullYear(), eom.getMonth(), eom.getDate(), 12, 0, 0);
}

export function BalanceHistoryChart({
  accountId,
  className,
  prediction,
}: BalanceHistoryChartProps) {
  const [balances, setBalances] = useState<UnifiedBalance[]>([]);
  const [accounts, setAccounts] = useState<UnifiedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
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

  // Calculate total balance timeline (aggregate by calendar date, all accounts)
  const totalBalanceData: [number, number][] = [];
  if (!accountId && accountIds.length > 1) {
    // Group balances by calendar date (YYYY-MM-DD) — all accounts with history
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

  const textColor = isDark ? "rgba(226, 232, 240, 1)" : "rgba(71, 85, 105, 1)";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";

  // Projection colors — violet family, mode-aware
  const projLineColor = isDark
    ? "rgba(139, 92, 246, 0.85)"
    : "rgba(124, 58, 237, 0.85)";
  const projBandTopAlpha = isDark ? 0.12 : 0.08;
  const projBandBotAlpha = isDark ? 0.03 : 0.02;

  // Whether projection should be rendered:
  // only on the aggregate view (no single-account filter) and when available
  const showProjection =
    !accountId &&
    accountIds.length > 1 &&
    totalBalanceData.length > 0 &&
    prediction?.available === true;

  // Build ECharts option
  const getOption = (): EChartsOption => {
    const series: any[] = accountIds.map((accId, index) => {
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
      const masterLineColor = isDark ? "#ffffff" : "#020617";
      const glowColor = isDark
        ? "rgba(139, 92, 246, 0.6)"
        : "rgba(124, 58, 237, 0.25)";

      series.push({
        name: "Total Balance",
        type: "line" as const,
        smooth: true,
        showSymbol: true,
        symbol: "diamond",
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
          shadowColor: glowColor,
          shadowBlur: 15,
          shadowOffsetY: 5,
        } as any,
        areaStyle: {
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
            shadowBlur: 20,
          } as any,
          areaStyle: {
            color: "inherit",
          },
        },
        data: totalBalanceData,
      } as any);
    }

    // Projection series — only injected in aggregate view with available prediction
    let projectionMarkLineXAxis: number | undefined;
    if (showProjection && prediction?.available) {
      const pts = prediction.prediction.points;

      // Projected line data: bridge from last actual point then all 12 projection points
      const lastActual = totalBalanceData[totalBalanceData.length - 1];
      const projLineData: [number, number][] = [
        [lastActual[0], lastActual[1]], // connect seamlessly from actual
        ...pts.map(
          (p) => [monthToTimestamp(p.month), p.projected] as [number, number]
        ),
      ];

      // Confidence band: stacked-area technique.
      // Series "_bandBase": invisible line at lowerBound (no area fill, transparent)
      // Series "_bandFill": stacked area of (upper - lower) height with violet gradient
      const bandBaseData: [number, number][] = pts.map((p) => [
        monthToTimestamp(p.month),
        p.lowerBound,
      ]);
      const bandFillData: [number, number][] = pts.map((p) => [
        monthToTimestamp(p.month),
        p.upperBound - p.lowerBound,
      ]);

      // "Today" markLine x-value: timestamp of the last actual balance point
      projectionMarkLineXAxis = lastActual[0];

      // ---- Band base (invisible, just sets the stack floor) ----
      series.push({
        name: "_bandBase",
        type: "line",
        smooth: true,
        symbol: "none",
        stack: "projectionBand",
        z: 4,
        lineStyle: { width: 0, color: "transparent" },
        areaStyle: { color: "transparent", opacity: 0 },
        itemStyle: { color: "transparent", opacity: 0 },
        showSymbol: false,
        legendHoverLink: false,
        silent: true,
        data: bandBaseData,
      } as any);

      // ---- Band fill (stacked on top of base = upper - lower height) ----
      series.push({
        name: "_bandFill",
        type: "line",
        smooth: true,
        symbol: "none",
        stack: "projectionBand",
        z: 4,
        lineStyle: { width: 0, color: "transparent" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: `rgba(139, 92, 246, ${projBandTopAlpha})`,
              },
              {
                offset: 1,
                color: `rgba(139, 92, 246, ${projBandBotAlpha})`,
              },
            ],
          },
        },
        itemStyle: { color: "transparent", opacity: 0 },
        showSymbol: false,
        legendHoverLink: false,
        silent: true,
        data: bandFillData,
      } as any);

      // ---- Projected Balance dashed line ----
      series.push({
        name: "Projected Balance",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        z: 8,
        lineStyle: {
          width: 2.5,
          color: projLineColor,
          type: "dashed",
          shadowColor: projLineColor,
          shadowBlur: 6,
        },
        itemStyle: {
          color: projLineColor,
          borderColor: projLineColor,
          borderWidth: 1.5,
        },
        emphasis: {
          focus: "series" as const,
          lineStyle: { width: 3, shadowBlur: 10 },
        },
        // No areaStyle — we use the explicit band series for that
        data: projLineData,
      } as any);
    }

    // Determine x-axis max: extend to cover last projection point when shown
    let xAxisMax: number | undefined;
    if (showProjection && prediction?.available) {
      const lastPt =
        prediction.prediction.points[prediction.prediction.points.length - 1];
      xAxisMax = monthToTimestamp(lastPt.month) + 1000 * 60 * 60 * 24 * 3; // +3 day padding
    }

    const legendData: string[] = [];
    if (accountIds.length > 1) {
      accountIds.forEach((id) =>
        legendData.push(accountNameMap.get(id) || "Unknown Account")
      );
      legendData.push("Total Balance");
    }
    if (showProjection) {
      legendData.push("Projected Balance");
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

          // Filter out internal band helper series from tooltip
          const visible = params.filter(
            (p: any) =>
              !String(p.seriesName).startsWith("_") &&
              p.seriesName !== "_bandBase" &&
              p.seriesName !== "_bandFill"
          );
          if (visible.length === 0) return "";

          const date = format(new Date(visible[0].value[0]), "dd MMM yyyy");

          const totalParam = visible.find(
            (p: any) => p.seriesName === "Total Balance"
          );
          const projParam = visible.find(
            (p: any) => p.seriesName === "Projected Balance"
          );
          const accountParams = visible.filter(
            (p: any) =>
              p.seriesName !== "Total Balance" &&
              p.seriesName !== "Projected Balance"
          );

          let html = `<div style="padding: 4px 0;">`;
          html += `<div style="font-weight: 600; margin-bottom: 8px; color: ${isDark ? "rgba(148, 163, 184, 1)" : "rgba(100, 116, 139, 1)"};">${date}</div>`;

          // Projected Balance block — shown when hovering a projected point
          if (projParam) {
            const projValue = new Intl.NumberFormat("de-DE", {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 2,
            }).format(projParam.value[1]);

            // Look up upper/lower bounds from prediction data for this timestamp
            let rangeHtml = "";
            if (prediction?.available) {
              const ts = projParam.value[0] as number;
              const matchedPt = prediction.prediction.points.find(
                (pt) =>
                  Math.abs(monthToTimestamp(pt.month) - ts) <
                  1000 * 60 * 60 * 25
              );
              if (matchedPt) {
                const lower = new Intl.NumberFormat("de-DE", {
                  style: "currency",
                  currency: "EUR",
                  minimumFractionDigits: 2,
                }).format(matchedPt.lowerBound);
                const upper = new Intl.NumberFormat("de-DE", {
                  style: "currency",
                  currency: "EUR",
                  minimumFractionDigits: 2,
                }).format(matchedPt.upperBound);
                rangeHtml = `
                  <div style="margin-top: 4px; font-size: 11px; color: ${isDark ? "rgba(148, 163, 184, 0.8)" : "rgba(100, 116, 139, 0.8)"};">
                    Possible range: ${lower} — ${upper}
                  </div>
                  <div style="margin-top: 2px; font-size: 11px; font-style: italic; color: ${isDark ? "rgba(148, 163, 184, 0.6)" : "rgba(100, 116, 139, 0.6)"};">(estimated)</div>
                `;
              }
            }

            html += `
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"};">
                <span style="display: inline-block; width: 14px; height: 2px; border-top: 2px dashed ${projLineColor}; flex-shrink: 0;"></span>
                <span style="flex: 1; font-weight: 700; font-size: 13px;">Projected Balance:</span>
                <span style="font-weight: 700; font-size: 13px;">~${projValue}</span>
              </div>
              ${rangeHtml}
            `;
          }

          // Total Balance first (if present) with prominence
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

          // Individual accounts
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
        ...(xAxisMax ? { max: xAxisMax } : {}),
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
      series: series.map((s) => {
        // Inject "Today" markLine on the Projected Balance series
        if (
          s.name === "Projected Balance" &&
          projectionMarkLineXAxis !== undefined
        ) {
          return {
            ...s,
            markLine: {
              silent: true,
              symbol: ["none", "none"],
              lineStyle: {
                color: isDark
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(0, 0, 0, 0.2)",
                type: "dashed",
                width: 1.5,
              },
              label: {
                show: true,
                position: "insideStartTop",
                formatter: "Today",
                color: isDark
                  ? "rgba(148, 163, 184, 0.8)"
                  : "rgba(100, 116, 139, 0.8)",
                fontSize: 11,
              },
              data: [{ xAxis: projectionMarkLineXAxis }],
            },
          };
        }
        return s;
      }),
      legend:
        legendData.length > 0
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
                    color: isDark ? "#ffffff" : "#020617",
                    fontSize: 13,
                  },
                },
              },
              itemGap: 16,
              // Filter out internal underscore-prefixed band helper series
              data: legendData.map((name) => {
                if (name === "Projected Balance") {
                  return {
                    name,
                    icon: "path://M0,5 L4,5 M8,5 L12,5 M16,5 L20,5",
                    itemStyle: { color: projLineColor },
                    lineStyle: {
                      color: projLineColor,
                      type: "dashed",
                      width: 2,
                    },
                  };
                }
                return { name };
              }),
              formatter: (name: string) => {
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
            Tracking {accountIds.length} account
            {accountIds.length !== 1 ? "s" : ""}
            {!accountId && totalBalanceData.length > 0 && " with total balance"}
            {showProjection && " · 12-month projection"}
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
