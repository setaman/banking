import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { VisualizationSpec } from "@/lib/ai/visualization";

export type TableSpec = Extract<VisualizationSpec, { type: "table" }>;

const MAX_VISIBLE_ROWS = 20;

interface TableViewProps {
  readonly spec: TableSpec;
}

/**
 * Renders a `table` visualization spec (or the raw-data view of a chart
 * spec, via `visualization-renderer.tsx`'s "View data" toggle) as a
 * shadcn-styled table: sticky header, alternating row tint, capped at
 * `MAX_VISIBLE_ROWS` visible rows with a "Showing N of M" note when
 * truncated, inside a scrollable container.
 */
export function TableView({ spec }: TableViewProps): React.JSX.Element {
  const rows = spec.rows.slice(0, MAX_VISIBLE_ROWS);
  const truncated = spec.rows.length > MAX_VISIBLE_ROWS;

  return (
    <div>
      <div className="border-border max-h-[320px] overflow-x-auto overflow-y-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-card sticky top-0 z-10">
            <TableRow className="border-border hover:bg-transparent">
              {spec.columns.map((col, i) => (
                <TableHead
                  key={`${col}-${i}`}
                  className="bg-card text-muted-foreground sticky top-0 z-10 text-xs font-medium whitespace-nowrap"
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={i}
                className={cn("border-border", i % 2 === 1 && "bg-muted/20")}
              >
                {row.map((cell, j) => (
                  <TableCell key={j} className="py-2 text-sm whitespace-nowrap">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {truncated && (
        <p className="text-muted-foreground mt-1.5 text-[11px]">
          Showing {MAX_VISIBLE_ROWS} of {spec.rows.length} rows.
        </p>
      )}
    </div>
  );
}
