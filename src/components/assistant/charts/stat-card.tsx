import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { VisualizationSpec } from "@/lib/ai/visualization";

export type StatSpec = Extract<VisualizationSpec, { type: "stat" }>;

interface StatCardProps {
  readonly spec: StatSpec;
}

/**
 * Renders a `stat` visualization spec as a compact inline card, matching the
 * dashboard `OverviewCards` look (title, value, trend arrow) but sized for
 * inline placement inside a chat bubble rather than a full grid card.
 * `value`/`change` are pre-formatted strings from the model (see
 * `visualization.ts`) — no EUR formatting happens here.
 */
export function StatCard({ spec }: StatCardProps): React.JSX.Element {
  const TrendIcon =
    spec.trend === "up"
      ? TrendingUp
      : spec.trend === "down"
        ? TrendingDown
        : Minus;

  const trendColor =
    spec.trend === "up"
      ? "text-emerald-500"
      : spec.trend === "down"
        ? "text-rose-500"
        : "text-muted-foreground";

  return (
    <div className="border-border bg-card dark:bg-card/80 flex items-center gap-4 rounded-xl border p-4 backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs font-medium">
          {spec.title}
        </p>
        <p className="text-foreground mt-0.5 text-2xl font-bold tabular-nums">
          {spec.value}
        </p>
      </div>
      {spec.change && (
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 text-sm font-medium",
            trendColor
          )}
        >
          <TrendIcon className="h-4 w-4 shrink-0" />
          <span className="tabular-nums">{spec.change}</span>
        </div>
      )}
    </div>
  );
}
