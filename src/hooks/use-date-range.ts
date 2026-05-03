"use client";

import { useState, useCallback } from "react";
import {
  subDays,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  addMonths,
  subYears,
  addYears,
  differenceInDays,
  startOfDay,
  isAfter,
  isSameDay,
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

  const navigateRange = useCallback((direction: 1 | -1) => {
    setState((prev) => {
      if (prev.preset === "allTime") return prev;

      const { from, to } = prev.range;
      let newFrom: Date;
      let newTo: Date;

      switch (prev.preset) {
        case "last7days":
          newFrom = addDays(from, direction * 7);
          newTo = addDays(to, direction * 7);
          break;
        case "last30days":
          newFrom = addDays(from, direction * 30);
          newTo = addDays(to, direction * 30);
          break;
        case "thisMonth":
        case "lastMonth": {
          const shiftedFrom =
            direction === 1 ? addMonths(from, 1) : subMonths(from, 1);
          const shiftedTo =
            direction === 1 ? addMonths(to, 1) : subMonths(to, 1);
          newFrom = startOfMonth(shiftedFrom);
          newTo = endOfMonth(shiftedTo);
          break;
        }
        case "thisYear":
        case "lastYear": {
          const shiftedFrom =
            direction === 1 ? addYears(from, 1) : subYears(from, 1);
          const shiftedTo = direction === 1 ? addYears(to, 1) : subYears(to, 1);
          newFrom = startOfYear(shiftedFrom);
          newTo = endOfYear(shiftedTo);
          break;
        }
        default: {
          // custom: shift by the range's own duration
          const durationDays = differenceInDays(to, from);
          newFrom = addDays(from, direction * durationDays);
          newTo = addDays(to, direction * durationDays);
          break;
        }
      }

      return {
        range: { from: newFrom, to: newTo },
        preset: "custom",
      };
    });
  }, []);

  const today = startOfDay(new Date());
  const canNavigateBack = state.preset !== "allTime";
  const canNavigateForward =
    state.preset !== "allTime" &&
    !isAfter(state.range.to, today) &&
    !isSameDay(state.range.to, today);

  return {
    range: state.range,
    preset: state.preset,
    setPreset,
    setCustomRange,
    setRange,
    navigateRange,
    canNavigateForward,
    canNavigateBack,
  };
}
