/**
 * IncomeExpenseChart Component
 * 
 * Bar chart comparing income vs expenses with:
 * - Period selector (This Month / This Year)
 * - Net income calculation and display
 * - Green bars for income, red bars for expenses
 * - Percentage comparison
 * - Loading state
 * - Empty state handling
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BaseChart, useChartTheme } from '@/components/charts/BaseChart';
import { getTransactionsByAccount } from '@/lib/db';
import { calculateIncomeExpense } from '@/lib/statistics';
import { CHART_COLORS, formatChartCurrency } from '@/lib/charts/theme';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import type { Transaction } from '@/types';

export interface IncomeExpenseChartProps {
  /** Account ID to display (or 'all' for combined view) */
  accountId: string;
  
  /** Additional CSS class names */
  className?: string;
  
  /** Default period */
  defaultPeriod?: 'month' | 'year';
}

type Period = 'month' | 'year';

const PERIOD_LABELS: Record<Period, string> = {
  month: 'This Month',
  year: 'This Year',
};

export function IncomeExpenseChart({
  accountId,
  className,
  defaultPeriod = 'month',
}: IncomeExpenseChartProps) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
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

  // Calculate income and expenses for selected period
  const { income, expense } = calculateIncomeExpense(transactions, period);
  
  // Calculate net income (positive = surplus, negative = deficit)
  const netIncome = income - expense;
  const netIncomeInEur = netIncome / 100;
  
  // Calculate percentages for comparison
  const total = income + expense;
  const incomePercentage = total > 0 ? (income / total) * 100 : 0;
  const expensePercentage = total > 0 ? (expense / total) * 100 : 0;

  // Convert to EUR for chart display
  const incomeInEur = income / 100;
  const expenseInEur = expense / 100;

  // ECharts option
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params: any) => {
        const items = params.map((item: any) => {
          const value = item.value as number;
          const valueInCents = Math.round(value * 100);
          const percentage = item.seriesName === 'Income' ? incomePercentage : expensePercentage;
          return `
            <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; background-color: ${item.color}; border-radius: 50%;"></span>
              <span style="flex: 1; font-weight: 600;">${item.seriesName}</span>
              <span style="font-weight: 600;">${formatChartCurrency(valueInCents)}</span>
              <span style="color: #6b7280; font-size: 12px;">${percentage.toFixed(1)}%</span>
            </div>
          `;
        }).join('');
        
        return `
          <div style="padding: 4px 0;">
            <div style="font-weight: 600; margin-bottom: 8px;">${params[0].name}</div>
            ${items}
          </div>
        `;
      },
    },
    legend: {
      data: ['Income', 'Expenses'],
      bottom: 0,
    },
    xAxis: {
      type: 'category',
      data: [PERIOD_LABELS[period]],
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
        name: 'Income',
        type: 'bar',
        data: [incomeInEur],
        itemStyle: {
          color: CHART_COLORS.income,
        },
        barMaxWidth: 100,
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => {
            const value = params.value as number;
            return new Intl.NumberFormat('de-DE', {
              style: 'currency',
              currency: 'EUR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value);
          },
          fontSize: 14,
          fontWeight: 'bold',
          color: CHART_COLORS.income,
        },
      },
      {
        name: 'Expenses',
        type: 'bar',
        data: [expenseInEur],
        itemStyle: {
          color: CHART_COLORS.expense,
        },
        barMaxWidth: 100,
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => {
            const value = params.value as number;
            return new Intl.NumberFormat('de-DE', {
              style: 'currency',
              currency: 'EUR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value);
          },
          fontSize: 14,
          fontWeight: 'bold',
          color: CHART_COLORS.expense,
        },
      },
    ],
    grid: {
      left: '3%',
      right: '3%',
      bottom: '15%',
      top: '15%',
      containLabel: true,
    },
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Income vs Expenses</CardTitle>
          
          {/* Period Selector */}
          <div className="flex gap-2">
            {(['month', 'year'] as Period[]).map((p) => (
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
        ) : income === 0 && expense === 0 ? (
          <div className="flex h-[400px] items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">No data available</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No transactions found for the selected period
              </p>
            </div>
          </div>
        ) : (
          <>
            <BaseChart
              option={option}
              theme={theme}
              height={400}
              loading={isLoading}
            />

            {/* Net Income Summary */}
            <div className="mt-4 space-y-3 border-t pt-4">
              {/* Net Income Display */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {netIncome >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                  <span className="font-medium">Net Income</span>
                </div>
                <span
                  className={`text-2xl font-bold ${
                    netIncome >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {netIncome >= 0 ? '+' : ''}
                  {new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(netIncomeInEur)}
                </span>
              </div>

              {/* Percentage Breakdown */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-green-600 dark:bg-green-400" />
                    <span className="text-muted-foreground">Income</span>
                  </div>
                  <p className="font-semibold">
                    {incomePercentage.toFixed(1)}% of total
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-600 dark:bg-red-400" />
                    <span className="text-muted-foreground">Expenses</span>
                  </div>
                  <p className="font-semibold">
                    {expensePercentage.toFixed(1)}% of total
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
