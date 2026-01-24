"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { calculateTopCategories } from "@/lib/stats/calculations";
import type { UnifiedTransaction } from "@/lib/banking/types";

const MotionCard = motion.create(Card);

interface CategoryBreakdownChartProps {
  transactions: UnifiedTransaction[];
  limit?: number;
}

// Theme-aware category colors matching Neo-Glass design from globals.css
// These are approximations of the OKLCH values converted to RGB
const getCategoryColors = (isDark: boolean) => {
  if (isDark) {
    return [
      "rgb(139, 92, 246)",   // chart-1: Blue-Purple
      "rgb(217, 70, 239)",   // chart-2: Magenta
      "rgb(20, 184, 166)",   // chart-3: Teal
      "rgb(251, 146, 60)",   // chart-4: Orange
      "rgb(244, 114, 182)",  // chart-5: Pink
      "rgb(167, 139, 250)",  // Additional: Violet
      "rgb(74, 222, 128)",   // Additional: Green
      "rgb(251, 191, 36)",   // Additional: Amber
      "rgb(34, 211, 238)",   // Additional: Cyan
      "rgb(253, 224, 71)",   // Additional: Yellow
    ];
  } else {
    return [
      "rgb(109, 40, 217)",   // chart-1: Deeper Blue-Purple
      "rgb(192, 38, 211)",   // chart-2: Deeper Magenta
      "rgb(13, 148, 136)",   // chart-3: Deeper Teal
      "rgb(234, 88, 12)",    // chart-4: Deeper Orange
      "rgb(219, 39, 119)",   // chart-5: Deeper Pink
      "rgb(124, 58, 237)",   // Additional: Deeper Violet
      "rgb(22, 163, 74)",    // Additional: Deeper Green
      "rgb(217, 119, 6)",    // Additional: Deeper Amber
      "rgb(6, 182, 212)",    // Additional: Deeper Cyan
      "rgb(202, 138, 4)",    // Additional: Deeper Yellow
    ];
  }
};

export function CategoryBreakdownChart({
  transactions,
  limit = 10,
}: CategoryBreakdownChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const categoryData = useMemo(
    () => calculateTopCategories(transactions, limit),
    [transactions, limit],
  );

  const hasData = categoryData.length > 0;

  const chartOption = useMemo(() => {
    if (!hasData) return null;

    const colors = getCategoryColors(isDark);

    return {
      tooltip: {
        trigger: "item",
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
          const category = params.name;
          const value = params.value;
          const percentage = params.percent;
          return `
            <div style="padding: 4px 0;">
              <div style="font-weight: 600; margin-bottom: 6px;">${category}</div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 4px;">
                <span style="color: ${isDark ? "rgba(148, 163, 184, 1)" : "rgba(100, 116, 139, 1)"};">Amount:</span>
                <span style="font-weight: 600;">€${value.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 4px;">
                <span style="color: ${isDark ? "rgba(148, 163, 184, 1)" : "rgba(100, 116, 139, 1)"};">Share:</span>
                <span style="font-weight: 600; color: ${params.color};">${percentage.toFixed(1)}%</span>
              </div>
            </div>
          `;
        },
      },
      legend: {
        orient: "vertical",
        right: "8%",
        top: "center",
        textStyle: {
          color: isDark ? "rgba(226, 232, 240, 1)" : "rgba(100, 116, 139, 1)",
          fontSize: 12,
        },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 14,
        formatter: (name: string) => {
          const item = categoryData.find((cat) => cat.category === name);
          return item ? `${name}  ${item.formatted}` : name;
        },
      },
      series: [
        {
          name: "Spending by Category",
          type: "pie",
          radius: ["50%", "75%"],
          center: ["35%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 2,
            borderColor: isDark ? "rgba(18, 24, 38, 0.8)" : "rgba(255, 255, 255, 0.8)",
            borderWidth: 1,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: "bold",
              color: isDark ? "rgba(241, 245, 249, 1)" : "rgba(30, 41, 59, 1)",
              formatter: "{d}%",
            },
            itemStyle: {
              shadowBlur: 12,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.3)",
            },
            scale: true,
            scaleSize: 5,
          },
          labelLine: {
            show: false,
          },
          data: categoryData.map((cat, index) => ({
            value: cat.amount,
            name: cat.category,
            itemStyle: {
              color: colors[index % colors.length],
            },
          })),
          animationType: "scale",
          animationEasing: "elasticOut",
          animationDelay: (idx: number) => idx * 50,
        },
      ],
    };
  }, [categoryData, hasData, isDark]);

  if (!hasData) {
    return (
      <MotionCard
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col h-full"
      >
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center min-h-[400px]">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">No expense data available</p>
            <p className="text-sm mt-2">
              Add transactions to see category breakdown
            </p>
          </div>
        </CardContent>
      </MotionCard>
    );
  }

  return (
    <MotionCard
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex flex-col h-full relative overflow-hidden border-primary/10"
    >
      {/* Gradient background accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5 opacity-50 pointer-events-none" />

      <CardHeader className="relative z-10">
        <CardTitle>Spending by Category</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 relative z-10 min-h-[400px]">
        <ReactECharts
          option={chartOption!}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge={true}
          lazyUpdate={true}
        />
      </CardContent>

      {/* Loading state overlay */}
      {!chartOption && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading chart...</p>
          </div>
        </div>
      )}
    </MotionCard>
  );
}
