import { tool } from "ai";
import { z } from "zod";

import { getTotalBalance } from "@/actions/accounts.actions";

import { round2 } from "./shared";

const paramsSchema = z.object({});

export interface GetTotalBalanceResult {
  readonly totalBalance: number;
  readonly currency: "EUR";
}

export const getTotalBalanceTool = tool({
  description:
    "Returns the total balance across all active accounts, in EUR. Manually closed and stale (un-synced) accounts are excluded. Use this for 'how much money do I have in total' style questions. Takes no parameters.",
  inputSchema: paramsSchema,
  execute: async (): Promise<GetTotalBalanceResult> => {
    const totalBalance = await getTotalBalance();
    return { totalBalance: round2(totalBalance), currency: "EUR" };
  },
});
