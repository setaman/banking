import { tool } from "ai";
import { z } from "zod";

import {
  getAccounts,
  getActiveAccountIds,
  getLatestBalances,
} from "@/actions/accounts.actions";

import { round2 } from "./shared";

const paramsSchema = z.object({
  activeOnly: z
    .boolean()
    .optional()
    .describe(
      "If true, only return accounts considered active (not manually closed and not stale after a sync). Defaults to false, returning all accounts."
    ),
});

export interface AccountSummary {
  readonly name: string;
  readonly type: string;
  readonly currency: string;
  readonly balance: number;
  readonly status: "active" | "closed";
}

export interface GetAccountsResult {
  readonly accounts: readonly AccountSummary[];
}

export const getAccountsTool = tool({
  description:
    "Lists the user's bank accounts with type, currency, latest known balance, and status (active/closed). Amounts in EUR. Use this to answer questions about how many accounts the user has, or their individual balances/types. Never returns IBANs, account holder names, or internal IDs.",
  inputSchema: paramsSchema,
  execute: async ({ activeOnly }): Promise<GetAccountsResult> => {
    const [accounts, balances, activeIds] = await Promise.all([
      getAccounts(),
      getLatestBalances(),
      getActiveAccountIds(),
    ]);

    const filtered = activeOnly
      ? accounts.filter((account) => activeIds.has(account.id))
      : accounts;

    const result: AccountSummary[] = filtered.map((account) => ({
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: round2(balances.get(account.id)?.amount ?? 0),
      // Legacy records written before `status` existed lack the field at
      // runtime even though the schema declares a default — apply the same
      // default (`"active"`) here to keep output honest.
      status: account.status ?? "active",
    }));

    return { accounts: result };
  },
});
