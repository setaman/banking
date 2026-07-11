import { tool } from "ai";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { calculateMonthlyFlow } from "@/lib/stats/calculations";

import { isoDateParam, round2 } from "./shared";

const paramsSchema = z.object({
  startDate: isoDateParam(
    "Inclusive start date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  endDate: isoDateParam(
    "Inclusive end date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  accountId: z
    .string()
    .describe(
      "Restrict to a single account's internal ID (as returned by get_accounts, if exposed). Omit to include all accounts."
    )
    .optional(),
});

export interface MonthlyCashFlowEntry {
  readonly month: string; // YYYY-MM
  readonly income: number;
  readonly expenses: number;
  readonly net: number;
}

export interface GetMonthlyCashFlowResult {
  readonly months: readonly MonthlyCashFlowEntry[];
}

export const getMonthlyCashFlowTool = tool({
  description:
    "Returns income, expenses, and net cash flow grouped by calendar month (YYYY-MM), in EUR. Internal transfers between the user's own accounts are excluded. Use this to answer questions about spending/income trends over time.",
  inputSchema: paramsSchema,
  execute: async ({
    startDate,
    endDate,
    accountId,
  }): Promise<GetMonthlyCashFlowResult> => {
    const transactions = await getTransactions(
      { startDate, endDate, accountId },
      { excludeInternal: true }
    );

    const months = calculateMonthlyFlow(transactions).map((entry) => ({
      month: entry.month,
      income: round2(entry.income),
      expenses: round2(entry.expenses),
      net: round2(entry.net),
    }));

    return { months };
  },
});
