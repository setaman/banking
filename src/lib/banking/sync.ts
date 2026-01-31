import { getDb, invalidateDbCache } from "@/lib/db";
import type {
  BankAdapter,
  BankCredentials,
  SyncMetadata,
  UnifiedTransaction,
  UnifiedAccount,
} from "@/lib/banking/types";
import { createTransactionId } from "@/lib/banking/utils";

export async function syncBank(
  adapter: BankAdapter,
  credentials: BankCredentials
): Promise<SyncMetadata> {
  const db = await getDb();
  const startTime = new Date();

  // Config toggles
  const TAG_INTERNAL_TRANSFERS = true; // mark internal transfers with category/raw marker

  try {
    // Fetch accounts
    const accounts = await adapter.fetchAccounts(credentials);
    let totalNewTransactions = 0;
    let totalFetched = 0;

    // Build lookup maps for owned account identifiers (IBAN and accountNr)
    const ownAccountIdsByIban = new Map<string, string>();
    const ownAccountIdsByAccountNr = new Map<string, string>();
    // Build holder name lookup for name-based detection (normalized lowercase)
    const holderNameToAccountIds = new Map<string, string[]>();

    for (const acc of accounts) {
      // acc.iban may be present on attributes
      // acc likely matches UnifiedAccount shape produced by the adapter
      if ((acc as any).iban) {
        const iban = String((acc as any).iban)
          .replace(/\s+/g, "")
          .toUpperCase();
        ownAccountIdsByIban.set(iban, acc.id);
      }

      // If the adapter included a referenceAccount under attributes, use it too
      const ref = (acc as any).referenceAccount;
      if (ref?.iban) {
        const rIban = String(ref.iban).replace(/\s+/g, "").toUpperCase();
        ownAccountIdsByIban.set(rIban, acc.id);
      }
      if (ref?.accountNumber) {
        const acctNr = String(ref.accountNumber);
        ownAccountIdsByAccountNr.set(acctNr, acc.id);
      }

      // Some adapters may expose account number directly on the unified account under `externalId` or similar; attempt to capture common keys
      const possibleAccountNr =
        (acc as any).accountNumber || (acc as any).accountNr;
      if (possibleAccountNr) {
        ownAccountIdsByAccountNr.set(String(possibleAccountNr), acc.id);
      }

      // Holder name mapping (normalize: trim + collapse spaces + lowercase)
      const holderName =
        (acc as any).holderName || (acc as any).name || undefined;
      if (holderName) {
        const n = String(holderName).replace(/\s+/g, " ").trim().toLowerCase();
        const existing = holderNameToAccountIds.get(n) || [];
        existing.push(acc.id);
        holderNameToAccountIds.set(n, existing);
      }
    }

    for (const account of accounts) {
      // Upsert account
      const existingIdx = db.data.accounts.findIndex(
        (a) => a.id === account.id
      );
      if (existingIdx >= 0) {
        db.data.accounts[existingIdx] = {
          ...account,
          lastSyncedAt: startTime.toISOString(),
        };
      } else {
        db.data.accounts.push({
          ...account,
          lastSyncedAt: startTime.toISOString(),
        });
      }

      // Fetch and store balance
      const balance = await adapter.fetchBalances(account.id, credentials);
      db.data.balances.push(balance);

      // Fetch transactions (since last sync or all)
      const lastSync = db.data.syncHistory
        .filter(
          (s) =>
            s.institutionId === adapter.institutionId && s.status === "success"
        )
        .sort((a, b) => b.lastSyncAt.localeCompare(a.lastSyncAt))[0];

      const since = lastSync ? new Date(lastSync.lastSyncAt) : undefined;
      const transactions = await adapter.fetchTransactions(
        account.id,
        credentials,
        since
      );

      totalFetched += transactions.length;

      // Map and tag internal transfers before dedup
      const mappedTransactions = transactions.map((t) => t);

      // Helper: detect and tag internal transfers using raw attributes from DKB
      function detectAndTagInternalTransfer(
        tx: UnifiedTransaction,
        currentAccount: UnifiedAccount
      ): boolean {
        try {
          if (!TAG_INTERNAL_TRANSFERS) return false;

          const raw = tx.raw as any;
          const attrs = raw?.attributes;
          if (!attrs) return false;

          // Simplified logic: consider it an internal transfer if both creditor and debtor names
          // exactly match the current account's holder name (or account.name) after normalization.
          const credName = attrs.creditor?.name;
          const debName = attrs.debtor?.name;
          if (!credName || !debName) return false;

          const normalize = (s: string) =>
            String(s).replace(/\s+/g, " ").trim().toLowerCase();

          const acctHolder =
            (currentAccount as any).holderName || currentAccount.name || "";
          const nAcct = normalize(acctHolder);
          const nCred = normalize(credName);
          const nDeb = normalize(debName);

          if (nCred === nAcct && nDeb === nAcct) {
            tx.category = tx.category || "internal-transfer";
            tx.raw = { ...tx.raw, __internalTransfer: true } as Record<
              string,
              unknown
            >;
            return true;
          }

          return false;
        } catch (e) {
          return false;
        }
      }

      // Deduplicate and insert
      const existingIds = new Set(db.data.transactions.map((t) => t.id));
      const newTransactions = mappedTransactions.filter((t) => {
        const id = t.id || createTransactionId(t);
        return !existingIds.has(id);
      });

      // Tag internal transfers for each new transaction
      for (const tx of newTransactions) {
        if (!tx.id) {
          tx.id = createTransactionId(tx);
        }

        // Detect and tag internal transfers using raw attributes
        detectAndTagInternalTransfer(tx, account);

        db.data.transactions.push(tx);
      }

      totalNewTransactions += newTransactions.length;
    }

    const metadata: SyncMetadata = {
      institutionId: adapter.institutionId,
      lastSyncAt: startTime.toISOString(),
      accountsSynced: accounts.length,
      transactionsFetched: totalFetched,
      newTransactions: totalNewTransactions,
      status: "success",
    };

    db.data.syncHistory.push(metadata);
    db.data.meta.lastModifiedAt = new Date().toISOString();
    await db.write();
    invalidateDbCache();

    return metadata;
  } catch (error) {
    const metadata: SyncMetadata = {
      institutionId: adapter.institutionId,
      lastSyncAt: startTime.toISOString(),
      accountsSynced: 0,
      transactionsFetched: 0,
      newTransactions: 0,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };

    db.data.syncHistory.push(metadata);
    await db.write();
    invalidateDbCache();

    return metadata;
  }
}
