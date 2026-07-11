"use client";

import { useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { useTheme } from "next-themes";

import {
  buildBarChartOption,
  type BarChartSpec,
} from "@/lib/ai/visualization-mapper";

interface BarChartViewProps {
  readonly spec: BarChartSpec;
}

export function BarChartView({ spec }: BarChartViewProps): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const chartRef = useRef<ReactECharts | null>(null);

  const option = buildBarChartOption(spec, isDark);

  // Dispose the ECharts instance on unmount. Capture `chartRef.current` at
  // effect-setup time (not inside the cleanup closure) and guard with
  // `isDisposed()` inside a try/catch — React 18 Strict Mode's mount/unmount
  // double-invoke can otherwise crash on a second dispose of an already-gone
  // instance (see `comparison-chart.tsx`'s identical guard).
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
