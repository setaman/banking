"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type DateRange, type DateRangePreset } from "@/hooks/use-date-range";

const MotionButton = motion.create(Button);

interface DateRangePickerProps {
  range: DateRange;
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomRangeChange: (range: DateRange) => void;
  className?: string;
}

const presets: Array<{ label: string; value: DateRangePreset }> = [
  { label: "Last 7 days", value: "last7days" },
  { label: "Last 30 days", value: "last30days" },
  { label: "This Month", value: "thisMonth" },
  { label: "Last Month", value: "lastMonth" },
  { label: "This Year", value: "thisYear" },
  { label: "Last Year", value: "lastYear" },
  { label: "All Time", value: "allTime" },
];

export function DateRangePicker({
  range,
  preset,
  onPresetChange,
  onCustomRangeChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempRange, setTempRange] = React.useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: range.from,
    to: range.to,
  });

  // Format display text based on preset or custom range
  const displayText = React.useMemo(() => {
    if (preset === "custom") {
      return `${format(range.from, "MMM dd, yyyy")} - ${format(range.to, "MMM dd, yyyy")}`;
    }
    const presetLabel = presets.find((p) => p.value === preset)?.label;
    return presetLabel || "Select date range";
  }, [range, preset]);

  const handlePresetClick = (presetValue: DateRangePreset) => {
    onPresetChange(presetValue);
    setIsOpen(false);
  };

  const handleCalendarSelect = (selected: {
    from: Date | undefined;
    to: Date | undefined;
  }) => {
    setTempRange(selected);

    // Only apply if both dates are selected
    if (selected.from && selected.to) {
      onCustomRangeChange({
        from: selected.from,
        to: selected.to,
      });
      // Keep popover open to allow further adjustments
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            "bg-card/50 backdrop-blur-xl border-white/10 dark:border-white/5",
            "hover:bg-card/70 hover:border-primary/20",
            "transition-all duration-200",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-auto p-0",
          "bg-card/95 backdrop-blur-xl border-white/10 dark:border-white/5",
          "shadow-xl shadow-primary/5"
        )}
        align="start"
      >
        <div className="flex flex-col gap-2 p-3 md:flex-row">
          {/* Preset Buttons */}
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium uppercase tracking-wide">
              Quick Select
            </div>
            {presets.map((presetItem, index) => (
              <MotionButton
                key={presetItem.value}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                variant="ghost"
                size="sm"
                onClick={() => handlePresetClick(presetItem.value)}
                className={cn(
                  "justify-start font-normal",
                  preset === presetItem.value &&
                    "bg-primary/10 text-primary font-medium",
                  "hover:bg-accent/50 dark:hover:bg-accent/30",
                  "transition-all duration-150"
                )}
              >
                {presetItem.label}
              </MotionButton>
            ))}
          </div>

          {/* Calendar */}
          <div className="border-t pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0">
            <div className="text-muted-foreground mb-2 px-2 text-xs font-medium uppercase tracking-wide">
              Custom Range
            </div>
            <Calendar
              mode="range"
              defaultMonth={range.from}
              selected={{
                from: tempRange.from,
                to: tempRange.to,
              }}
              onSelect={(selected) => {
                if (selected) {
                  handleCalendarSelect({
                    from: selected.from,
                    to: selected.to,
                  });
                }
              }}
              numberOfMonths={2}
              className="rounded-md"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
