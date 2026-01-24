/**
 * DateRangePicker Usage Example
 *
 * This file demonstrates how to use the DateRangePicker component
 * with the useDateRange hook.
 */

"use client";

import { DateRangePicker } from "./date-range-picker";
import { useDateRange } from "@/hooks/use-date-range";

export function DateRangePickerExample() {
  // Initialize the hook with a preset (optional, defaults to "last30days")
  const { range, preset, setPreset, setCustomRange } = useDateRange("last30days");

  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="text-xl font-semibold">Date Range Picker Demo</h2>

      {/* The DateRangePicker component */}
      <DateRangePicker
        range={range}
        preset={preset}
        onPresetChange={setPreset}
        onCustomRangeChange={setCustomRange}
        className="w-full md:w-[300px]"
      />

      {/* Display selected range */}
      <div className="text-muted-foreground mt-4 rounded-lg border border-white/10 bg-card/50 p-4 backdrop-blur-xl">
        <p className="text-sm">
          <strong>Selected Preset:</strong> {preset}
        </p>
        <p className="text-sm">
          <strong>From:</strong> {range.from.toLocaleDateString()}
        </p>
        <p className="text-sm">
          <strong>To:</strong> {range.to.toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

/**
 * Integration Example for Dashboard Page
 *
 * import { useDateRange } from "@/hooks/use-date-range";
 * import { DateRangePicker } from "@/components/dashboard/date-range-picker";
 *
 * export function DashboardPage() {
 *   const { range, preset, setPreset, setCustomRange } = useDateRange("last30days");
 *
 *   // Use the range to filter data
 *   const filteredData = data.filter(item => {
 *     const itemDate = new Date(item.date);
 *     return itemDate >= range.from && itemDate <= range.to;
 *   });
 *
 *   return (
 *     <div>
 *       <DateRangePicker
 *         range={range}
 *         preset={preset}
 *         onPresetChange={setPreset}
 *         onCustomRangeChange={setCustomRange}
 *       />
 *
 *       <YourChartComponent data={filteredData} />
 *     </div>
 *   );
 * }
 */
