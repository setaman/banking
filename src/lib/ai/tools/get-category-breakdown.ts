import { tool } from "ai";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { calculateTopCategories } from "@/lib/stats/calculations";

import { isoDateParam, round2 } from "./shared";

const paramsSchema = z.object({
  startDate: isoDateParam(
    "Inclusive start date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  endDate: isoDateParam(
    "Inclusive end date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(15)
    .optional()
    .describe(
      "Maximum number of categories to return, ranked by total spend descending. Defaults to 10, max 15."
    ),
});

export interface CategoryBreakdownEntry {
  readonly category: string;
  readonly amount: number;
  readonly percentage: number;
  readonly count: number;
}

export interface GetCategoryBreakdownResult {
  readonly categories: readonly CategoryBreakdownEntry[];
}

export const getCategoryBreakdownTool = tool({
  description:
    "Returns the top spending categories (e.g. Groceries, Rent, Dining) ranked by total amount spent, in EUR, with percentage share and transaction count. Use this to answer 'where does my money go' style questions.",
  inputSchema: paramsSchema,
  execute: async ({
    startDate,
    endDate,
    limit,
  }): Promise<GetCategoryBreakdownResult> => {
    const transactions = await getTransactions(
      { startDate, endDate },
      { excludeInternal: true }
    );

    const categories = calculateTopCategories(transactions, limit ?? 10).map(
      (entry) => ({
        category: entry.category,
        amount: round2(entry.amount),
        percentage: round2(entry.percentage),
        count: entry.count,
      })
    );

    return { categories };
  },
});
