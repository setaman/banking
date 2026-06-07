/**
 * What-If Financial Sandbox — simulation engine.
 *
 * Computes monthly balance projections for up to 10 years (120 points) given
 * a set of scenario rules layered on top of the historical baseline. The
 * baseline is derived from the same trailing-window logic used by
 * `calculateBalancePrediction` on the Insights page, so yearly marks are
 * consistent between the two features.
 *
 * This module is pure (no I/O, no DB access). All inputs are passed in.
 */

import { format } from "date-fns";

import {
  selectProjectionWindow,
  type MonthlyFlow,
} from "@/lib/stats/calculations";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single scenario rule that modifies the baseline projection.
 *
 * - `recurring`     — a fixed monthly cash-flow delta starting at `startMonthOffset`.
 * - `onetime`       — a lump-sum applied once at month `targetYear * 12`.
 * - `subscription`  — models cancelling a recurring expense; the matched
 *                     counterparty's `averageAmount` is added back (positive)
 *                     for every month as long as the rule is enabled.
 * - `investment`    — compound interest applied to the running balance each
 *                     month at `annualRate / 12`.
 */
export interface ScenarioRule {
  readonly id: string;
  readonly type: "recurring" | "onetime" | "subscription" | "investment";
  readonly name: string;
  readonly enabled: boolean;
  /** Signed monthly delta for `recurring`; lump-sum for `onetime`. */
  readonly amount: number;
  /** `recurring`: applies for months m >= startMonthOffset. Ignored for `onetime`. */
  readonly startMonthOffset: number;
  /** `onetime`: target month = targetYear * 12. Range 1..10. */
  readonly targetYear?: number;
  /** `investment`: annual rate 0..0.12. */
  readonly annualRate?: number;
  /** `subscription`: matched counterparty name — cost added back as positive delta. */
  readonly subscriptionName?: string;
}

/**
 * A single monthly data point produced by the sandbox engine.
 * Month 0 is the current balance (no projection); months 1..N are forward.
 */
export interface SandboxPoint {
  readonly month: number;
  /** Baseline projected balance (no scenario rules). */
  readonly baseline: number;
  /** Baseline minus one-sigma spread. */
  readonly baselineLower: number;
  /** Baseline plus one-sigma spread. */
  readonly baselineUpper: number;
  /** Scenario-adjusted running balance. */
  readonly scenario: number;
  /** Scenario balance minus one-sigma spread. */
  readonly scenarioLower: number;
  /** Scenario balance plus one-sigma spread. */
  readonly scenarioUpper: number;
}

export type SandboxResult =
  | {
      readonly status: "ok";
      readonly points: SandboxPoint[];
      readonly meanMonthlyNet: number;
      readonly stdDevMonthlyNet: number;
    }
  | {
      readonly status: "insufficient-data";
      readonly reason: string;
    };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Round a monetary value to the nearest cent. */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Compute the net recurring delta contributed by all enabled rules for a
 * given month index `m` (1-based).
 *
 * - `recurring` rules contribute `amount` when `m >= startMonthOffset`.
 * - `subscription` rules contribute `amount` (treated as positive) every month.
 * - `investment` rules contribute `amount` as a monthly deposit every month
 *   (the deposit is added to the running balance before interest compounds,
 *   so the yield then applies to the growing principal).
 * - `onetime` rules are NOT handled here (see `computeOneTimeDelta`).
 */
function computeRecurringDelta(
  rules: readonly ScenarioRule[],
  m: number
): number {
  let delta = 0;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (rule.type === "recurring" && m >= rule.startMonthOffset) {
      delta += rule.amount;
    }

    if (rule.type === "subscription") {
      // Cancelling a subscription removes an expense, adding the amount back.
      // `amount` should already be positive (absolute cost per month).
      delta += Math.abs(rule.amount);
    }

    if (rule.type === "investment") {
      // Monthly contribution — deposited every month regardless of start offset.
      // This grows the balance that `computeInterest` then compounds on.
      delta += rule.amount;
    }
  }

  return delta;
}

/**
 * Compute the interest earned in month `m` given the balance at the end of
 * the previous month `prevBalance`. Sums contributions from all enabled
 * investment rules.
 */
