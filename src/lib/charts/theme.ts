/**
 * ECharts Theme Configuration for Finance Dashboard
 * 
 * Provides consistent styling for financial data visualization:
 * - Green for income/positive values
 * - Red for expenses/negative values
 * - Clean, modern design with good contrast
 * - Responsive grid and typography
 */

import type { EChartsOption } from 'echarts';

/**
 * Modern color palette for financial data
 * Vibrant, sleek colors optimized for visual appeal and readability
 */
export const CHART_COLORS = {
  // Financial colors - Modern vibrant palette
  income: '#10b981',      // Emerald-500 - for income/positive
  incomeLight: '#34d399', // Emerald-400 - lighter shade
  incomeDark: '#059669',  // Emerald-600 - darker shade
  
  expense: '#f43f5e',     // Rose-500 - for expenses/negative
  expenseLight: '#fb7185', // Rose-400 - lighter shade
  expenseDark: '#e11d48', // Rose-600 - darker shade
  
  neutral: '#6b7280',     // Gray-500 - for neutral data
  
  // Chart series colors - Modern gradient-friendly palette
  primary: '#3b82f6',     // Blue-500
  primaryLight: '#60a5fa', // Blue-400
  primaryDark: '#2563eb', // Blue-600
  
  secondary: '#8b5cf6',   // Violet-500
  secondaryLight: '#a78bfa', // Violet-400
  secondaryDark: '#7c3aed', // Violet-600
  
  tertiary: '#f59e0b',    // Amber-500
  tertiaryLight: '#fbbf24', // Amber-400
  tertiaryDark: '#d97706', // Amber-600
  
  // Accent colors for category charts
  accent1: '#06b6d4',     // Cyan-500
  accent2: '#8b5cf6',     // Violet-500
  accent3: '#ec4899',     // Pink-500
  accent4: '#f59e0b',     // Amber-500
  accent5: '#10b981',     // Emerald-500
  accent6: '#6366f1',     // Indigo-500
  
  // Background colors (light/dark mode support)
  bgLight: 'transparent',
  bgDark: 'transparent',
  
  // Text colors
  textLight: '#111827',   // Gray-900
  textDark: '#f9fafb',    // Gray-50
  textSecondaryLight: '#6b7280', // Gray-500
  textSecondaryDark: '#9ca3af',  // Gray-400
  
  // Grid and border colors - Subtle for modern look
  gridLight: 'rgba(0, 0, 0, 0.05)',
  gridDark: 'rgba(255, 255, 255, 0.1)',
  borderLight: 'rgba(0, 0, 0, 0.1)',
  borderDark: 'rgba(255, 255, 255, 0.15)',
} as const;

/**
 * Font configuration using system fonts
 * Fallbacks ensure consistent rendering across platforms
 */
export const CHART_FONTS = {
  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  size: {
    title: 18,
    subtitle: 14,
    axis: 12,
    legend: 12,
    label: 11,
    tooltip: 13,
  },
  weight: {
    normal: 400,
    medium: 500,
    bold: 600,
  },
} as const;

/**
 * Get base theme configuration for light mode
 */
export function getLightTheme(): EChartsOption {
  return {
    backgroundColor: CHART_COLORS.bgLight,
    
    textStyle: {
      fontFamily: CHART_FONTS.family,
      fontSize: CHART_FONTS.size.axis,
      color: CHART_COLORS.textLight,
    },
    
    title: {
      textStyle: {
        color: CHART_COLORS.textLight,
        fontSize: CHART_FONTS.size.title,
        fontWeight: CHART_FONTS.weight.bold,
      },
      subtextStyle: {
        color: CHART_COLORS.textSecondaryLight,
        fontSize: CHART_FONTS.size.subtitle,
        fontWeight: CHART_FONTS.weight.normal,
      },
    },
    
    grid: {
      borderColor: 'transparent',
      containLabel: true,
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
    },
    
    xAxis: {
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: CHART_COLORS.textSecondaryLight,
        fontSize: CHART_FONTS.size.axis,
      },
      splitLine: {
        show: false,
      },
    },
    
    yAxis: {
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: CHART_COLORS.textSecondaryLight,
        fontSize: CHART_FONTS.size.axis,
      },
      splitLine: {
        lineStyle: {
          color: CHART_COLORS.gridLight,
          type: 'solid',
        },
      },
    },
    
    legend: {
      textStyle: {
        color: CHART_COLORS.textLight,
        fontSize: CHART_FONTS.size.legend,
      },
    },
    
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderColor: 'rgba(0, 0, 0, 0.08)',
      borderWidth: 1,
      textStyle: {
        color: CHART_COLORS.textLight,
        fontSize: CHART_FONTS.size.tooltip,
      },
      padding: [12, 16],
      extraCssText: 'border-radius: 8px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);',
    },
  };
}

