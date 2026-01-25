"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "next-themes";
import {
  ShoppingBasket,
  ReceiptText,
  Home,
  Bus,
  Gamepad2,
  Activity,
  ShoppingBag,
  UtensilsCrossed,
  RefreshCw,
  ArrowUpRight,
  Layers,
  TrendingDown
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { calculateTopCategories } from "@/lib/stats/calculations";
import type { UnifiedTransaction } from "@/lib/banking/types";

const MotionCard = motion.create(Card);

interface CategoryBreakdownChartProps {
  transactions: UnifiedTransaction[];
  limit?: number;
}

const categoryIconMap: Record<string, any> = {
  Groceries: ShoppingBasket,
  Bills: ReceiptText,
  Rent: Home,
  Transport: Bus,
  Entertainment: Gamepad2,
  Healthcare: Activity,
  Shopping: ShoppingBag,
  Dining: UtensilsCrossed,
  Subscriptions: RefreshCw,
  Income: ArrowUpRight,
  Other: Layers,
};

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

  const colors = useMemo(() => getCategoryColors(isDark), [isDark]);

  const hasData = categoryData.length > 0;

  const chartOption = useMemo(() => {
    if (!hasData) return null;

    return {
      backgroundColor: "transparent",
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
          const value = new Intl.NumberFormat("de-DE", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 2,
          }).format(params.value);

          return `
            <div style="padding: 4px 0;">
              <div style="font-weight: 600; margin-bottom: 6px;">${params.name}</div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${params.color};"></span>
                <span style="flex: 1; opacity: 0.8;">Amount:</span>
                <span style="font-weight: 600;">${value}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: transparent;"></span>
                <span style="flex: 1; opacity: 0.8;">Share:</span>
                <span style="font-weight: 600;">${params.percent.toFixed(1)}%</span>
              </div>
            </div>
          `;
        },
      },
      legend: {
        show: false,
      },
      series: [
        {
          name: "Spending",
          type: "pie",
          radius: ["60%", "85%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: isDark ? "rgba(18, 24, 38, 1)" : "rgba(255, 255, 255, 1)",
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            scale: true,
            scaleSize: 5,
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.2)",
            },
          },
          data: categoryData.map((item, index) => ({
            name: item.category,
            value: item.amount,
            itemStyle: {
              color: colors[index % colors.length],
            },
          })),
        },
      ],
    };
  }, [hasData, isDark, categoryData, colors]);

  if (!hasData) {
    return (
      <Card className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
        <TrendingDown className="h-10 w-10 mb-4 opacity-20" />
        <p>No transaction data available for this period.</p>
      </Card>
    );
  }

  return (
    <MotionCard
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="overflow-hidden h-full"
    >
      <CardHeader className="flex flex-col gap-2 p-6">
        <CardTitle>Spending by Category</CardTitle>
        <p className="text-muted-foreground text-sm">
          Showing top {categoryData.length} categories
        </p>
      </CardHeader>

      <CardContent className="p-6 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-[300px] sm:h-[350px] md:h-[400px]">
          {/* Chart Section */}
          <div className="h-full relative">
            <ReactECharts
              option={chartOption}
              style={{ height: "100%", width: "100%" }}
            />
            {/* Center Text for Doughnut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">Total</span>
              <span className="text-xl font-bold">
                €{categoryData.reduce((sum, item) => sum + item.amount, 0).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Legend Section */}
          <div className="flex flex-col gap-2 h-full overflow-y-auto pr-2 custom-scrollbar">
            {categoryData.slice(0, limit).map((item, index) => {
              const Icon = categoryIconMap[item.category] || Layers;
              const color = colors[index % colors.length];

              return (
                <motion.div
                  key={item.category}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-default border border-transparent hover:border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="p-1.5 rounded-md"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">
                        {item.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold">
                      {item.formatted}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </MotionCard>
  );
}
