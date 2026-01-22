import { useState, useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { BaseChart } from '../charts/BaseChart';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Transaction } from '@/types';
import { calculateCategoryBreakdown } from '@/lib/statistics';
import { useCategories } from '@/hooks/useCategories';

interface CategoryPieChartProps {
  transactions: Transaction[];
}

type Period = 'month' | 'year';

/**
 * CategoryPieChart - Displays expense distribution by category
 * 
 * Features:
 * - Interactive pie/donut chart
 * - Period selector (This Month / This Year)
 * - Shows percentage and amount
 * - Color-coded by category
 * - Only shows categories with non-zero amounts
 * 
 * @example
 * ```tsx
 * <CategoryPieChart transactions={transactions} />
 * ```
 */
export function CategoryPieChart({ transactions }: CategoryPieChartProps) {
  const [period, setPeriod] = useState<Period>('month');
  const { getCategoryInfo } = useCategories();

  // Filter transactions by period
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startDate = new Date(now);

    if (period === 'month') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // year
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
    }

    return transactions.filter(tx => tx.bookingDate >= startDate);
  }, [transactions, period]);

  // Calculate category breakdown
  const categoryData = useMemo(() => {
    const breakdown = calculateCategoryBreakdown(filteredTransactions);
    
    // Only include expenses (exclude income and transfers)
    const expenseCategories = Object.entries(breakdown)
      .filter(([category]) => category !== 'income' && category !== 'transfer')
      .map(([category, amount]) => ({
        category,
        amount,
        info: getCategoryInfo(category as never),
      }))
      .filter(item => item.amount > 0) // Only non-zero amounts
      .sort((a, b) => b.amount - a.amount); // Sort by amount descending

    const total = expenseCategories.reduce((sum, item) => sum + item.amount, 0);

    return expenseCategories.map(item => ({
      name: item.info.label,
      value: item.amount / 100, // Convert to euros for display
      valueInCents: item.amount,
      icon: item.info.icon,
      color: item.info.color,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
    }));
  }, [filteredTransactions, getCategoryInfo]);

  // ECharts option
  const option: EChartsOption = useMemo(() => {
    if (categoryData.length === 0) {
      return {};
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const value = params.value;
          const percent = params.percent;
          return `
            <div style="padding: 8px 4px;">
              <div style="font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                ${params.marker} <span>${params.name}</span>
              </div>
              <div style="font-size: 15px; font-weight: 700; color: ${params.color};">
                €${value.toFixed(2)}
              </div>
              <div style="color: #6b7280; font-size: 12px; margin-top: 2px;">
                ${percent.toFixed(1)}% of expenses
              </div>
            </div>
          `;
        },
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        icon: 'circle',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 12,
        textStyle: {
          fontSize: 13,
          padding: [0, 0, 0, 4],
        },
        formatter: (name: string) => {
          const item = categoryData.find(d => d.name === name);
          if (!item) return name;
          return `${item.icon} ${name} (${item.percentage.toFixed(1)}%)`;
        },
      },
      series: [
        {
          name: 'Expenses',
          type: 'pie',
          radius: ['50%', '80%'], // Thicker donut
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          padAngle: 3,
          itemStyle: {
            borderRadius: 10,
            borderColor: 'transparent',
            borderWidth: 0,
            shadowBlur: 15,
            shadowColor: 'rgba(0, 0, 0, 0.15)',
            shadowOffsetY: 4,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 18,
              fontWeight: 'bold',
              color: '#111827',
              formatter: (params: any) => {
                return `€${params.value.toFixed(2)}`;
              },
            },
            itemStyle: {
              shadowBlur: 25,
              shadowOffsetY: 8,
              shadowColor: 'rgba(0, 0, 0, 0.25)',
            },
            scale: true,
            scaleSize: 8,
          },
          labelLine: {
            show: false,
          },
          data: categoryData.map(item => ({
            name: item.name,
            value: item.value,
            itemStyle: {
              color: item.color,
            },
          })),
        },
      ],
    };
  }, [categoryData]);

  // Calculate total expenses
  const totalExpenses = useMemo(() => {
    return categoryData.reduce((sum, item) => sum + item.valueInCents, 0);
  }, [categoryData]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Expenses by Category</CardTitle>
        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {categoryData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No expenses for this period
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Try selecting a different time period or add some transactions
            </p>
          </div>
        ) : (
          <>
            <BaseChart option={option} height={350} />
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </span>
                <span className="text-lg font-bold">
                  €{(totalExpenses / 100).toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {categoryData.length} categor{categoryData.length === 1 ? 'y' : 'ies'} • {filteredTransactions.filter(tx => tx.amount < 0).length} transactions
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
