/**
 * BaseChart Component
 * 
 * Reusable wrapper around echarts-for-react with:
 * - Responsive sizing
 * - Theme support (light/dark mode ready)
 * - Common configuration
 * - TypeScript types
 * - Performance optimizations
 */

import { useEffect, useRef, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import type { EChartsOption, ECharts } from 'echarts';
import { useThemeStore } from '@/store/theme.store';

// Import ECharts components as needed
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
} from 'echarts/components';

import {
  LineChart,
  BarChart,
  PieChart,
} from 'echarts/charts';

import { CanvasRenderer } from 'echarts/renderers';

import { mergeThemeOptions } from '@/lib/charts/theme';

// Register ECharts components
echarts.use([
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  LineChart,
  BarChart,
  PieChart,
  CanvasRenderer,
]);

export interface BaseChartProps {
  /** ECharts option configuration */
  option: EChartsOption;
  
  /** Chart theme mode (defaults to light) */
  theme?: 'light' | 'dark';
  
  /** Custom height (defaults to 400px) */
  height?: string | number;
  
  /** Custom width (defaults to 100%) */
  width?: string | number;
  
  /** Additional CSS class names */
  className?: string;
  
  /** Enable loading state */
  loading?: boolean;
  
  /** Loading options */
  loadingOption?: object;
  
  /** Callback when chart is ready */
  onChartReady?: (chart: ECharts) => void;
  
  /** Custom merge mode for options updates */
  notMerge?: boolean;
  
  /** Whether to use lazy update (batch updates) */
  lazyUpdate?: boolean;
}

/**
 * BaseChart - Reusable chart wrapper component
 * 
 * @example
 * ```tsx
 * <BaseChart
 *   option={{
 *     xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
 *     yAxis: { type: 'value' },
 *     series: [{ data: [120, 200, 150], type: 'line' }]
 *   }}
 *   theme="light"
 *   height={400}
 * />
 * ```
 */
export function BaseChart({
  option,
  theme = 'light',
  height = 400,
  width = '100%',
  className = '',
  loading = false,
  loadingOption,
  onChartReady,
  notMerge = false,
  lazyUpdate = false,
}: BaseChartProps) {
  const chartRef = useRef<ReactEChartsCore | null>(null);
  const [chartInstance, setChartInstance] = useState<ECharts | null>(null);

  // Merge theme with custom options
  const themedOption = mergeThemeOptions(option, theme);

  // Handle chart instance ready
  const handleChartReady = (chart: ECharts) => {
    setChartInstance(chart);
    onChartReady?.(chart);
  };

  // Responsive resize handler
  useEffect(() => {
    if (!chartInstance) return;

    const handleResize = () => {
      chartInstance.resize();
    };

    // Use ResizeObserver for more accurate container size detection
    const resizeObserver = new ResizeObserver(handleResize);
    const chartContainer = chartRef.current?.getEchartsInstance().getDom().parentElement;
    
    if (chartContainer) {
      resizeObserver.observe(chartContainer);
    }

    // Fallback to window resize
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [chartInstance]);

  // Default loading options
  const defaultLoadingOption = {
    text: 'Loading...',
    color: theme === 'dark' ? '#3b82f6' : '#2563eb',
    textColor: theme === 'dark' ? '#f9fafb' : '#111827',
    maskColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    zlevel: 0,
  };

  return (
    <div className={className} style={{ width, height }}>
      <ReactEChartsCore
        ref={chartRef}
        echarts={echarts}
        option={themedOption}
        notMerge={notMerge}
        lazyUpdate={lazyUpdate}
        style={{
          height: '100%',
          width: '100%',
        }}
        showLoading={loading}
        loadingOption={loadingOption || defaultLoadingOption}
        onChartReady={handleChartReady}
        opts={{
          renderer: 'canvas',
          devicePixelRatio: window.devicePixelRatio || 1,
        }}
      />
    </div>
  );
}

/**
 * Hook to get current theme mode
 * 
 * Connects with theme store to get current effective theme
 */
export function useChartTheme(): 'light' | 'dark' {
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  return effectiveTheme;
}

/**
 * Utility function to create responsive chart options
 * Adjusts font sizes and spacing based on container width
 */
export function getResponsiveOption(
  baseOption: EChartsOption,
  containerWidth: number
): EChartsOption {
  const isMobile = containerWidth < 640; // Tailwind 'sm' breakpoint
  const isTablet = containerWidth >= 640 && containerWidth < 1024; // Between 'sm' and 'lg'

  if (isMobile) {
    return {
      ...baseOption,
      grid: {
        ...baseOption.grid,
        left: '5%',
        right: '5%',
        bottom: '5%',
        top: '15%',
      },
      legend: {
        ...baseOption.legend,
        textStyle: {
          fontSize: 10,
        },
      },
    };
  }

  if (isTablet) {
    return {
      ...baseOption,
      grid: {
        ...baseOption.grid,
        left: '4%',
        right: '4%',
        bottom: '4%',
        top: '12%',
      },
    };
  }

  return baseOption;
}

export default BaseChart;
