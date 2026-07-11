import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Shared, theme-aware data table shell used by both the `table` visualization
 * spec (`table-view.tsx`) and the GFM Markdown table renderer
 * (`chat-message.tsx`'s `MarkdownLite`). Kept generic over `ReactNode` cells
 * (rather than plain strings) so callers can pass either raw spec strings or
 * inline-formatted Markdown (bold/inline code) as cell content, while both
 * consumers share the exact same sticky-header / alternating-row / bordered
 * / scrollable styling.
 */

export type ColumnAlign = "left" | "center" | "right";

const ALIGN_CLASS: Record<ColumnAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export interface DataTableProps {
  readonly columns: readonly ReactNode[];
  readonly rows: readonly (readonly ReactNode[])[];
  /** Per-column alignment, e.g. derived from a GFM table's separator row. */
  readonly aligns?: readonly (ColumnAlign | null)[];
  /** Caps the number of rendered rows, showing a "Showing N of M" note. */
  readonly maxVisibleRows?: number;
  readonly rowKeyPrefix?: string;
}

export function DataTable({
  columns,
  rows,
  aligns,
  maxVisibleRows,
  rowKeyPrefix = "row",
}: DataTableProps): React.JSX.Element {
  const visibleRows =
    maxVisibleRows !== undefined ? rows.slice(0, maxVisibleRows) : rows;
  const truncated =
    maxVisibleRows !== undefined && rows.length > maxVisibleRows;

  return (
    <div>
      <div className="border-border max-h-[320px] overflow-x-auto overflow-y-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-card sticky top-0 z-10">
            <TableRow className="border-border hover:bg-transparent">
              {columns.map((col, i) => (
                <TableHead
                  key={`${rowKeyPrefix}-col-${i}`}
                  className={cn(
                    "bg-card text-muted-foreground sticky top-0 z-10 text-xs font-medium whitespace-nowrap",
                    aligns?.[i] && ALIGN_CLASS[aligns[i] as ColumnAlign]
                  )}
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, i) => (
              <TableRow
                key={`${rowKeyPrefix}-${i}`}
                className={cn("border-border", i % 2 === 1 && "bg-muted/20")}
              >
                {row.map((cell, j) => (
                  <TableCell
                    key={j}
                    className={cn(
                      "py-2 text-sm whitespace-nowrap",
                      aligns?.[j] && ALIGN_CLASS[aligns[j] as ColumnAlign]
                    )}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {truncated && maxVisibleRows !== undefined && (
        <p className="text-muted-foreground mt-1.5 text-[11px]">
          Showing {maxVisibleRows} of {rows.length} rows.
        </p>
      )}
    </div>
  );
}
