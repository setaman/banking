import type { Transaction } from '@/types';
import type { TransactionFilters } from '@/components/transactions/TransactionFilters';

export type { TransactionFilters };

/**
 * Apply filters to a list of transactions
 * 
 * @param transactions - Array of transactions to filter
 * @param filters - Filter criteria
 * @returns Filtered transactions
 * 
 * @example
 * ```typescript
 * const filtered = applyTransactionFilters(allTransactions, {
 *   categories: ['groceries', 'restaurants'],
 *   searchQuery: 'rewe',
 *   minAmount: 1000, // 10.00 EUR
 * });
 * ```
 */
export function applyTransactionFilters(
  transactions: Transaction[],
  filters: TransactionFilters
): Transaction[] {
  return transactions.filter((transaction) => {
    // Category filter
    if (filters.categories.length > 0) {
      const category = transaction.category || 'other';
      if (!filters.categories.includes(category)) {
        return false;
      }
    }

    // Search query filter (case-insensitive)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const searchableText = [
        transaction.description,
        transaction.counterpartyName,
        transaction.merchantName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchableText.includes(query)) {
        return false;
      }
    }

    // Amount range filter (work with absolute values)
    const absAmount = Math.abs(transaction.amount);
    if (filters.minAmount !== undefined && absAmount < filters.minAmount) {
      return false;
    }
    if (filters.maxAmount !== undefined && absAmount > filters.maxAmount) {
      return false;
    }

    // Date range filter
    if (filters.dateFrom && transaction.bookingDate < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo) {
      // Set time to end of day for dateTo comparison
      const dateToEndOfDay = new Date(filters.dateTo);
      dateToEndOfDay.setHours(23, 59, 59, 999);
      if (transaction.bookingDate > dateToEndOfDay) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get filter statistics
 * 
 * @param allTransactions - All transactions
 * @param filteredTransactions - Filtered transactions
 * @returns Statistics about filtering
 */
export function getFilterStatistics(
  allTransactions: Transaction[],
  filteredTransactions: Transaction[]
): {
  total: number;
  filtered: number;
  percentage: number;
} {
  const total = allTransactions.length;
  const filtered = filteredTransactions.length;
  const percentage = total > 0 ? (filtered / total) * 100 : 0;

  return {
    total,
    filtered,
    percentage,
  };
}

/**
 * Create default filters
 */
export function createDefaultFilters(): TransactionFilters {
  return {
    categories: [],
    searchQuery: '',
    minAmount: undefined,
    maxAmount: undefined,
    dateFrom: undefined,
    dateTo: undefined,
  };
}
