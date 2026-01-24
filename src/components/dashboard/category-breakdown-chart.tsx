"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "motion/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { calculateTopCategories } from "@/lib/stats/calculations";
import type { UnifiedTransaction } from "@/lib/banking/types";

const MotionCard = motion.create(Card);

interface CategoryBreakdownChartProps {
  transactions: UnifiedTransaction[];
  limit?: number;
}

// Vibrant category colors for Neo-Glass theme
const CATEGORY_COLORS = [
  "rgba(139, 92, 246, 1)", // Electric Indigo
  "rgba(217, 70, 239, 1)", // Purple
  "rgba(20, 184, 166, 1)", // Teal
  "rgba(251, 146, 60, 1)", // Orange
  "rgba(244, 114, 182, 1)", // Pink
  "rgba(34, 211, 238, 1)", // Cyan
  "rgba(253, 224, 71, 1)", // Yellow
  "rgba(167, 139, 250, 1)", // Violet
  "rgba(74, 222, 128, 1)", // Green
  "rgba(251, 191, 36, 1)", // Amber
];

export function CategoryBreakdownChart({
  transactions,
  limit = 10,
}: CategoryBreakdownChartProps) {
  const categoryData = useMemo(
    () => calculateTopCategories(transactions, limit),
    [transactions, limit],
  );

  const hasData = categoryData.length > 0;

  const chartOption = useMemo(() => {
    if (!hasData) return null;

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(30, 41, 59, 0.95)",
        borderColor: "rgba(255, 255, 255, 0.15)",
        borderWidth: 1,
        textStyle: {
          color: "rgba(241, 245, 249, 1)",
          fontSize: 14,
        },
        formatter: (params: any) => {
          const category = params.name;
          const value = params.value;
          const percentage = params.percent;
          return `
            <div style="padding: 4px 8px;">
              <div style="font-weight: 600; margin-bottom: 4px;">${category}</div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: rgba(148, 163, 184, 1);">Amount:</span>
                <span style="font-weight: 500;">€${value.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: rgba(148, 163, 184, 1);">Share:</span>
                <span style="font-weight: 500; color: ${params.color};">${percentage.toFixed(1)}%</span>
              </div>
            </div>
          `;
        },
      },
      legend: {
        orient: "vertical",
        right: "10%",
        top: "center",
        textStyle: {
          color: "rgba(148, 163, 184, 1)",
          fontSize: 13,
        },
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 10,
        formatter: (name: string) => {
          const item = categoryData.find((cat) => cat.category === name);
          return item ? `${name}  ${item.formatted}` : name;
        },
      },
      series: [
        {
          name: "Spending by Category",
          type: "pie",
          radius: ["45%", "70%"],
          center: ["35%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: "oklch(0.12 0.04 260)",
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: "bold",
              color: "rgba(241, 245, 249, 1)",
              formatter: "{d}%",
            },
            itemStyle: {
              color: "inherit",
              shadowBlur: 20,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
            scale: true,
            scaleSize: 8,
          },
          labelLine: {
            show: false,
          },
          data: categoryData.map((cat, index) => ({
            value: cat.amount,
            name: cat.category,
            itemStyle: {
              color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
              shadowBlur: 10,
              shadowColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
            },
          })),
          animationType: "scale",
          animationEasing: "elasticOut",
          animationDelay: (idx: number) => idx * 50,
        },
      ],
    };
  }, [categoryData, hasData]);

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
