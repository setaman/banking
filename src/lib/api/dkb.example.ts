/**
 * Example usage of DKB API Client and Parser
 * 
 * This demonstrates how to fetch and parse DKB transactions.
 * 
 * SECURITY NOTE: This is a LOCAL-ONLY app.
 * Credentials (cookie + XSRF token) are NEVER stored - only passed as parameters and discarded.
 */

import { fetchAllTransactions, type DKBCredentials } from './dkb';
import { parseDKBTransactions } from '../parsers/dkb.parser';

/**
 * Example: Sync DKB transactions for an account
 * 
 * This would typically be called from a UI component where the user
 * pastes their DKB credentials (cookie + XSRF token from browser DevTools).
 * 
 * @param credentials - Cookie and XSRF token pasted by user (stored only in memory)
 * @param accountId - DKB account ID to sync
 * @param targetAccountId - Our internal account ID for storage
 */
export const syncDKBTransactions = async (
  credentials: DKBCredentials,
  accountId: string,
  targetAccountId: string
): Promise<void> => {
  try {
    // Step 1: Fetch all transactions from DKB API (handles pagination automatically)
    const apiResponse = await fetchAllTransactions(credentials, {
      accountId,
      fromDate: '2024-01-01',
      toDate: '2026-12-31',
    });

    console.log(`Fetched ${apiResponse.data.length} transactions from DKB`);

    // Step 2: Parse DKB transactions to normalized format
    const transactions = parseDKBTransactions(apiResponse.data, targetAccountId);

    console.log(`Parsed ${transactions.length} transactions`);

    // Step 3: Store in IndexedDB (would be implemented in db layer)
    // await db.transactions.bulkPut(transactions);

    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Failed to sync DKB transactions', error);
    throw error;
  }
  // Credentials are now out of scope and will be garbage collected
};

/**
 * Example: Fetch only recent transactions (last 30 days)
 */
export const syncRecentDKBTransactions = async (
  credentials: DKBCredentials,
  accountId: string,
  targetAccountId: string
): Promise<void> => {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const apiResponse = await fetchAllTransactions(credentials, {
    accountId,
    fromDate: formatDate(thirtyDaysAgo),
    toDate: formatDate(today),
    pageSize: 50,
  });

  const transactions = parseDKBTransactions(apiResponse.data, targetAccountId);

  console.log(`Synced ${transactions.length} recent transactions`);
  
  // Store to IndexedDB...
};
