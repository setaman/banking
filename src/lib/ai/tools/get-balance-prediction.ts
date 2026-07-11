import { tool } from "ai";
import { z } from "zod";

import { getTotalBalance } from "@/actions/accounts.actions";
import { getTransactions } from "@/actions/transactions.actions";
import {
  calculateBalancePrediction,
  calculateMonthlyFlow,
} from "@/lib/stats/calculations";

import { round2 } from "./shared";

const paramsSchema = z.object({
  years: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe(
      "Number of years to project forward, yearly data points. Defaults to 5, max 10."
    ),
});

export interface BalancePredictionPointDto {
  readonly year: number;
  readonly label: string;
  readonly projected: number;
  readonly upperBound: number;
  readonly lowerBound: number;
}

export type GetBalancePredictionResult =
  | {
      readonly available: true;
      readonly points: readonly BalancePredictionPointDto[];
      readonly yearsProjected: number;
      readonly monthsUsed: number;
      readonly meanMonthlyNet: number;
      readonly stdDevMonthlyNet: number;
      readonly confidence: "low" | "normal" | "volatile";
    }
  | {
      readonly available: false;
      readonly reason: "insufficient-history" | "no-data";
    };

export const getBalancePredictionTool = tool({
  description:
    "Projects the user's total balance (EUR) forward in yearly steps using historical monthly net cash flow, with uncertainty bounds. Requires at least 3 complete historical months; honestly reports when unavailable (e.g. 'insufficient-history' or 'no-data') rather than guessing. Use this for long-term forecasting questions.",
  inputSchema: paramsSchema,
  execute: async ({ years }): Promise<GetBalancePredictionResult> => {
    const [totalBalance, transactions] = await Promise.all([
      getTotalBalance(),
      getTransactions(undefined, { excludeInternal: true }),
    ]);

    const monthlyCashFlow = calculateMonthlyFlow(transactions);

    const result = calculateBalancePrediction({
      totalBalance,
      monthlyCashFlow,
      years: years ?? 5,
    });

    if (!result.available) {
      return { available: false, reason: result.reason };
    }

    return {
      available: true,
      points: result.prediction.points.map((point) => ({
        year: point.year,
        label: point.label,
        projected: round2(point.projected),
        upperBound: round2(point.upperBound),
        lowerBound: round2(point.lowerBound),
      })),
      yearsProjected: result.prediction.yearsProjected,
      monthsUsed: result.prediction.monthsUsed,
      meanMonthlyNet: round2(result.prediction.meanMonthlyNet),
      stdDevMonthlyNet: round2(result.prediction.stdDevMonthlyNet),
      confidence: result.prediction.confidence,
    };
  },
});
