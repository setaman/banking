import { tool } from "ai";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { calculateIncomeStability } from "@/lib/stats/calculations";

import { isoDateParam, round2 } from "./shared";

const paramsSchema = z.object({
  startDate: isoDateParam(
    "Inclusive start date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  endDate: isoDateParam(
    "Inclusive end date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
});

export interface GetIncomeStabilityResult {
  readonly standardDeviation: number;
  readonly mean: number;
  readonly coefficient: number;
}

export const getIncomeStabilityTool = tool({
  description:
    "Measures how much monthly income fluctuates: standard deviation and mean of monthly income (EUR), and the coefficient of variation (standard deviation / mean — higher means less predictable income). Use this to answer 'how stable is my income' style questions.",
  inputSchema: paramsSchema,
  execute: async ({
    startDate,
    endDate,
  }): Promise<GetIncomeStabilityResult> => {
    const transactions = await getTransactions(
      { startDate, endDate },
      { excludeInternal: true }
    );

    const result = calculateIncomeStability(transactions);

    return {
      standardDeviation: round2(result.standardDeviation),
      mean: round2(result.mean),
      coefficient: round2(result.coefficient),
    };
  },
});
