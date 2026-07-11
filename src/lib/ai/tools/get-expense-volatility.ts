import { tool } from "ai";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { calculateExpenseVolatility } from "@/lib/stats/calculations";

import { isoDateParam, round2 } from "./shared";

const paramsSchema = z.object({
  startDate: isoDateParam(
    "Inclusive start date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  endDate: isoDateParam(
    "Inclusive end date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
});

export interface GetExpenseVolatilityResult {
  readonly standardDeviation: number;
  readonly mean: number;
  readonly coefficient: number;
}

export const getExpenseVolatilityTool = tool({
  description:
    "Measures how much monthly expenses fluctuate: standard deviation and mean of monthly expenses (EUR), and the coefficient of variation (standard deviation / mean — higher means less predictable spending). Use this to answer 'how consistent is my spending' style questions.",
  inputSchema: paramsSchema,
  execute: async ({
    startDate,
    endDate,
  }): Promise<GetExpenseVolatilityResult> => {
    const transactions = await getTransactions(
      { startDate, endDate },
      { excludeInternal: true }
    );

    const result = calculateExpenseVolatility(transactions);

    return {
      standardDeviation: round2(result.standardDeviation),
      mean: round2(result.mean),
      coefficient: round2(result.coefficient),
    };
  },
});
