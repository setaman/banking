/* eslint-disable @typescript-eslint/no-explicit-any -- ECharts formatter
   callbacks are typed as broad internal unions (`CallbackDataParams` /
   `TopLevelFormatterParams`) that aren't exported from the `echarts` package
   root. Sibling dashboard charts (`income-expenses-chart.tsx`,
   `category-breakdown-chart.tsx`) and `comparison-chart.tsx` all use the same
   file-level suppression for this reason — see `docs/design/ai-assistant-ui.md`
   §5 and the Phase E task brief, which explicitly names this as the accepted
   project pattern. */
/**
 * Pure mapping functions: `VisualizationSpec` (chart-shaped variants) + a
 * theme flag -> a deterministic `EChartsOption`. No React, no side effects,
 * no randomness — the same spec + theme always produces the same option
 * object, which keeps the chart view components (thin ECharts wrappers)
 * trivial to reason about and test.
 *
 * Reuses the exact same palette, tooltip styling and de-DE/EUR formatting
 * conventions already established by `src/components/dashboard/income-expenses-chart.tsx`
 * and `src/components/dashboard/category-breakdown-chart.tsx` so assistant
 * charts read as native, not foreign (`docs/design/ai-assistant-ui.md` §1/§5).
 */
import type { EChartsOption } from "echarts";

import type { VisualizationSpec } from "@/lib/ai/visualization";

// ---------------------------------------------------------------------------
// Per-type spec aliases (derived from the Zod-inferred discriminated union —
// no duplicate type definitions to drift from `visualization.ts`).
// ---------------------------------------------------------------------------

export type BarChartSpec = Extract<VisualizationSpec, { type: "bar" }>;
export type LineChartSpec = Extract<VisualizationSpec, { type: "line" }>;
export type PieChartSpec = Extract<VisualizationSpec, { type: "pie" }>;
export type StatSpec = Extract<VisualizationSpec, { type: "stat" }>;
export type TableSpec = Extract<VisualizationSpec, { type: "table" }>;

// ---------------------------------------------------------------------------
// Theme-aware palette — identical values to `category-breakdown-chart.tsx`
// (dashboard) so inline assistant charts share the exact same visual language.
// ---------------------------------------------------------------------------

const CHART_COLORS_DARK = [
  "rgb(139, 92, 246)", // chart-1: Violet
  "rgb(217, 70, 239)", // chart-2: Magenta
  "rgb(20, 184, 166)", // chart-3: Teal
  "rgb(251, 146, 60)", // chart-4: Orange
  "rgb(244, 114, 182)", // chart-5: Pink
  "rgb(167, 139, 250)", // Violet-light
  "rgb(74, 222, 128)", // Green
  "rgb(251, 191, 36)", // Amber
] as const;

const CHART_COLORS_LIGHT = [
  "rgb(109, 40, 217)", // chart-1: Deeper Violet
  "rgb(192, 38, 211)", // chart-2: Deeper Magenta
  "rgb(13, 148, 136)", // chart-3: Deeper Teal
  "rgb(234, 88, 12)", // chart-4: Deeper Orange
  "rgb(219, 39, 119)", // chart-5: Deeper Pink
  "rgb(124, 58, 237)", // Deeper Violet-light
  "rgb(22, 163, 74)", // Deeper Green
  "rgb(217, 119, 6)", // Deeper Amber
] as const;

export function getChartColors(isDark: boolean): readonly string[] {
  return isDark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
}

export function getTextColor(isDark: boolean): string {
  return isDark ? "rgba(226, 232, 240, 1)" : "rgba(71, 85, 105, 1)";
}

export function getGridColor(isDark: boolean): string {
  return isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
}

function getTooltipBg(isDark: boolean): string {
  return isDark ? "rgba(30, 41, 59, 0.95)" : "rgba(255, 255, 255, 0.95)";
}

function getTooltipBorder(isDark: boolean): string {
  return isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)";
}

function getTooltipTextColor(isDark: boolean): string {
  return isDark ? "rgba(241, 245, 249, 1)" : "rgba(30, 41, 59, 1)";
}

// ---------------------------------------------------------------------------
// Formatting — assistant chart data (bar/line/pie) carries plain numbers;
// this is a banking app and every numeric series here is monetary, so all
// values render as de-DE formatted EUR (matches the dashboard charts and the
// system prompt's own "de-DE/EUR formatting" rule for user-facing numbers).
// Stat and table specs already carry pre-formatted strings from the model
// (see `visualization.ts`) and are rendered as-is by their own components.
// ---------------------------------------------------------------------------

