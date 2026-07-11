/**
 * Constrained visualization spec understood by the assistant UI. The model
 * emits these as fenced ```visualization``` JSON blocks inside its Markdown
 * response (see `buildSystemPrompt`); the rendering layer parses and renders
 * them. This module owns validation only — no styling, no callbacks, no
 * theme-aware fields. Rendering (colors, ECharts options, etc.) is entirely
 * the frontend's responsibility.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared data point schemas
// ---------------------------------------------------------------------------

const chartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  value2: z.number().optional(),
});

const pieDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
});

// ---------------------------------------------------------------------------
// Per-type specs
// ---------------------------------------------------------------------------

export const barChartSpecSchema = z.object({
  type: z.literal("bar"),
  title: z.string().optional(),
  data: z.array(chartDataPointSchema).max(60),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  stacked: z.boolean().optional(),
  seriesName: z.string().optional(),
  series2Name: z.string().optional(),
});

export const lineChartSpecSchema = z.object({
  type: z.literal("line"),
  title: z.string().optional(),
  data: z.array(chartDataPointSchema).max(120),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  stacked: z.boolean().optional(),
  seriesName: z.string().optional(),
  series2Name: z.string().optional(),
  smooth: z.boolean().optional(),
});

export const pieChartSpecSchema = z.object({
  type: z.literal("pie"),
  title: z.string().optional(),
  data: z.array(pieDataPointSchema).max(20),
});

export const statSpecSchema = z.object({
  type: z.literal("stat"),
  title: z.string(),
  value: z.string(),
  change: z.string().optional(),
  trend: z.enum(["up", "down", "neutral"]).optional(),
});

export const tableSpecSchema = z.object({
  type: z.literal("table"),
  title: z.string().optional(),
  columns: z.array(z.string()).max(8),
  rows: z.array(z.array(z.string())).max(50),
});

export const visualizationSpecSchema = z.discriminatedUnion("type", [
  barChartSpecSchema,
  lineChartSpecSchema,
  pieChartSpecSchema,
  statSpecSchema,
  tableSpecSchema,
]);

export type VisualizationSpec = z.infer<typeof visualizationSpecSchema>;

/**
 * Parses and validates a raw JSON string (typically the contents of a
 * ```visualization``` fenced block) into a `VisualizationSpec`. Returns
 * `null` on any parse or validation failure — callers should render a
 * graceful fallback rather than throw.
 */
export function parseVisualizationSpec(raw: string): VisualizationSpec | null {
  try {
    const json: unknown = JSON.parse(raw);
    const result = visualizationSpecSchema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
