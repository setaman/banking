"use client";

import {
  init,
  type EChartsOption,
  type ECharts,
  type SetOptionOpts,
  getInstanceByDom,
} from "echarts";
import { useRef, CSSProperties, useEffect } from "react";

export interface ReactEChartsProps {
  option: EChartsOption;
  style?: CSSProperties;
  settings?: SetOptionOpts;
  loading?: boolean;
  theme?: "light" | "dark";
}

const defaultOptions: ReactEChartsProps["option"] = {
  legend: {
    show: false,
  },
  tooltip: {},
  color: "rgb(37, 99, 235)",
  animationEasing: "elasticOut",
  animationDelayUpdate: function (idx) {
    return idx * 5;
  },
  grid: {
    left: "0",
    right: "0",
    bottom: "0",
    containLabel: true,
    height: "95%",
  },
};

export function EChart({
  option,
  style,
  settings,
  loading,
  theme,
}: ReactEChartsProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize chart
    let chart: ECharts | undefined;
    if (chartRef.current !== null) {
      chart = init(chartRef.current, theme);
    }

    // Add chart resize listener
    // ResizeObserver is leading to a bit janky UX
    function resizeChart() {
      chart?.resize();
    }
    window.addEventListener("resize", resizeChart);

    // Return cleanup function
    return () => {
      chart?.dispose();
      window.removeEventListener("resize", resizeChart);
    };
  }, [theme]);

  useEffect(() => {
    // Update chart
    if (chartRef.current !== null) {
      const chart = getInstanceByDom(chartRef.current);
      chart?.setOption({ ...defaultOptions, ...option }, settings);
    }
  }, [option, settings, theme]); // Whenever theme changes we need to add option and setting due to it being deleted in cleanup function

  useEffect(() => {
    // Update chart
    if (chartRef.current !== null) {
      const chart = getInstanceByDom(chartRef.current);
      loading === true ? chart?.showLoading() : chart?.hideLoading();
    }
  }, [loading, theme]);

  return (
    <div ref={chartRef} style={{ width: "100%", height: "400px", ...style }} />
  );
}
