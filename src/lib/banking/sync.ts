import { getDb } from "@/lib/db";
import type {
  BankAdapter,
  BankCredentials,
  SyncMetadata,
  UnifiedTransaction,
} from "@/lib/banking/types";
import { createTransactionId } from "@/lib/banking/utils";

export async function syncBank(
  adapter: BankAdapter,
  credentials: BankCredentials,
): Promise<SyncMetadata> {
  const db = await getDb();
  const startTime = new Date();

  try {
    // Fetch accounts
    const accounts = await adapter.fetchAccounts(credentials);
    let totalNewTransactions = 0;
    let totalFetched = 0;

    for (const account of accounts) {
      // Upsert account
      const existingIdx = db.data.accounts.findIndex(
        (a) => a.id === account.id,
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
            s.institutionId === adapter.institutionId &&
            s.status === "success",
        )
        .sort((a, b) => b.lastSyncAt.localeCompare(a.lastSyncAt))[0];

      const since = lastSync ? new Date(lastSync.lastSyncAt) : undefined;
      const transactions = await adapter.fetchTransactions(
        account.id,
        credentials,
        since,
      );

      totalFetched += transactions.length;

      // Deduplicate and insert
      const existingIds = new Set(db.data.transactions.map((t) => t.id));
      const newTransactions = transactions.filter((t) => {
        const id = t.id || createTransactionId(t);
        return !existingIds.has(id);
      });

      for (const tx of newTransactions) {
        if (!tx.id) {
          tx.id = createTransactionId(tx);
        }
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

    return metadata;
  }
}
