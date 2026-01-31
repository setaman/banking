import type {
  BankAdapter,
  BankCredentials,
  UnifiedAccount,
  UnifiedBalance,
  UnifiedTransaction,
} from "@/lib/banking/types";
import { fetchDkbAccounts, fetchDkbTransactions } from "./api";
import type { DkbTransaction } from "./api";
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

  async fetchAccounts(credentials: BankCredentials): Promise<UnifiedAccount[]> {
    const dkbAccounts = await fetchDkbAccounts(credentials);
    return dkbAccounts.map(mapDkbAccount);
  },

  async fetchTransactions(
    accountId: string,
    credentials: BankCredentials,
    since?: Date
  ): Promise<UnifiedTransaction[]> {
    // Extract the DKB account ID from our unified ID format (dkb_UUID)
    const externalAccountId = accountId.startsWith("dkb_")
      ? accountId.slice(4)
      : accountId;

    let dkbTransactions: DkbTransaction[] = [];

    // Helper: format YYYY-MM-DD
    const formatDate = (y: number, m: number, d: number) =>
      new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

    if (since) {
      // Subsequent sync: fetch from last sync date until today
      const from = since.toISOString().slice(0, 10);
      const to = new Date().toISOString().slice(0, 10);
      dkbTransactions = await fetchDkbTransactions(
        externalAccountId,
        credentials,
        { from, to }
      );
    } else {
      // Initial sync: fetch per calendar year starting with current year and going back until an empty year
      const currentYear = new Date().getUTCFullYear();
      const MAX_YEARS = 30; // safety cap

      for (let offset = 0; offset < MAX_YEARS; offset++) {
        const year = currentYear - offset;
        const from = `${year}-01-01`;
        const to = `${year}-12-31`;

        const yearTx = await fetchDkbTransactions(
          externalAccountId,
          credentials,
          { from, to }
        );

        if (!yearTx || yearTx.length === 0) {
          // Stop on first empty year per spec
          break;
        }

        dkbTransactions.push(...yearTx);
      }
    }

    // Map all transactions to unified format
    const mappedTransactions = dkbTransactions.map((tx) =>
      mapDkbTransaction(tx, accountId)
    );

    // Filter by 'since' date if provided (compare against bookingDate)
    if (since) {
      return mappedTransactions.filter((tx) => {
        const txDate = new Date(tx.bookingDate);
        return txDate >= since;
      });
    }

    return mappedTransactions;
  },

  async fetchBalances(
    accountId: string,
    credentials: BankCredentials
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
        `Account not found: ${accountId} (external ID: ${externalAccountId})`
      );
    }

    // Map the account to a balance object
    return mapDkbBalance(account, accountId);
  },
};
