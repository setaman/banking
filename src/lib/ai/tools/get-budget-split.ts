import { tool } from "ai";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import {
  calculateBudgetSplit,
  NEEDS_CATEGORIES,
  WANTS_CATEGORIES,
} from "@/lib/stats/calculations";

import { isoDateParam, round2 } from "./shared";

/**
 * Category names used in the tool description below, derived directly
 * from `NEEDS_CATEGORIES` / `WANTS_CATEGORIES` in `calculations.ts` (the
 * actual runtime source of truth used by `calculateBudgetSplit`) so the
 * description can never drift out of sync with the real classification
 * logic again.
 */
const NEEDS_CATEGORY_NAMES = Array.from(NEEDS_CATEGORIES, (c) =>
  c.toLowerCase()
);
const WANTS_CATEGORY_NAMES = Array.from(WANTS_CATEGORIES, (c) =>
  c.toLowerCase()
);

const paramsSchema = z.object({
  startDate: isoDateParam(
    "Inclusive start date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  endDate: isoDateParam(
    "Inclusive end date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
});

export interface GetBudgetSplitResult {
  readonly needs: number;
  readonly wants: number;
  readonly saved: number;
  readonly needsPercentage: number;
  readonly wantsPercentage: number;
  readonly savedPercentage: number;
  readonly deficit: number;
}

export const getBudgetSplitTool = tool({
  description:
    `Splits spending into Needs (${NEEDS_CATEGORY_NAMES.join(", ")}), ` +
    `Wants (${WANTS_CATEGORY_NAMES.join(", ")}), and Saved, following the ` +
    "50/30/20 budgeting framework. Amounts in EUR. If spending exceeds " +
    "income, `saved` is 0 and the shortfall is returned as a negative " +
    "`deficit` (0 when not in deficit). Use this for budgeting/" +
    "affordability questions.",
  inputSchema: paramsSchema,
  execute: async ({ startDate, endDate }): Promise<GetBudgetSplitResult> => {
    const transactions = await getTransactions(
      { startDate, endDate },
      { excludeInternal: true }
    );

    const result = calculateBudgetSplit(transactions);

    return {
      needs: round2(result.needs),
      wants: round2(result.wants),
      saved: round2(result.saved),
      needsPercentage: round2(result.needsPercentage),
      wantsPercentage: round2(result.wantsPercentage),
      savedPercentage: round2(result.savedPercentage),
      deficit: round2(result.deficit),
    };
  },
});
