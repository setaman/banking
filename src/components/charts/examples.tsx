/**
 * Example Chart Implementations
 * 
 * This file demonstrates how to use BaseChart for common financial visualizations.
 * These examples can be used as templates for Sprint 2 analytics features.
 */

import { BaseChart } from '@/components/charts/BaseChart';
import { CHART_COLORS, formatChartCurrency } from '@/lib/charts/theme';
import type { EChartsOption } from 'echarts';

/**
 * Example 1: Balance Over Time (Line Chart)
 * 
 * Shows account balance progression over days/months
 */
export function BalanceLineChart() {
  const option: EChartsOption = {
    title: {
      text: 'Account Balance',
      left: 'center',
    },
    xAxis: {
      type: 'category',
      data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => formatChartCurrency(value),
      },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0];
        return `${data.name}<br/>${formatChartCurrency(data.value)}`;
      },
    },
    series: [
      {
        name: 'Balance',
        type: 'line',
        data: [1200, 1350, 1280, 1450, 1600, 1750],
        smooth: true,
        itemStyle: {
          color: CHART_COLORS.primary,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
            ],
          },
        },
      },
    ],
  };

  return <BaseChart option={option} height={350} />;
}

/**
 * Example 2: Income vs Expenses (Bar Chart)
 * 
 * Compares monthly income and expenses side by side
 */
export function IncomeExpenseBarChart() {
  const option: EChartsOption = {
    title: {
      text: 'Income vs Expenses',
      left: 'center',
    },
    legend: {
      data: ['Income', 'Expenses'],
      top: 30,
    },
    xAxis: {
      type: 'category',
      data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => formatChartCurrency(value),
      },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = `${params[0].name}<br/>`;
        params.forEach((item: any) => {
          result += `${item.marker} ${item.seriesName}: ${formatChartCurrency(item.value)}<br/>`;
        });
        return result;
      },
    },
    series: [
      {
        name: 'Income',
        type: 'bar',
        data: [2200, 2400, 2100, 2500, 2600, 2300],
        itemStyle: {
          color: CHART_COLORS.income,
        },
      },
      {
        name: 'Expenses',
        type: 'bar',
        data: [1800, 1950, 1750, 2000, 1900, 1850],
        itemStyle: {
          color: CHART_COLORS.expense,
        },
      },
    ],
  };

  return <BaseChart option={option} height={400} />;
}

/**
 * Example 3: Category Breakdown (Pie Chart)
 * 
 * Shows expense distribution by category
 */
export function CategoryPieChart() {
  const option: EChartsOption = {
    title: {
      text: 'Expense Categories',
      left: 'center',
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `${params.name}: ${formatChartCurrency(params.value)} (${params.percent}%)`;
      },
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle',
    },
    series: [
      {
        name: 'Categories',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}: {d}%',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        data: [
          { value: 450, name: 'Groceries', itemStyle: { color: '#f59e0b' } },
          { value: 280, name: 'Transport', itemStyle: { color: '#8b5cf6' } },
          { value: 520, name: 'Housing', itemStyle: { color: '#ef4444' } },
          { value: 180, name: 'Entertainment', itemStyle: { color: '#3b82f6' } },
          { value: 220, name: 'Utilities', itemStyle: { color: '#10b981' } },
          { value: 150, name: 'Other', itemStyle: { color: '#6b7280' } },
        ],
      },
    ],
  };

  return <BaseChart option={option} height={400} />;
}

/**
 * Example 4: Daily Transactions (Mixed Chart)
 * 
 * Shows daily transaction volume with bar chart + cumulative line
 */
export function DailyTransactionsChart() {
  const option: EChartsOption = {
    title: {
      text: 'Daily Transaction Activity',
      left: 'center',
    },
    legend: {
      data: ['Transactions', 'Cumulative'],
      top: 30,
    },
    xAxis: {
      type: 'category',
      data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    yAxis: [
      {
        type: 'value',
        name: 'Count',
        position: 'left',
      },
      {
        type: 'value',
        name: 'Cumulative',
        position: 'right',
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    series: [
      {
        name: 'Transactions',
        type: 'bar',
        data: [12, 8, 15, 10, 18, 6, 4],
        itemStyle: {
          color: CHART_COLORS.primary,
        },
      },
      {
        name: 'Cumulative',
        type: 'line',
        yAxisIndex: 1,
        data: [12, 20, 35, 45, 63, 69, 73],
        smooth: true,
        itemStyle: {
          color: CHART_COLORS.secondary,
        },
      },
    ],
  };

  return <BaseChart option={option} height={350} />;
}

/**
 * Example 5: Loading State
 * 
 * Demonstrates how to show loading spinner while data is being fetched
 */
export function LoadingChartExample({ isLoading }: { isLoading: boolean }) {
  const option: EChartsOption = {
    title: {
      text: 'Chart with Loading State',
    },
    xAxis: { type: 'category', data: [] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: [] }],
  };

  return <BaseChart option={option} loading={isLoading} height={300} />;
}

/**
 * Example 6: Responsive Chart
 * 
 * Shows how to use the responsive helper for mobile-friendly charts
 */
export function ResponsiveChartExample() {
  const option: EChartsOption = {
    title: {
      text: 'Responsive Chart',
      left: 'center',
    },
    xAxis: {
      type: 'category',
      data: ['A', 'B', 'C', 'D', 'E'],
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        type: 'bar',
        data: [100, 200, 150, 300, 250],
        itemStyle: {
          color: CHART_COLORS.income,
        },
      },
    ],
  };

  return (
    <BaseChart 
      option={option} 
      height={300} 
      className="w-full"
    />
  );
}