/**
 * Get base theme configuration for dark mode
 */
export function getDarkTheme(): EChartsOption {
  return {
    backgroundColor: CHART_COLORS.bgDark,
    
    textStyle: {
      fontFamily: CHART_FONTS.family,
      fontSize: CHART_FONTS.size.axis,
      color: CHART_COLORS.textDark,
    },
    
    title: {
      textStyle: {
        color: CHART_COLORS.textDark,
        fontSize: CHART_FONTS.size.title,
        fontWeight: CHART_FONTS.weight.bold,
      },
      subtextStyle: {
        color: CHART_COLORS.textSecondaryDark,
        fontSize: CHART_FONTS.size.subtitle,
        fontWeight: CHART_FONTS.weight.normal,
      },
    },
    
    grid: {
      borderColor: 'transparent',
      containLabel: true,
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
    },
    
    xAxis: {
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: CHART_COLORS.textSecondaryDark,
        fontSize: CHART_FONTS.size.axis,
      },
      splitLine: {
        show: false,
      },
    },
    
    yAxis: {
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: CHART_COLORS.textSecondaryDark,
        fontSize: CHART_FONTS.size.axis,
      },
      splitLine: {
        lineStyle: {
          color: CHART_COLORS.gridDark,
          type: 'solid',
        },
      },
    },
    
    legend: {
      textStyle: {
        color: CHART_COLORS.textDark,
        fontSize: CHART_FONTS.size.legend,
      },
    },
    
    tooltip: {
      backgroundColor: 'rgba(31, 41, 55, 0.96)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      textStyle: {
        color: CHART_COLORS.textDark,
        fontSize: CHART_FONTS.size.tooltip,
      },
      padding: [12, 16],
      extraCssText: 'border-radius: 8px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);',
    },
  };
}

/**
 * Merge custom options with theme defaults
 * Useful for creating themed charts with custom configurations
 */
export function mergeThemeOptions(
  customOptions: EChartsOption,
  theme: 'light' | 'dark' = 'light'
): EChartsOption {
  const baseTheme = theme === 'dark' ? getDarkTheme() : getLightTheme();
  
  return {
    ...baseTheme,
    ...customOptions,
    // Deep merge specific properties
    textStyle: {
      ...baseTheme.textStyle,
      ...customOptions.textStyle,
    },
    grid: {
      ...baseTheme.grid,
      ...customOptions.grid,
    },
    tooltip: {
      ...baseTheme.tooltip,
      ...customOptions.tooltip,
    },
  };
}

/**
 * Get financial color based on value
 * @param value - Numeric value to check
 * @returns Color string (green for positive, red for negative, gray for zero)
 */
export function getFinancialColor(value: number): string {
  if (value > 0) return CHART_COLORS.income;
  if (value < 0) return CHART_COLORS.expense;
  return CHART_COLORS.neutral;
}

/**
 * Format currency for chart labels and tooltips
 * @param value - Numeric value to format
 * @param currency - Currency symbol (default: '€')
 * @returns Formatted currency string
 */
export function formatChartCurrency(value: number, currency: string = '€'): string {
  const formatted = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  
  return `${value < 0 ? '-' : ''}${formatted} ${currency}`;
}
