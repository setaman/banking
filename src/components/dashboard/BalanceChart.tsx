/**
 * BalanceChart Component
 * 
 * Line chart showing account balance over time with:
 * - Time period selector (30/90/365 days)
 * - Gradient fill (green for profitable, red for losing)
 * - Interactive tooltip with current balance
 * - Loading state
 * - Empty state handling
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BaseChart, useChartTheme } from '@/components/charts/BaseChart';
import { getTransactionsByAccount } from '@/lib/db';
import { calculateBalanceHistory } from '@/lib/statistics';
import { CHART_COLORS, formatChartCurrency } from '@/lib/charts/theme';
import type { EChartsOption } from 'echarts';
import type { Transaction } from '@/types';

export interface BalanceChartProps {
  /** Account ID to display (or 'all' for combined view) */
  accountId: string;
  
  /** Additional CSS class names */
  className?: string;
  
  /** Default time period */
  defaultPeriod?: 30 | 90 | 365;
}

type TimePeriod = 30 | 90 | 365;

const PERIOD_LABELS: Record<TimePeriod, string> = {
  30: '30 Days',
  90: '90 Days',
  365: '1 Year',
};

/**
 * Format date for chart x-axis
 */
function formatDate(date: Date, period: TimePeriod): string {
  if (period === 30) {
    // Show "Jan 15" for 30 days
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } else if (period === 90) {
    // Show "Jan 15" for 90 days
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } else {
    // Show "Jan '24" for 1 year
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: '2-digit',
    }).format(date);
  }
}

export function BalanceChart({
  accountId,
  className,
  defaultPeriod = 30,
}: BalanceChartProps) {
  const [period, setPeriod] = useState<TimePeriod>(defaultPeriod);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const theme = useChartTheme();

  // Load transactions
  useEffect(() => {
    setIsLoading(true);
    getTransactionsByAccount(accountId)
      .then(setTransactions)
      .finally(() => setIsLoading(false));
  }, [accountId]);

  // Calculate balance history
  const balanceHistory = calculateBalanceHistory(transactions, period);
  
  // Determine if overall trend is positive (for gradient color)
  const isPositiveTrend = balanceHistory.length > 0 && 
    balanceHistory[balanceHistory.length - 1].balance >= 0;

  // Prepare chart data
  const dates = balanceHistory.map(point => formatDate(point.date, period));
  const balances = balanceHistory.map(point => point.balance / 100); // Convert to EUR

  // ECharts option
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0];
        const value = data.value as number;
        const balanceInCents = Math.round(value * 100);
        return `
          <div style="padding: 4px 0;">
            <div style="font-weight: 600; margin-bottom: 4px;">${data.name}</div>
            <div style="color: ${value >= 0 ? CHART_COLORS.income : CHART_COLORS.expense}; font-weight: 600;">
              ${formatChartCurrency(balanceInCents)}
            </div>
          </div>
        `;
      },
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: {
        rotate: period === 365 ? 45 : 0,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => {
          const formatted = new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(value);
          return `${formatted} €`;
        },
      },
    },
    series: [
      {
        name: 'Balance',
        type: 'line',
        data: balances,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3,
          color: isPositiveTrend ? CHART_COLORS.income : CHART_COLORS.expense,
        },
        itemStyle: {
          color: isPositiveTrend ? CHART_COLORS.income : CHART_COLORS.expense,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: isPositiveTrend 
                  ? 'rgba(16, 185, 129, 0.3)' // green with opacity
                  : 'rgba(239, 68, 68, 0.3)',  // red with opacity
              },
              {
                offset: 1,
                color: isPositiveTrend 
                  ? 'rgba(16, 185, 129, 0.05)'
                  : 'rgba(239, 68, 68, 0.05)',
              },
            ],
          },
        },
        emphasis: {
          focus: 'series',
        },
      },
    ],
    grid: {
      left: '3%',
      right: '3%',
      bottom: period === 365 ? '15%' : '3%',
      top: '3%',
      containLabel: true,
    },
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Balance History</CardTitle>
          
          {/* Period Selector */}
          <div className="flex gap-2">
            {([30, 90, 365] as TimePeriod[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex h-[400px] items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
              <p className="mt-2 text-sm text-muted-foreground">Loading chart data...</p>
            </div>
          </div>
        ) : balanceHistory.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">No data available</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No transactions found for the selected period
              </p>
            </div>
          </div>
        ) : (
          <BaseChart
            option={option}
            theme={theme}
            height={400}
            loading={isLoading}
          />
        )}

        {/* Current Balance Summary */}
        {balanceHistory.length > 0 && !isLoading && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-sm text-muted-foreground">Current Balance</span>
            <span
              className={`text-lg font-semibold ${
                isPositiveTrend
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatChartCurrency(balanceHistory[balanceHistory.length - 1].balance)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
