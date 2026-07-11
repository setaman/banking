import { DataTable } from "@/components/assistant/charts/data-table";
import type { VisualizationSpec } from "@/lib/ai/visualization";

export type TableSpec = Extract<VisualizationSpec, { type: "table" }>;

const MAX_VISIBLE_ROWS = 20;

interface TableViewProps {
  readonly spec: TableSpec;
}

/**
 * Renders a `table` visualization spec (or the raw-data view of a chart
 * spec, via `visualization-renderer.tsx`'s "View data" toggle) using the
 * shared `DataTable` shell: sticky header, alternating row tint, capped at
 * `MAX_VISIBLE_ROWS` visible rows with a "Showing N of M" note when
 * truncated, inside a scrollable container.
 */
export function TableView({ spec }: TableViewProps): React.JSX.Element {
  return (
    <DataTable
      columns={spec.columns}
      rows={spec.rows}
      maxVisibleRows={MAX_VISIBLE_ROWS}
      rowKeyPrefix="table-view"
    />
  );
}
