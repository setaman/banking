/**
 * BudgetSplitStrip — "Wants vs. Needs" Budget Allocation card for the Insights page.
 *
 * Renders a full-width glassmorphic card with:
 * - Three labeled figures (Needs / Wants / Saved) with percentage + EUR amount.
 * - A segmented progress bar whose widths animate to the three percentages.
 * - A coaching line comparing actuals to the 50/30/20 benchmark.
 * - An amber deficit banner when spending exceeds income.
 *
 * This is a presentational component; all computation is done by the parent page
 * via `calculateBudgetSplit` and passed in as `result`.
 */

import { Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BudgetSplitResult } from "@/lib/stats/calculations";

interface BudgetSplitStripProps {
  result: BudgetSplitResult;
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

/** Returns a short coaching note comparing actuals to the 50/30/20 ideal. */
function coachingNote(result: BudgetSplitResult): string {
  const { needsPercentage, wantsPercentage, savedPercentage, deficit } = result;

  if (deficit < 0) {
    return "You are spending more than you earn. Try to reduce discretionary spending to get back on track.";
  }

  const notes: string[] = [];

  if (needsPercentage > 55) {
    notes.push(
      `Your essential expenses (${needsPercentage.toFixed(0)}%) are above the 50% guideline — consider reviewing fixed costs.`
    );
  } else if (needsPercentage < 40) {
    notes.push(
      `Your essential expenses (${needsPercentage.toFixed(0)}%) are well below 50% — great budget flexibility.`
    );
  }

  if (wantsPercentage > 35) {
    notes.push(
      `You are spending more on wants (${wantsPercentage.toFixed(0)}%) than the 30% guideline.`
    );
  }

  if (savedPercentage >= 20) {
    notes.push(
      `You are saving ${savedPercentage.toFixed(0)}% — meeting or exceeding the 20% savings target.`
    );
  } else if (savedPercentage > 0) {
    notes.push(
      `You are saving ${savedPercentage.toFixed(0)}% — aim for 20% to hit the benchmark.`
    );
  }

  if (notes.length === 0) {
    return "Your spending is close to the 50/30/20 ideal. Keep it up!";
  }

  return notes[0];
}

export function BudgetSplitStrip({ result }: BudgetSplitStripProps) {
  const {
    needs,
    wants,
    saved,
    needsPercentage,
    wantsPercentage,
    savedPercentage,
    deficit,
  } = result;

  const hasDeficit = deficit < 0;

  return (
    <Card className="border-border relative overflow-hidden md:col-span-2">
      {/* Soft gradient overlay consistent with sibling Insights cards */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-pink-500/5 opacity-50" />

      <CardHeader className="relative z-10 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-violet-400" />
              Budget Allocation
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">50/30/20 Rule</p>
          </div>

          {/* Three labeled figures */}
          <div className="flex flex-wrap gap-6 text-right sm:gap-10">
            {/* Needs */}
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Needs
              </p>
              <p className="text-lg font-bold text-violet-500 dark:text-violet-400">
                {needsPercentage.toFixed(0)}%
              </p>
              <p className="text-muted-foreground text-xs">
                {formatCurrency(needs)}
              </p>
            </div>

            {/* Wants */}
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Wants
              </p>
              <p className="text-lg font-bold text-pink-500 dark:text-pink-400">
                {wantsPercentage.toFixed(0)}%
              </p>
              <p className="text-muted-foreground text-xs">
                {formatCurrency(wants)}
              </p>
            </div>

            {/* Saved */}
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Saved
              </p>
              <p
                className={cn(
                  "text-lg font-bold",
                  hasDeficit
                    ? "text-amber-500 dark:text-amber-400"
                    : "text-emerald-500 dark:text-emerald-400"
                )}
              >
                {savedPercentage.toFixed(0)}%
              </p>
              <p className="text-muted-foreground text-xs">
                {formatCurrency(saved)}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-4">
        {/* Deficit warning banner */}
        {hasDeficit && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              You spent more than you earned this period (
              {formatCurrency(deficit)}).
            </span>
          </div>
        )}

        {/* Segmented bar */}
        <div
          className="flex h-4 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(
            needsPercentage + wantsPercentage + savedPercentage
          )}
          aria-label={`Budget allocation: ${needsPercentage.toFixed(0)}% needs, ${wantsPercentage.toFixed(0)}% wants, ${savedPercentage.toFixed(0)}% saved`}
        >
          {/* Needs segment — violet-blue */}
          {needsPercentage > 0 && (
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 shadow-[0_0_8px_rgba(139,92,246,0.5)] transition-[width] duration-500 ease-out"
              style={{ width: `${needsPercentage}%` }}
            />
          )}

          {/* Wants segment — pink/magenta */}
          {wantsPercentage > 0 && (
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-fuchsia-500 shadow-[0_0_8px_rgba(236,72,153,0.5)] transition-[width] duration-500 ease-out"
              style={{ width: `${wantsPercentage}%` }}
            />
          )}

          {/* Saved segment — emerald/teal; hidden in deficit state */}
          {!hasDeficit && savedPercentage > 0 && (
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-[width] duration-500 ease-out"
              style={{ width: `${savedPercentage}%` }}
            />
          )}
        </div>

        {/* Benchmark + dynamic coaching line */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            Ideal is{" "}
            <span className="font-medium text-violet-500 dark:text-violet-400">
              50% Needs
            </span>{" "}
            /{" "}
            <span className="font-medium text-pink-500 dark:text-pink-400">
              30% Wants
            </span>{" "}
            /{" "}
            <span className="font-medium text-emerald-500 dark:text-emerald-400">
              20% Saved
            </span>
            .
          </p>
          <p className="text-muted-foreground/80 text-xs italic">
            {coachingNote(result)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
