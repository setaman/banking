import { FinanceDashboardDB } from './schema';
import type { Account, Transaction } from '../../types';

/**
 * Singleton database instance
 * 
 * This is the main entry point for all database operations.
 * Import this instance to interact with IndexedDB.
 * 
 * Usage:
 * ```typescript
 * import { db } from '@/lib/db';
 * 
 * // Add account
 * await db.accounts.add(account);
 * 
 * // Query transactions
 * const transactions = await db.transactions
 *   .where('accountId')
 *   .equals(accountId)
 *   .toArray();
 * ```
 */
export const db = new FinanceDashboardDB();

/**
 * Database helper functions
 */

/**
 * Add or update an account (upsert)
 * Uses transaction ID as deduplication key
 */
export async function upsertAccount(account: Account): Promise<string> {
  return await db.accounts.put(account);
}

/**
 * Add or update multiple accounts in bulk
 */
export async function upsertAccounts(accounts: Account[]): Promise<string> {
  return await db.transaction('rw', db.accounts, async () => {
    await db.accounts.bulkPut(accounts);
    return `${accounts.length} accounts upserted`;
  });
}

/**
 * Add or update a transaction (upsert)
 * Uses transaction ID as deduplication key
 */
export async function upsertTransaction(
  transaction: Transaction
): Promise<string> {
  return await db.transactions.put(transaction);
}

/**
 * Add or update multiple transactions in bulk
 * Automatically deduplicates by ID
 */
export async function upsertTransactions(
  transactions: Transaction[]
): Promise<string> {
  return await db.transaction('rw', db.transactions, async () => {
    await db.transactions.bulkPut(transactions);
    return `${transactions.length} transactions upserted`;
  });
}

/**
 * Get all accounts
 */
export async function getAllAccounts(): Promise<Account[]> {
  return await db.accounts.toArray();
}

/**
 * Get account by ID
 */
export async function getAccountById(id: string): Promise<Account | undefined> {
  return await db.accounts.get(id);
}

/**
 * Get account by IBAN
 */
export async function getAccountByIban(
  iban: string
): Promise<Account | undefined> {
  return await db.accounts.where('iban').equals(iban).first();
}

/**
 * Get all transactions for a specific account
 */
export async function getTransactionsByAccount(
  accountId: string
): Promise<Transaction[]> {
  return await db.transactions.where('accountId').equals(accountId).toArray();
}

/**
 * Get transactions by account within a date range
 */
export async function getTransactionsByDateRange(
  accountId: string,
  startDate: Date,
  endDate: Date
): Promise<Transaction[]> {
  return await db.transactions
    .where('[accountId+bookingDate]')
    .between([accountId, startDate], [accountId, endDate], true, true)
    .toArray();
}

/**
 * Get transactions by category
 */
export async function getTransactionsByCategory(
  category: string
): Promise<Transaction[]> {
  return await db.transactions.where('category').equals(category).toArray();
}

/**
 * Get transactions by account and category
 */
export async function getTransactionsByAccountAndCategory(
  accountId: string,
  category: string
): Promise<Transaction[]> {
  return await db.transactions
    .where('accountId')
    .equals(accountId)
    .and((tx) => tx.category === category)
    .toArray();
}

/**
 * Delete an account and all its transactions
 */
export async function deleteAccount(accountId: string): Promise<void> {
  await db.transaction('rw', db.accounts, db.transactions, async () => {
    // Delete all transactions for this account
    await db.transactions.where('accountId').equals(accountId).delete();
    // Delete the account
    await db.accounts.delete(accountId);
  });
}

/**
 * Clear all data (useful for testing or reset)
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.accounts, db.transactions, async () => {
    await db.accounts.clear();
    await db.transactions.clear();
  });
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  accountCount: number;
  transactionCount: number;
}> {
  const [accountCount, transactionCount] = await Promise.all([
    db.accounts.count(),
    db.transactions.count(),
  ]);

  return {
    accountCount,
    transactionCount,
  };
}

// Export the database instance as default
export default db;
