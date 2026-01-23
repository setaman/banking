import type {
  BankAdapter,
  BankCredentials,
  UnifiedAccount,
  UnifiedBalance,
  UnifiedTransaction,
} from "@/lib/banking/types";

/**
 * DKB Bank Adapter
 *
 * Implements the unified BankAdapter interface for DKB (Deutsche Kreditbank).
 * API endpoint details and response mapping will be added once the
 * DKB API specification is provided.
 */
export const dkbAdapter: BankAdapter = {
  institutionId: "dkb",
  institutionName: "Deutsche Kreditbank (DKB)",

  async fetchAccounts(
    credentials: BankCredentials,
  ): Promise<UnifiedAccount[]> {
    // TODO: Implement when DKB API spec is provided
    // Will call DKB accounts endpoint and map through dkb/mapper.ts
    throw new Error(
      "DKB adapter not yet configured. Provide API spec in banking.config.json",
    );
  },

  async fetchTransactions(
    accountId: string,
    credentials: BankCredentials,
    since?: Date,
  ): Promise<UnifiedTransaction[]> {
    // TODO: Implement when DKB API spec is provided
    throw new Error(
      "DKB adapter not yet configured. Provide API spec in banking.config.json",
    );
  },

  async fetchBalances(
    accountId: string,
    credentials: BankCredentials,
  ): Promise<UnifiedBalance> {
    // TODO: Implement when DKB API spec is provided
    throw new Error(
      "DKB adapter not yet configured. Provide API spec in banking.config.json",
    );
  },
};
