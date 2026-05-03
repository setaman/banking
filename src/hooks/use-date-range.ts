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

export type NavigationUnit = "week" | "month" | "year" | "days" | null;

export interface DateRangeState {
  range: DateRange;
  preset: DateRangePreset;
  navigationUnit: NavigationUnit;
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

const getNavigationUnit = (preset: DateRangePreset): NavigationUnit => {
  switch (preset) {
    case "last7days":
      return "week";
    case "last30days":
      return "days";
    case "thisMonth":
    case "lastMonth":
      return "month";
    case "thisYear":
    case "lastYear":
      return "year";
    case "allTime":
      return null;
    case "custom":
      return "days";
    default:
      return "days";
  }
};

export function useDateRange(initialPreset: DateRangePreset = "last30days") {
  const [state, setState] = useState<DateRangeState>({
    range: getPresetRange(initialPreset),
    preset: initialPreset,
    navigationUnit: getNavigationUnit(initialPreset),
  });

  const setPreset = useCallback((preset: DateRangePreset) => {
    setState({
      range: getPresetRange(preset),
      preset,
      navigationUnit: getNavigationUnit(preset),
    });
  }, []);

  const setCustomRange = useCallback((range: DateRange) => {
    setState((prev) => ({
      range,
      preset: "custom",
      // Preserve existing navigationUnit when called internally (e.g. allTime data span update)
      // but use "days" as default for user-initiated custom ranges
      navigationUnit:
        prev.preset === "allTime" ? null : (prev.navigationUnit ?? "days"),
    }));
  }, []);

  const setRange = useCallback((range: DateRange) => {
    setState((prev) => ({
      ...prev,
      range,
    }));
  }, []);

  const navigateRange = useCallback((direction: 1 | -1) => {
    setState((prev) => {
      if (prev.navigationUnit === null) return prev;

      const { from, to } = prev.range;
      let newFrom: Date;
      let newTo: Date;

      switch (prev.navigationUnit) {
        case "week":
          newFrom = addDays(from, direction * 7);
          newTo = addDays(to, direction * 7);
          break;
        case "days": {
          const durationDays = Math.max(1, differenceInDays(to, from));
          newFrom = addDays(from, direction * durationDays);
          newTo = addDays(to, direction * durationDays);
          break;
        }
        case "month": {
          const shiftedFrom =
            direction === 1 ? addMonths(from, 1) : subMonths(from, 1);
          newFrom = startOfMonth(shiftedFrom);
          newTo = endOfMonth(shiftedFrom);
          break;
        }
        case "year": {
          const shiftedFrom =
            direction === 1 ? addYears(from, 1) : subYears(from, 1);
          newFrom = startOfYear(shiftedFrom);
          newTo = endOfYear(shiftedFrom);
          break;
        }
        default: {
          const durationDays = Math.max(1, differenceInDays(to, from));
          newFrom = addDays(from, direction * durationDays);
          newTo = addDays(to, direction * durationDays);
          break;
        }
      }

      return {
        range: { from: newFrom, to: newTo },
        preset: "custom",
        // Keep navigationUnit unchanged so subsequent navigations stay consistent
        navigationUnit: prev.navigationUnit,
      };
    });
  }, []);

  const today = startOfDay(new Date());
  const canNavigateBack = state.navigationUnit !== null;
  const canNavigateForward =
    state.navigationUnit !== null &&
    !isAfter(state.range.to, today) &&
    !isSameDay(state.range.to, today);

  return {
    range: state.range,
    preset: state.preset,
    navigationUnit: state.navigationUnit,
    setPreset,
    setCustomRange,
    setRange,
    navigateRange,
    canNavigateForward,
    canNavigateBack,
  };
}