function computeInterest(
  rules: readonly ScenarioRule[],
  prevBalance: number
): number {
  let interest = 0;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.type !== "investment") continue;

    const annualRate = rule.annualRate ?? 0;
    interest += prevBalance * (annualRate / 12);
  }

  return interest;
}

/**
 * Compute the one-time lump-sum delta applied at exactly month `m`.
 * `targetYear` maps to month index `targetYear * 12`.
 */
function computeOneTimeDelta(
  rules: readonly ScenarioRule[],
  m: number
): number {
  let delta = 0;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.type !== "onetime") continue;

    const targetMonth = (rule.targetYear ?? 1) * 12;
    if (m === targetMonth) {
      delta += rule.amount;
    }
  }

  return delta;
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Computes a monthly sandbox projection for `years` years (default 10,
 * yielding 120 monthly points).
 *
 * The baseline uses the same mean/stdDev derivation as
 * `calculateBalancePrediction` so that the two are numerically consistent at
 * yearly marks. The scenario layer iterates month-by-month, accumulating rule
 * contributions on top of the baseline mean.
 *
 * @param totalBalance     Current total portfolio balance (from `getTotalBalance`).
 * @param monthlyCashFlow  Chronological monthly flow array (from `calculateMonthlyFlow`).
 * @param rules            Scenario rules to apply (may be empty — baseline only).
 * @param years            Projection horizon in years. Default 10 (120 monthly points).
 * @param currentMonth     Override for "now" in YYYY-MM format; defaults to today.
 * @returns                `SandboxResult` — either the projection data or an
 *                         insufficient-data indicator with a human-readable reason.
 */
export function calculateSandboxPrediction(
  totalBalance: number,
  monthlyCashFlow: readonly MonthlyFlow[],
  rules: readonly ScenarioRule[],
  years: number = 10,
  currentMonth?: string
): SandboxResult {
  const resolvedCurrentMonth =
    currentMonth ?? format(new Date(), "yyyy-MM");

  // Derive mean and stdDev using the shared window helper (same as Insights).
  const projectionWindow = selectProjectionWindow(
    monthlyCashFlow,
    resolvedCurrentMonth
  );

  if (projectionWindow === null) {
    return {
      status: "insufficient-data",
      reason:
        "At least 3 complete months of transaction history are required to run a projection. " +
        `Only ${
          monthlyCashFlow.filter((m) => m.month !== resolvedCurrentMonth).length
        } complete month(s) found.`,
    };
  }

  const { mean: meanMonthlyNet, stdDev: stdDevMonthlyNet } = projectionWindow;

  const totalMonths = years * 12;
  const points: SandboxPoint[] = [];

  // Scenario running balance — starts at the current total.
  let scenarioBalance = totalBalance;

  for (let m = 1; m <= totalMonths; m++) {
    // --- Baseline (no rules) ---
    const baseline = roundCents(totalBalance + meanMonthlyNet * m);
    const spread = roundCents(stdDevMonthlyNet * Math.sqrt(m));
    const baselineLower = roundCents(baseline - spread);
    const baselineUpper = roundCents(baseline + spread);

    // --- Scenario (iterative) ---
    const recurringDelta = computeRecurringDelta(rules, m);
    const interest = computeInterest(rules, scenarioBalance);
    const oneTimeDelta = computeOneTimeDelta(rules, m);

    const netForMonth = meanMonthlyNet + recurringDelta + interest + oneTimeDelta;
    // Keep full floating-point precision during accumulation to avoid
    // cent-rounding drift vs. the closed-form baseline. Round only on output.
    scenarioBalance = scenarioBalance + netForMonth;

    const scenarioRounded = roundCents(scenarioBalance);
    const scenarioLower = roundCents(scenarioBalance - spread);
    const scenarioUpper = roundCents(scenarioBalance + spread);

    points.push({
      month: m,
      baseline,
      baselineLower,
      baselineUpper,
      scenario: scenarioRounded,
      scenarioLower,
      scenarioUpper,
    });
  }

  return {
    status: "ok",
    points,
    meanMonthlyNet: roundCents(meanMonthlyNet),
    stdDevMonthlyNet: roundCents(stdDevMonthlyNet),
  };
}
