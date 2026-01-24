"use client";

import { useState, useCallback } from "react";
import {
  subDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
} from "date-fns";

export type DateRange = {
  from: Date;
  to: Date;
};

export type DateRangePreset =
  | "last7days"
  | "last30days"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear"
  | "allTime"
  | "custom";

export interface DateRangeState {
  range: DateRange;
  preset: DateRangePreset;
}

const getPresetRange = (preset: DateRangePreset): DateRange => {
  const now = new Date();

  switch (preset) {
    case "last7days":
      return { from: subDays(now, 7), to: now };
    case "last30days":
      return { from: subDays(now, 30), to: now };
    case "thisMonth":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "lastMonth": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case "thisYear":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "lastYear": {
      const lastYear = subYears(now, 1);
      return { from: startOfYear(lastYear), to: endOfYear(lastYear) };
    }
    case "allTime":
      // Default to last 2 years for "all time" to keep it reasonable
      return { from: subYears(now, 2), to: now };
    default:
      return { from: subDays(now, 30), to: now };
  }
};

export function useDateRange(initialPreset: DateRangePreset = "last30days") {
  const [state, setState] = useState<DateRangeState>({
    range: getPresetRange(initialPreset),
    preset: initialPreset,
  });

  const setPreset = useCallback((preset: DateRangePreset) => {
    setState({
      range: getPresetRange(preset),
      preset,
    });
  }, []);

  const setCustomRange = useCallback((range: DateRange) => {
    setState({
      range,
      preset: "custom",
    });
  }, []);

  const setRange = useCallback((range: DateRange) => {
    setState((prev) => ({
      ...prev,
      range,
    }));
  }, []);

  return {
    range: state.range,
    preset: state.preset,
    setPreset,
    setCustomRange,
    setRange,
  };
}
