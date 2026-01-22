# ECharts Integration - Installation Instructions

## Sprint 2.4: Install Required Dependencies

Run the following command from the project root (`F:\Projects\banking`):

```bash
npm install echarts echarts-for-react
npm install -D @types/echarts-for-react
```

## Verification

After installation, verify that TypeScript compilation works:

```bash
npm run type-check
```

Then start the dev server to ensure no runtime errors:

```bash
npm run dev
```

## Files Created

1. **`src/lib/charts/theme.ts`** - Theme configuration with:
   - Financial color palette (green for income, red for expenses)
   - Light/dark mode themes
   - Typography settings
   - Helper functions for formatting and color selection

2. **`src/components/charts/BaseChart.tsx`** - Reusable chart wrapper with:
   - Responsive sizing (uses ResizeObserver)
   - Theme support (light/dark)
   - Loading states
   - TypeScript types
   - Performance optimizations

## Next Steps

After installation, you can create specific chart components:

```tsx
// Example: Line chart for balance over time
import { BaseChart } from '@/components/charts/BaseChart';

const option = {
  xAxis: { type: 'category', data: ['Jan', 'Feb', 'Mar'] },
  yAxis: { type: 'value' },
  series: [{ 
    data: [1200, 1350, 1500], 
    type: 'line',
    smooth: true 
  }]
};

<BaseChart option={option} height={300} />
```

## Color Scheme Recommendation

The theme uses Tailwind's semantic colors:

- **Income/Positive**: `#10b981` (Green-500) - Clear indication of gains
- **Expense/Negative**: `#ef4444` (Red-500) - Clear indication of losses
- **Neutral**: `#6b7280` (Gray-500) - For zero or neutral values
- **Primary Series**: `#3b82f6` (Blue-500) - For general data series

This palette provides:
- ✅ High contrast and readability
- ✅ Accessibility (distinguishable by colorblind users with labels)
- ✅ Consistency with Tailwind CSS (already used in the project)
- ✅ Professional, financial app aesthetic