export function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatEurCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `€${(value / 1000).toFixed(1)}k`;
  }
  return `€${value.toFixed(0)}`;
}

/**
 * Escapes a string for safe interpolation into an ECharts HTML tooltip
 * formatter string. Visualization spec labels/titles ultimately originate
 * from the AI model's response, which may echo transaction/merchant text or
 * user input verbatim — these are **not** trusted strings. Every label
 * interpolated into a tooltip `formatter` (which ECharts renders as raw DOM
 * HTML by default) is escaped through this helper first. Plain React text
 * nodes (JSX) elsewhere already escape automatically and don't need it, and
 * ECharts' own built-in template tokens (e.g. `"{b}: {d}%"` in the pie label)
 * are rendered as SVG/canvas text, not HTML, so they're inherently safe too.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Shared option scaffolding
// ---------------------------------------------------------------------------

function baseOption(hasTitle: boolean): EChartsOption {
  return {
    animation: true,
    animationDuration: 600,
    animationEasing: "cubicOut",
    backgroundColor: "transparent",
    grid: {
      left: "2%",
      right: "3%",
      bottom: "10%",
      top: hasTitle ? "10%" : "6%",
      containLabel: true,
    },
  };
}

function tooltipStyle(isDark: boolean): Record<string, unknown> {
  return {
    backgroundColor: getTooltipBg(isDark),
    borderColor: getTooltipBorder(isDark),
    borderWidth: 1,
    textStyle: { color: getTooltipTextColor(isDark), fontSize: 12 },
    padding: [8, 12],
  };
}

// ---------------------------------------------------------------------------
// Bar chart
// ---------------------------------------------------------------------------

export function buildBarChartOption(
  spec: BarChartSpec,
  isDark: boolean
): EChartsOption {
  const colors = getChartColors(isDark);
  const textColor = getTextColor(isDark);
  const gridColor = getGridColor(isDark);

  const labels = spec.data.map((d) => d.label);
  const values = spec.data.map((d) => d.value);
  const hasSeries2 = spec.data.some((d) => d.value2 !== undefined);
  const values2 = spec.data.map((d) => d.value2 ?? 0);
  const seriesName = spec.seriesName ?? "Value";
  const series2Name = spec.series2Name ?? "Value 2";

  const series: NonNullable<EChartsOption["series"]> = [
    {
      name: seriesName,
      type: "bar",
      data: values,
      stack: spec.stacked ? "total" : undefined,
      barMaxWidth: 36,
      itemStyle: {
        color: colors[0],
        borderRadius: spec.stacked ? 0 : [4, 4, 0, 0],
      },
      emphasis: { itemStyle: { color: "inherit" } },
    },
  ];
  if (hasSeries2) {
    series.push({
      name: series2Name,
      type: "bar",
      data: values2,
      stack: spec.stacked ? "total" : undefined,
      barMaxWidth: 36,
      itemStyle: {
        color: colors[1],
        borderRadius: spec.stacked ? 0 : [4, 4, 0, 0],
      },
      emphasis: { itemStyle: { color: "inherit" } },
    });
  }

  return {
    ...baseOption(Boolean(spec.title)),
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      ...tooltipStyle(isDark),
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params];
        if (list.length === 0) return "";
        const label = escapeHtml(
          String(list[0].axisValueLabel ?? list[0].name ?? "")
        );
        const rows = list
          .map((p: any) => {
            const seriesLabel = escapeHtml(String(p.seriesName ?? ""));
            return `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color};"></span>
              <span style="flex:1;">${seriesLabel}:</span>
              <span style="font-weight:600;">${formatEur(Number(p.value))}</span>
            </div>`;
          })
          .join("");
        return `<div style="padding:4px 0;"><div style="font-weight:600;margin-bottom:6px;">${label}</div>${rows}</div>`;
      },
    },
    legend: hasSeries2
      ? { show: true, bottom: 0, textStyle: { color: textColor, fontSize: 11 } }
      : { show: false },
    xAxis: {
      type: "category",
      data: labels,
      name: spec.xLabel,
      nameLocation: "middle",
      nameGap: 26,
      nameTextStyle: { color: textColor, fontSize: 11 },
      axisLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: spec.yLabel,
      nameTextStyle: { color: textColor, fontSize: 11 },
      axisLine: { show: false },
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: (value: number) => formatEurCompact(value),
      },
      splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
    },
    series,
  };
}

// ---------------------------------------------------------------------------
// Line chart
// ---------------------------------------------------------------------------

export function buildLineChartOption(
  spec: LineChartSpec,
  isDark: boolean
): EChartsOption {
  const colors = getChartColors(isDark);
  const textColor = getTextColor(isDark);
  const gridColor = getGridColor(isDark);

  const labels = spec.data.map((d) => d.label);
  const values = spec.data.map((d) => d.value);
  const hasSeries2 = spec.data.some((d) => d.value2 !== undefined);
  const values2 = spec.data.map((d) => d.value2 ?? 0);
  const seriesName = spec.seriesName ?? "Value";
  const series2Name = spec.series2Name ?? "Value 2";
  const smooth = spec.smooth !== false;

  const makeSeries = (name: string, data: number[], color: string) => ({
    name,
    type: "line" as const,
    data,
    smooth,
    symbol: "circle",
    symbolSize: 6,
    stack: spec.stacked ? "total" : undefined,
    areaStyle: spec.stacked ? { color, opacity: 0.15 } : undefined,
    lineStyle: { width: 3, color },
    itemStyle: { color },
    emphasis: { focus: "series" as const },
  });

  const series: NonNullable<EChartsOption["series"]> = [
    makeSeries(seriesName, values, colors[0]),
  ];
  if (hasSeries2) {
    series.push(makeSeries(series2Name, values2, colors[1]));
  }

  return {
    ...baseOption(Boolean(spec.title)),
    tooltip: {
      trigger: "axis",
      ...tooltipStyle(isDark),
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params];
        if (list.length === 0) return "";
        const label = escapeHtml(
          String(list[0].axisValueLabel ?? list[0].name ?? "")
        );
        const rows = list
          .map((p: any) => {
            const seriesLabel = escapeHtml(String(p.seriesName ?? ""));
            return `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <span style="display:inline-block;width:10px;height:2px;background:${p.color};"></span>
              <span style="flex:1;">${seriesLabel}:</span>
              <span style="font-weight:600;">${formatEur(Number(p.value))}</span>
            </div>`;
          })
          .join("");
        return `<div style="padding:4px 0;"><div style="font-weight:600;margin-bottom:6px;">${label}</div>${rows}</div>`;
      },
    },
    legend: hasSeries2
      ? { show: true, bottom: 0, textStyle: { color: textColor, fontSize: 11 } }
      : { show: false },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      name: spec.xLabel,
      nameLocation: "middle",
      nameGap: 26,
      nameTextStyle: { color: textColor, fontSize: 11 },
      axisLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: spec.yLabel,
      nameTextStyle: { color: textColor, fontSize: 11 },
      axisLine: { show: false },
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: (value: number) => formatEurCompact(value),
      },
      splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
    },
    series,
  };
}

// ---------------------------------------------------------------------------
// Pie / donut chart — always rendered as a donut with a 60% inner radius
// (the real schema, unlike the design doc's illustrative interface, has no
// `donut` toggle field — see `visualization.ts`).
// ---------------------------------------------------------------------------

export function buildPieChartOption(
  spec: PieChartSpec,
  isDark: boolean
): EChartsOption {
  const colors = getChartColors(isDark);
  const textColor = getTextColor(isDark);

  return {
    ...baseOption(Boolean(spec.title)),
    tooltip: {
      trigger: "item",
      ...tooltipStyle(isDark),
      formatter: (params: any) => {
        const name = escapeHtml(String(params.name ?? ""));
        const value = formatEur(Number(params.value));
        const percent =
          typeof params.percent === "number"
            ? params.percent.toFixed(1)
            : "0.0";
        return `<div style="padding:4px 0;">
          <div style="font-weight:600;margin-bottom:6px;">${name}</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color};"></span>
            <span style="flex:1;opacity:0.8;">Amount:</span>
            <span style="font-weight:600;">${value}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
            <span style="display:inline-block;width:8px;height:8px;"></span>
            <span style="flex:1;opacity:0.8;">Share:</span>
            <span style="font-weight:600;">${percent}%</span>
          </div>
        </div>`;
      },
    },
    legend: {
      show: true,
      bottom: 0,
      textStyle: { color: textColor, fontSize: 11 },
    },
    series: [
      {
        name: spec.title ?? "Value",
        type: "pie",
        radius: ["60%", "75%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: isDark
            ? "rgba(18, 24, 38, 1)"
            : "rgba(255, 255, 255, 1)",
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: "{b}: {d}%",
          color: textColor,
          fontSize: 11,
        },
        emphasis: {
          scale: true,
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(0, 0, 0, 0.2)" },
        },
        data: spec.data.map((d, index) => ({
          name: d.label,
          value: d.value,
          itemStyle: { color: colors[index % colors.length] },
        })),
      },
    ],
  };
}
