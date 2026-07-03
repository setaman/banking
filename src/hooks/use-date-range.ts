"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  | "last3months"
  | "last6months"
  | "last12months"
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
    case "last3months":
      return { from: subMonths(now, 3), to: now };
    case "last6months":
      return { from: subMonths(now, 6), to: now };
    case "last12months":
      return { from: subMonths(now, 12), to: now };
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

// ---------------------------------------------------------------------------
// Session persistence
//
// The dashboard's selected date range should survive client-side navigation
// away from and back to the dashboard (e.g. visiting Transactions, Insights,
// Settings) within the same browser session, but must NOT survive closing
// and reopening the app — so `sessionStorage` is used rather than
// `localStorage`. Access is guarded for SSR (Next.js renders this hook's
// initial state on the server first) following the same lazy-`useState`
// pattern used by `useScenarios` (see `src/hooks/use-scenarios.ts`).
// ---------------------------------------------------------------------------

const STORAGE_KEY = "banking:dashboard:date-range:v1";

const ALL_PRESETS: readonly DateRangePreset[] = [
  "last7days",
  "last30days",
  "thisMonth",
  "lastMonth",
  "last3months",
  "last6months",
  "last12months",
  "thisYear",
  "lastYear",
  "allTime",
  "custom",
];

const ALL_NAVIGATION_UNITS: readonly NavigationUnit[] = [
  "week",
  "month",
  "year",
  "days",
  null,
];

interface StoredDateRangeSelection {
  preset: DateRangePreset;
  navigationUnit: NavigationUnit;
  fromISO: string;
  toISO: string;
}

function isDateRangePreset(value: unknown): value is DateRangePreset {
  return (
    typeof value === "string" &&
    (ALL_PRESETS as readonly string[]).includes(value)
  );
}

function isNavigationUnit(value: unknown): value is NavigationUnit {
  return (ALL_NAVIGATION_UNITS as readonly unknown[]).includes(value);
}

/**
 * Attempts to read and validate the persisted selection from
 * `sessionStorage`. Returns `null` on the server, when the key is absent, or
 * when the stored value fails validation — callers should fall back to the
 * default preset in that case.
 */
function loadPersistedSelection(): StoredDateRangeSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { preset, navigationUnit, fromISO, toISO } = parsed as Record<
      string,
      unknown
    >;

    if (!isDateRangePreset(preset)) return null;
    if (!isNavigationUnit(navigationUnit)) return null;
    if (typeof fromISO !== "string" || typeof toISO !== "string") return null;

    const from = new Date(fromISO);
    const to = new Date(toISO);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return null;
    }
    if (isAfter(from, to)) return null;

    return { preset, navigationUnit, fromISO, toISO };
  } catch {
    return null;
  }
}

/** Persists the current selection to `sessionStorage`. Fails silently. */
function savePersistedSelection(state: DateRangeState): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredDateRangeSelection = {
      preset: state.preset,
      navigationUnit: state.navigationUnit,
      fromISO: state.range.from.toISOString(),
      toISO: state.range.to.toISOString(),
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Intentionally silent (quota exceeded or storage disabled).
  }
}

/**
 * Lazy initialiser for the `state` useState call. Runs once on the client
 * and restores a previously persisted selection when one exists and passes
 * validation. Non-custom presets are recomputed relative to "now" rather
 * than replayed from stored timestamps, so a preset like "This Month"
 * behaves like a proper preset (not a stale custom range) if the session
 * happens to span a day boundary.
 */
function buildInitialState(defaultPreset: DateRangePreset): DateRangeState {
  const persisted = loadPersistedSelection();

  if (persisted) {
    if (persisted.preset === "custom") {
      return {
        range: {
          from: new Date(persisted.fromISO),
          to: new Date(persisted.toISO),
        },
        preset: "custom",
        navigationUnit: persisted.navigationUnit,
      };
    }
    return {
      range: getPresetRange(persisted.preset),
      preset: persisted.preset,
      navigationUnit: getNavigationUnit(persisted.preset),
    };
  }

  return {
    range: getPresetRange(defaultPreset),
    preset: defaultPreset,
    navigationUnit: getNavigationUnit(defaultPreset),
  };
}

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

export function useDateRange(initialPreset: DateRangePreset = "thisMonth") {
  // Lazy initialiser restores a persisted selection from sessionStorage on
  // the client (falls back to `initialPreset` on the server and when no
  // valid persisted selection exists).
  const [state, setState] = useState<DateRangeState>(() =>
    buildInitialState(initialPreset)
  );

  // Persist every committed selection change, skipping the mount so we
  // don't re-write back the value we just read.
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    savePersistedSelection(state);
  }, [state]);

  const setPreset = useCallback((preset: DateRangePreset) => {
    setState({
      range: getPresetRange(preset),
      preset,
      navigationUnit: getNavigationUnit(preset),
    });
  }, []);

  const setCustomRange = useCallback(
    (range: DateRange, isUserInitiated: boolean = true) => {
      setState((prev) => ({
        range,
        preset: "custom",
        // When called programmatically (e.g. allTime data-span update) preserve the
        // current navigationUnit so navigation arrows keep working as expected.
        // When triggered by the user picking a calendar range, default to "days".
        navigationUnit: isUserInitiated
          ? "days"
          : (prev.navigationUnit ?? "days"),
      }));
    },
    []
  );

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
