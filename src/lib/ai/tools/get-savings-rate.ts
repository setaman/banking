import { tool } from "ai";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { calculateSavingsRate } from "@/lib/stats/calculations";

import { isoDateParam, round2 } from "./shared";

const paramsSchema = z.object({
  startDate: isoDateParam(
    "Inclusive start date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  endDate: isoDateParam(
    "Inclusive end date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
});

export interface GetSavingsRateResult {
  readonly rate: number; // percentage, 0-100
  readonly income: number;
  readonly expenses: number;
}

export const getSavingsRateTool = tool({
  description:
    "Returns the savings rate ((income - expenses) / income * 100) for a period, along with the underlying income and expense totals in EUR. Use this to answer 'how much am I saving' style questions.",
  inputSchema: paramsSchema,
  execute: async ({ startDate, endDate }): Promise<GetSavingsRateResult> => {
    const transactions = await getTransactions(
      { startDate, endDate },
      { excludeInternal: true }
    );

    const result = calculateSavingsRate(transactions);

    return {
      rate: round2(result.rate),
      income: round2(result.income),
      expenses: round2(result.expenses),
    };
  },
});
