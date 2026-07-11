"use client";

import { Component, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ChevronDown, Table as TableIcon } from "lucide-react";

import type { VisualizationSpec } from "@/lib/ai/visualization";
import type {
  BarChartSpec,
  LineChartSpec,
  PieChartSpec,
} from "@/lib/ai/visualization-mapper";
import { cn } from "@/lib/utils";
import { BarChartView } from "@/components/assistant/charts/bar-chart-view";
import { LineChartView } from "@/components/assistant/charts/line-chart-view";
import { PieChartView } from "@/components/assistant/charts/pie-chart-view";
import { StatCard } from "@/components/assistant/charts/stat-card";
import {
  TableView,
  type TableSpec,
} from "@/components/assistant/charts/table-view";

// ---------------------------------------------------------------------------
// Fallback UI — shown by the error boundary when a spec's own chart type
// crashes mid-render. Per `docs/design/ai-assistant-ui.md` §5: "Never crash
// the message list because of a malformed chart spec."
// ---------------------------------------------------------------------------

function VisualizationRenderFallback(): React.JSX.Element {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>Could not render this chart.</span>
    </div>
  );
}

/** Last-resort rendering of the spec's raw data as a simple bulleted list. */
function DataAsList({ spec }: { spec: VisualizationSpec }): React.JSX.Element {
  let items: string[];

  switch (spec.type) {
    case "bar":
    case "line":
      items = spec.data.map((d) =>
        d.value2 !== undefined
          ? `${d.label}: ${d.value} / ${d.value2}`
          : `${d.label}: ${d.value}`
      );
      break;
    case "pie":
      items = spec.data.map((d) => `${d.label}: ${d.value}`);
      break;
    case "stat":
      items = [
        spec.change
          ? `${spec.title}: ${spec.value} (${spec.change})`
          : `${spec.title}: ${spec.value}`,
      ];
      break;
    case "table":
      items = spec.rows.map((row) => row.join(" · "));
      break;
    default:
      items = [];
  }

  return (
    <ul className="text-muted-foreground mt-2 list-disc space-y-0.5 pl-5 text-xs">
      {items.slice(0, 20).map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

interface VisualizationErrorBoundaryState {
  readonly hasError: boolean;
}

class VisualizationErrorBoundary extends Component<
  { spec: VisualizationSpec; children: ReactNode },
  VisualizationErrorBoundaryState
> {
  constructor(props: { spec: VisualizationSpec; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): VisualizationErrorBoundaryState {
    return { hasError: true };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div>
          <VisualizationRenderFallback />
          <DataAsList spec={this.props.spec} />
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// "View data" toggle — shown below every chart (bar/line/pie), flips between
// the chart and a compact raw-data table built from the same spec.
// ---------------------------------------------------------------------------

function buildDataTableSpec(
  spec: BarChartSpec | LineChartSpec | PieChartSpec
): TableSpec {
  if (spec.type === "pie") {
    return {
      type: "table",
      columns: ["Label", "Value"],
      rows: spec.data.map((d) => [d.label, String(d.value)]),
    };
  }

  const hasSeries2 = spec.data.some((d) => d.value2 !== undefined);
  const columns = hasSeries2
    ? ["Label", spec.seriesName ?? "Value", spec.series2Name ?? "Value 2"]
    : ["Label", spec.seriesName ?? "Value"];
  const rows = spec.data.map((d) =>
    hasSeries2
      ? [
          d.label,
          String(d.value),
          d.value2 !== undefined ? String(d.value2) : "",
        ]
      : [d.label, String(d.value)]
  );

  return { type: "table", columns, rows };
}

function ViewDataToggle({
  spec,
}: {
  spec: BarChartSpec | LineChartSpec | PieChartSpec;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const tableSpec = useMemo(() => buildDataTableSpec(spec), [spec]);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] transition-colors"
        aria-expanded={open}
      >
        <TableIcon className="h-3 w-3" />
        {open ? "Hide data" : "View data"}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2">
              <TableView spec={tableSpec} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const CHART_CONTAINER_CLASS = "h-[300px] min-h-[250px] max-h-[400px] w-full";

function VisualizationContent({
  spec,
}: {
  spec: VisualizationSpec;
}): React.JSX.Element {
  switch (spec.type) {
    case "bar":
      return (
        <div className="border-border mt-3 border-t pt-3">
          {spec.title && (
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              {spec.title}
            </p>
          )}
          <div
            className={CHART_CONTAINER_CLASS}
            aria-label={`Bar chart: ${spec.data.map((d) => `${d.label} ${d.value}`).join(", ")}`}
          >
            <BarChartView spec={spec} />
          </div>
          <ViewDataToggle spec={spec} />
        </div>
      );

    case "line":
      return (
        <div className="border-border mt-3 border-t pt-3">
          {spec.title && (
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              {spec.title}
            </p>
          )}
          <div
            className={CHART_CONTAINER_CLASS}
            aria-label={`Line chart: ${spec.data.map((d) => `${d.label} ${d.value}`).join(", ")}`}
          >
            <LineChartView spec={spec} />
          </div>
          <ViewDataToggle spec={spec} />
        </div>
      );

    case "pie":
      return (
        <div className="border-border mt-3 border-t pt-3">
          {spec.title && (
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              {spec.title}
            </p>
          )}
          <div
            className={CHART_CONTAINER_CLASS}
            aria-label={`Pie chart: ${spec.data.map((d) => `${d.label} ${d.value}`).join(", ")}`}
          >
            <PieChartView spec={spec} />
          </div>
          <ViewDataToggle spec={spec} />
        </div>
      );

    case "stat":
      return (
        <div className="mt-3">
          <StatCard spec={spec} />
        </div>
      );

    case "table":
      return (
        <div className="border-border mt-3 border-t pt-3">
          {spec.title && (
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              {spec.title}
            </p>
          )}
          <TableView spec={spec} />
        </div>
      );

    default: {
      // Exhaustiveness guard — if `VisualizationSpec` ever gains a 6th
      // member, this branch fails to compile until it's handled above.
      const _exhaustiveCheck: never = spec;
      void _exhaustiveCheck;
      return <VisualizationRenderFallback />;
    }
  }
}

interface VisualizationRendererProps {
  readonly spec: VisualizationSpec;
}

/**
 * Dispatches a validated `VisualizationSpec` to its themed chart/stat/table
 * renderer, wrapped in an error boundary (renders "Could not render this
 * chart" plus the raw data as a simple list on crash) and a fade-in entrance
 * matching `docs/design/ai-assistant-ui.md` §9's inline chart animation.
 */
export function VisualizationRenderer({
  spec,
}: VisualizationRendererProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <VisualizationErrorBoundary spec={spec}>
        <VisualizationContent spec={spec} />
      </VisualizationErrorBoundary>
    </motion.div>
  );
}
