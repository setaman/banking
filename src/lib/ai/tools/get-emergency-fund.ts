import { tool } from "ai";
import { z } from "zod";

import { getTotalBalance } from "@/actions/accounts.actions";
import { getTransactions } from "@/actions/transactions.actions";
import { calculateEmergencyFund } from "@/lib/stats/calculations";

import { round2 } from "./shared";

const paramsSchema = z.object({});

export interface GetEmergencyFundResult {
  readonly months: number;
  readonly totalBalance: number;
  readonly avgMonthlyExpenses: number;
}

export const getEmergencyFundTool = tool({
  description:
    "Returns emergency fund coverage: how many months of average expenses the current total balance (EUR) would cover. Use this to answer 'how long would my savings last' style questions. Takes no parameters (always uses the full transaction history and current total balance).",
  inputSchema: paramsSchema,
  execute: async (): Promise<GetEmergencyFundResult> => {
    const [totalBalance, transactions] = await Promise.all([
      getTotalBalance(),
      getTransactions(undefined, { excludeInternal: true }),
    ]);

    const result = calculateEmergencyFund(totalBalance, transactions);

    return {
      months: round2(result.months),
      totalBalance: round2(result.balance),
      avgMonthlyExpenses: round2(result.avgMonthlyExpenses),
    };
  },
});
