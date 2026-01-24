import type {
  BankAdapter,
  BankCredentials,
  UnifiedAccount,
  UnifiedBalance,
  UnifiedTransaction,
} from "@/lib/banking/types";
import { fetchDkbAccounts, fetchDkbTransactions } from "./api";
import { mapDkbAccount, mapDkbTransaction, mapDkbBalance } from "./mapper";

/**
 * DKB Bank Adapter
 *
 * Implements the unified BankAdapter interface for DKB (Deutsche Kreditbank).
 * Fetches accounts and transactions from the DKB Banking API and maps them
 * to the unified banking data format.
 *
 * Requires valid DKB session credentials (cookie + CSRF token) from the
 * DKB webapp.
 */
export const dkbAdapter: BankAdapter = {
  institutionId: "dkb",
  institutionName: "Deutsche Kreditbank (DKB)",

  async fetchAccounts(
    credentials: BankCredentials,
  ): Promise<UnifiedAccount[]> {
    const dkbAccounts = await fetchDkbAccounts(credentials);
    return dkbAccounts.map(mapDkbAccount);
  },

  async fetchTransactions(
    accountId: string,
    credentials: BankCredentials,
    since?: Date,
  ): Promise<UnifiedTransaction[]> {
    // Extract the DKB account ID from our unified ID format (dkb_UUID)
    const externalAccountId = accountId.startsWith("dkb_")
      ? accountId.slice(4)
      : accountId;

    const dkbTransactions = await fetchDkbTransactions(
      externalAccountId,
      credentials,
    );

    // Map all transactions to unified format
    const mappedTransactions = dkbTransactions.map((tx) =>
      mapDkbTransaction(tx, accountId),
    );

    // Filter by 'since' date if provided (compare against bookingDate or fallback to date)
    if (since) {
      return mappedTransactions.filter((tx) => {
        const dateStr = tx.bookingDate || tx.date;
        const txDate = new Date(dateStr);
        return txDate >= since;
      });
    }

    return mappedTransactions;
  },

  async fetchBalances(
    accountId: string,
    credentials: BankCredentials,
  ): Promise<UnifiedBalance> {
    // Extract the DKB account ID from our unified ID format (dkb_UUID)
    const externalAccountId = accountId.startsWith("dkb_")
      ? accountId.slice(4)
      : accountId;

    // Fetch all accounts to get current balance
    const dkbAccounts = await fetchDkbAccounts(credentials);

    // Find the account matching the requested accountId
    const account = dkbAccounts.find((acc) => acc.id === externalAccountId);

    if (!account) {
      throw new Error(
        `Account not found: ${accountId} (external ID: ${externalAccountId})`,
      );
    }

    // Map the account to a balance object
    return mapDkbBalance(account, accountId);
  },
};
