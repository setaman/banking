import { Progress } from "@/components/ui/progress";
import type { BudgetStatus } from "@/lib/stats/budgets";
import { cn } from "@/lib/utils";

/** Tailwind classes for the indicator colour per budget status. */
export const BUDGET_STATUS_BAR_CLASS: Record<BudgetStatus, string> = {
  ok: "[&>[data-slot=progress-indicator]]:bg-emerald-500",
  warning: "[&>[data-slot=progress-indicator]]:bg-amber-500",
  over: "[&>[data-slot=progress-indicator]]:bg-red-500",
};

interface BudgetProgressBarProps {
  /** Percent of the limit used (may exceed 100; the bar is capped). */
  percentUsed: number;
  status: BudgetStatus;
  /** Projected month-end spending as percent of the limit. */
  projectedPercent?: number;
  /** Accessible label, e.g. "Groceries budget usage". */
  label: string;
  className?: string;
}

/**
 * Status-coloured budget progress bar. The fill is capped at 100%; a thin
 * marker shows the projected month-end position when it is ahead of the
 * current spending and still within the bar.
 */
export function BudgetProgressBar({
  percentUsed,
  status,
  projectedPercent,
  label,
  className,
}: BudgetProgressBarProps) {
  const fill = Math.min(100, Math.max(0, percentUsed));
  const showMarker =
    projectedPercent !== undefined &&
    projectedPercent > percentUsed &&
    projectedPercent < 100;

  return (
    <div className={cn("relative", className)}>
      <Progress
        value={fill}
        aria-label={label}
        className={cn("bg-foreground/10", BUDGET_STATUS_BAR_CLASS[status])}
      />
      {showMarker && (
        <span
          aria-hidden
          title="Projected month-end"
          className="bg-foreground/70 absolute -top-0.5 h-3 w-0.5 rounded-full"
          style={{ left: `${projectedPercent}%` }}
        />
      )}
    </div>
  );
}
