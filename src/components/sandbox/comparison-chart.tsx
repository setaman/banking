/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

import type { SandboxPoint } from "@/lib/stats/sandbox-projector";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComparisonChartProps {
  readonly points: SandboxPoint[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComparisonChart({ points }: ComparisonChartProps): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const chartRef = useRef<ReactECharts | null>(null);

  const isDark = resolvedTheme === "dark";
  const textColor = isDark ? "rgba(241,245,249,0.9)" : "rgba(30,41,59,0.8)";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const bandTopAlpha = isDark ? 0.14 : 0.08;
  const bandBotAlpha = isDark ? 0.03 : 0.02;

  const option = useMemo((): EChartsOption => {
    // Build x-axis labels: year marks at 0, 1, 2, … 10
    const lastPoint = points[points.length - 1];
    const maxYear = lastPoint ? Math.ceil(lastPoint.month / 12) : 10;
    const xLabels: string[] = [];
    for (let y = 0; y <= maxYear; y++) {
      xLabels.push(y === 0 ? "Now" : `Year ${y}`);
    }

    // For each point map month → yearly index for chart x-position (0-based index)
    // We need data as [xIndex, value] pairs — use scatter/line with numeric x instead.
    // Simpler: use yearly category x-axis, sample points at yearly marks + month 0 anchor.

    // Collect yearly marks (month 0 = now, month 12 = Yr 1, …)
    const yearlyIndices = [0, ...Array.from({ length: maxYear }, (_, i) => i + 1)];

    // Build arrays anchored at month=0 (current balance = points[0].baseline - meanNet)
    // We use points directly for years 1..N (month 12, 24, …)
    const yearlyPoints = yearlyIndices.slice(1).map((yr) => {
      const targetMonth = yr * 12;
      return points.find((p) => p.month === targetMonth) ?? null;
    });

    // Projected line (scenario): anchor at first point baseline as "now"
    const scenarioLine = [
      points[0]?.baseline ?? 0, // "now" anchor = baseline month 0
      ...yearlyPoints.map((p) => p?.scenario ?? null),
    ];

    // Split scenario into violet (≥0) and crimson (<0) segments to avoid
    // ECharts visualMap getVisualGradient crash (coord undefined during
    // animation-frame updates). Each array keeps the real value where the
    // condition holds and null elsewhere; ECharts connects adjacent non-null
    // points so the two series together look like one coloured line.
    const scenarioViolet = scenarioLine.map((v, i) => {
      if (v === null) return null;
      // Always show the "now" anchor (index 0) in violet
      if (i === 0) return v;
      // Show in violet when ≥0, or as a bridge point when transitioning
      const prev = scenarioLine[i - 1];
      const next = scenarioLine[i + 1] ?? null;
      if (v >= 0) return v;
      // Keep the last positive point and first negative point visible so the
      // crossing is drawn — use null to break the line in the negative region.
      if ((prev !== null && prev >= 0) || (next !== null && next >= 0)) return v;
      return null;
    });
    const scenarioCrimson = scenarioLine.map((v, i) => {
      if (v === null) return null;
      if (i === 0) return null; // anchor always in violet
      if (v < 0) return v;
      // Bridge: include the last positive-to-negative crossover point
      const next = scenarioLine[i + 1] ?? null;
      if (next !== null && next < 0) return v;
      return null;
    });

    // Baseline dotted line
    const baselineLine = [
      points[0]?.baseline ?? 0,
      ...yearlyPoints.map((p) => p?.baseline ?? null),
    ];

    // Scenario confidence band (stacked area)
    const bandBaseValues = [
      points[0]?.baseline ?? 0,
      ...yearlyPoints.map((p) => (p ? p.scenarioLower : null)),
    ];
    const bandFillValues = [
      0,
      ...yearlyPoints.map((p) =>
        p ? p.scenarioUpper - p.scenarioLower : null
      ),
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
        data: [
          {
            name: "Baseline",
            icon: "path://M0,5 L4,5 M8,5 L12,5 M16,5 L20,5",
            itemStyle: { color: "rgba(156,163,175,0.7)" },
            lineStyle: {
              color: "rgba(156,163,175,0.5)",
              type: "dotted",
              width: 2,
            },
          },
          {
            name: "Scenario",
            icon: "roundRect",
            itemStyle: { color: "rgba(139,92,246,1)" },
          },
        ],
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark
          ? "rgba(30,41,59,0.95)"
          : "rgba(255,255,255,0.95)",
        borderColor: isDark
          ? "rgba(255,255,255,0.15)"
          : "rgba(0,0,0,0.1)",
        borderWidth: 1,
        textStyle: {
          color: isDark ? "rgba(241,245,249,1)" : "rgba(30,41,59,1)",
          fontSize: 12,
        },
        padding: [8, 12],
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const idx = params[0].dataIndex as number;
          const label = xLabels[idx];

          // find the visible series values (skip underscore helpers)
          const baselineParam = params.find((p: any) => p.seriesName === "Baseline");
          const scenarioParam = params.find((p: any) => p.seriesName === "Scenario");

          return `<div style="padding:4px 0;">
            <div style="font-weight:600;margin-bottom:6px;">${label}</div>
            ${
              baselineParam
                ? `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                <span style="display:inline-block;width:20px;height:2px;border-top:2px dotted rgba(156,163,175,0.7);flex-shrink:0;"></span>
                <span style="flex:1;">Baseline:</span>
                <span style="font-weight:600;">${formatCurrency(baselineParam.value as number)}</span>
              </div>`
                : ""
            }
            ${
              scenarioParam
                ? `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:rgba(139,92,246,1);flex-shrink:0;"></span>
                <span style="flex:1;">Scenario:</span>
                <span style="font-weight:600;">${formatCurrency(scenarioParam.value as number)}</span>
              </div>`
                : ""
            }
          </div>`;
        },
      },
      // No visualMap — coloring is handled by split violet/crimson series
      // to avoid ECharts' getVisualGradient crash (coord undefined) during
      // animation-frame updates when the coordinate system is being rebuilt.
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
              return `€${(value / 1000).toFixed(0)}k`;
            }
            return `€${value.toFixed(0)}`;
          },
        },
        splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
      },
      series: [
        // 0: Scenario band base (transparent floor at scenarioLower)
        {
          name: "_bandBase",
          type: "line",
          smooth: true,
          showSymbol: false,
          stack: "sandboxBand",
          lineStyle: { width: 0, color: "transparent" },
          areaStyle: { color: "transparent", opacity: 0 },
          itemStyle: { color: "transparent", opacity: 0 },
          legendHoverLink: false,
          silent: true,
          data: bandBaseValues,
        },
        // 1: Scenario band fill (stacked height = upper - lower)
        {
          name: "_bandFill",
          type: "line",
          smooth: true,
          showSymbol: false,
          stack: "sandboxBand",
          lineStyle: { width: 0, color: "transparent" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `rgba(139,92,246,${bandTopAlpha})` },
                { offset: 1, color: `rgba(139,92,246,${bandBotAlpha})` },
              ],
            },
          },
          itemStyle: { color: "transparent", opacity: 0 },
          legendHoverLink: false,
          silent: true,
          data: bandFillValues,
        },
        // 2: Baseline — dotted grey
        {
          name: "Baseline",
          type: "line",
          smooth: true,
          showSymbol: false,
          z: 6,
          lineStyle: {
            type: "dotted",
            color: "rgba(156,163,175,0.5)",
            width: 2,
          },
          itemStyle: { color: "rgba(156,163,175,0.7)" },
          emphasis: { focus: "series" },
          data: baselineLine,
        },
        // 3: Scenario (violet) — above-zero segments
        {
          name: "Scenario",
          type: "line",
          smooth: true,
          showSymbol: false,
          z: 8,
          connectNulls: false,
          lineStyle: {
            width: 3,
            color: "rgba(139,92,246,1)",
            shadowBlur: 8,
            shadowColor: "rgba(139,92,246,0.4)",
          },
          itemStyle: { color: "rgba(139,92,246,1)" },
          emphasis: { focus: "series", lineStyle: { width: 4 } },
          data: scenarioViolet,
        },
        // 4: Scenario (crimson) — below-zero segments; excluded from legend
        {
          name: "_scenarioCrimson",
          type: "line",
          smooth: true,
          showSymbol: false,
          z: 8,
          connectNulls: false,
          legendHoverLink: false,
          silent: true,
          lineStyle: {
            width: 3,
            color: "rgba(239,68,68,1)",
            shadowBlur: 8,
            shadowColor: "rgba(239,68,68,0.4)",
          },
          itemStyle: { color: "rgba(239,68,68,1)" },
          data: scenarioCrimson,
        },
      ],
    };
  }, [points, isDark, textColor, gridColor, bandTopAlpha, bandBotAlpha]);

  // Debounce the option passed to ReactECharts by one tick so that any
  // pending ECharts internal mouse/tooltip events (which hold a reference to
  // the old coordinate system) finish processing before the chart receives a
  // new option. Without this, rapid state updates (e.g. slider drags) cause
  // "Cannot read properties of undefined (reading 'coord')" inside ECharts.
  const [debouncedOption, setDebouncedOption] = useState<EChartsOption>(option);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedOption(option), 0);
    return () => clearTimeout(id);
  }, [option]);

  // Dispose ECharts instance on unmount to prevent memory leaks.
  // Capture chartRef.current into a local variable at effect-setup time so
  // the cleanup closure always references the same stable value — avoids the
  // react-hooks/exhaustive-deps warning that ref.current may have changed by
  // the time the cleanup runs. Wrap getEchartsInstance() in try/catch because
  // it can throw when the underlying echarts instance was already disposed
  // (e.g. React 18 Strict Mode double-invoke).
  useEffect(() => {
    const chartNode = chartRef.current;
    return () => {
      try {
        const echartsInstance = chartNode?.getEchartsInstance();
        if (echartsInstance && !echartsInstance.isDisposed()) {
          echartsInstance.dispose();
        }
      } catch {
        // Silently ignore — instance already cleaned up.
      }
    };
  }, []);

  return (
    <div className="h-[320px] w-full">
      <ReactECharts
        ref={chartRef}
        option={debouncedOption}
        style={{ height: "100%", width: "100%" }}
        notMerge={false}
        lazyUpdate={true}
      />
    </div>
  );
}
