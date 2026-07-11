"use client";

import { useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { useTheme } from "next-themes";

import {
  buildLineChartOption,
  type LineChartSpec,
} from "@/lib/ai/visualization-mapper";

interface LineChartViewProps {
  readonly spec: LineChartSpec;
}

export function LineChartView({ spec }: LineChartViewProps): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const chartRef = useRef<ReactECharts | null>(null);

  const option = buildLineChartOption(spec, isDark);

  // Dispose the ECharts instance on unmount — same guard as
  // `bar-chart-view.tsx` / `comparison-chart.tsx` to survive React 18 Strict
  // Mode's mount/unmount double-invoke.
  useEffect(() => {
    const chartNode = chartRef.current;
    return () => {
      try {
        const instance = chartNode?.getEchartsInstance();
        if (instance && !instance.isDisposed()) {
          instance.dispose();
        }
      } catch {
        // Instance already disposed — nothing to clean up.
      }
    };
  }, []);

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ height: "100%", width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
      lazyUpdate
    />
  );
}
