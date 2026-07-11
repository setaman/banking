/**
 * Internal helpers shared by the finance tool layer (`src/lib/ai/tools/*`).
 *
 * Not part of the public tool surface — never exported via `./index`.
 */
import { z } from "zod";

/** Rounds a number to 2 decimal places (cents). Safe for repeated application. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Builds a Zod schema for a single `YYYY-MM-DD` date string parameter with a
 * tool-specific description. Used for all optional/required date inputs so
 * every tool validates dates identically.
 */
export function isoDateParam(description: string): z.ZodString {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .describe(description);
}

/**
 * Computes a percentage change from `from` to `to`.
 * Returns `null` when `from` is 0 and `to` is non-zero (undefined percentage
 * change from a zero base) — honest rather than returning `Infinity`.
 * Returns `0` when both values are 0.
 */
export function percentChange(from: number, to: number): number | null {
  if (from === 0) {
    return to === 0 ? 0 : null;
  }
  return round2(((to - from) / Math.abs(from)) * 100);
}
