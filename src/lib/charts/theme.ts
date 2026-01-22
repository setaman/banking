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
 * Color palette for financial data
 * Optimized for readability and accessibility
 */
export const CHART_COLORS = {
  // Financial colors
  income: '#10b981',      // Green-500 (Tailwind) - for income/positive
  expense: '#ef4444',     // Red-500 (Tailwind) - for expenses/negative
  neutral: '#6b7280',     // Gray-500 - for neutral data
  
  // Chart series colors (for multi-series charts)
  primary: '#3b82f6',     // Blue-500 - primary series
  secondary: '#8b5cf6',   // Violet-500 - secondary series
  tertiary: '#f59e0b',    // Amber-500 - tertiary series
  
  // Background colors (light/dark mode support)
  bgLight: '#ffffff',
  bgDark: '#1f2937',      // Gray-800
  
  // Text colors
  textLight: '#111827',   // Gray-900
  textDark: '#f9fafb',    // Gray-50
  textSecondaryLight: '#6b7280', // Gray-500
  textSecondaryDark: '#9ca3af',  // Gray-400
  
  // Grid and border colors
  gridLight: '#e5e7eb',   // Gray-200
  gridDark: '#374151',    // Gray-700
  borderLight: '#d1d5db', // Gray-300
  borderDark: '#4b5563',  // Gray-600
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
      borderColor: CHART_COLORS.borderLight,
      containLabel: true,
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
    },
    
    xAxis: {
      axisLine: {
        lineStyle: {
          color: CHART_COLORS.gridLight,
        },
      },
      axisLabel: {
        color: CHART_COLORS.textSecondaryLight,
        fontSize: CHART_FONTS.size.axis,
      },
      splitLine: {
        lineStyle: {
          color: CHART_COLORS.gridLight,
          type: 'dashed',
        },
      },
    },
    
    yAxis: {
      axisLine: {
        lineStyle: {
          color: CHART_COLORS.gridLight,
        },
      },
      axisLabel: {
        color: CHART_COLORS.textSecondaryLight,
        fontSize: CHART_FONTS.size.axis,
      },
      splitLine: {
        lineStyle: {
          color: CHART_COLORS.gridLight,
          type: 'dashed',
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
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: CHART_COLORS.borderLight,
      borderWidth: 1,
      textStyle: {
        color: CHART_COLORS.textLight,
        fontSize: CHART_FONTS.size.tooltip,
      },
      padding: [8, 12],
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);',
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
      borderColor: CHART_COLORS.borderDark,
      containLabel: true,
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
    },
    
    xAxis: {
      axisLine: {
        lineStyle: {
          color: CHART_COLORS.gridDark,
        },
      },
      axisLabel: {
        color: CHART_COLORS.textSecondaryDark,
        fontSize: CHART_FONTS.size.axis,
      },
      splitLine: {
        lineStyle: {
          color: CHART_COLORS.gridDark,
          type: 'dashed',
        },
      },
    },
    
    yAxis: {
      axisLine: {
        lineStyle: {
          color: CHART_COLORS.gridDark,
        },
      },
      axisLabel: {
        color: CHART_COLORS.textSecondaryDark,
        fontSize: CHART_FONTS.size.axis,
      },
      splitLine: {
        lineStyle: {
          color: CHART_COLORS.gridDark,
          type: 'dashed',
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
      backgroundColor: 'rgba(31, 41, 55, 0.95)',
      borderColor: CHART_COLORS.borderDark,
      borderWidth: 1,
      textStyle: {
        color: CHART_COLORS.textDark,
        fontSize: CHART_FONTS.size.tooltip,
      },
      padding: [8, 12],
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);',
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
