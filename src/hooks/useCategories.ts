import { useCallback } from 'react';
import type { TransactionCategory } from '../types';
import { updateTransactionCategory } from '../lib/db';

/**
 * Category metadata with display information
 */
export interface CategoryInfo {
  value: TransactionCategory;
  label: string;
  icon: string;
  color: string;
  description: string;
}

/**
 * All available categories with icons and colors
 */
export const CATEGORY_INFO: CategoryInfo[] = [
  {
    value: 'groceries',
    label: 'Groceries',
    icon: '🛒',
    color: '#10b981', // green-500
    description: 'Supermarkets and food shopping',
  },
  {
    value: 'restaurants',
    label: 'Restaurants',
    icon: '🍽️',
    color: '#f59e0b', // amber-500
    description: 'Dining out and food delivery',
  },
  {
    value: 'transport',
    label: 'Transport',
    icon: '🚗',
    color: '#3b82f6', // blue-500
    description: 'Transportation and fuel',
  },
  {
    value: 'utilities',
    label: 'Utilities',
    icon: '💡',
    color: '#8b5cf6', // violet-500
    description: 'Bills, internet, and utilities',
  },
  {
    value: 'entertainment',
    label: 'Entertainment',
    icon: '🎬',
    color: '#ec4899', // pink-500
    description: 'Entertainment and leisure',
  },
  {
    value: 'shopping',
    label: 'Shopping',
    icon: '🛍️',
    color: '#06b6d4', // cyan-500
    description: 'Online and offline shopping',
  },
  {
    value: 'health',
    label: 'Health',
    icon: '⚕️',
    color: '#ef4444', // red-500
    description: 'Healthcare and medical',
  },
  {
    value: 'income',
    label: 'Income',
    icon: '💰',
    color: '#22c55e', // green-600
    description: 'Salary and income',
  },
  {
    value: 'transfer',
    label: 'Transfer',
    icon: '↔️',
    color: '#64748b', // slate-500
    description: 'Money transfers',
  },
  {
    value: 'other',
    label: 'Other',
    icon: '📋',
    color: '#9ca3af', // gray-400
    description: 'Uncategorized transactions',
  },
];

/**
 * Category statistics for a set of transactions
 */
export interface CategoryStatistics {
  category: TransactionCategory;
  count: number;
  totalAmount: number; // cents (absolute value)
  percentage: number; // 0-100
  info: CategoryInfo;
}

/**
 * Hook for managing transaction categories
 * 
 * @returns Category utilities and functions
 * 
 * @example
 * ```tsx
 * const { updateCategory, getCategoryInfo, categories } = useCategories();
 * 
 * // Update a transaction's category
 * await updateCategory('tx-123', 'groceries');
 * 
 * // Get category metadata
 * const info = getCategoryInfo('groceries');
 * console.log(info.icon, info.color);
 * ```
 */
export function useCategories() {
  /**
   * Update transaction category in database
   */
  const updateCategory = useCallback(
    async (transactionId: string, category: TransactionCategory): Promise<void> => {
      await updateTransactionCategory(transactionId, category);
    },
    []
  );

  /**
   * Get category info by category value
   */
  const getCategoryInfo = useCallback(
    (category: TransactionCategory): CategoryInfo => {
      return CATEGORY_INFO.find(c => c.value === category) || CATEGORY_INFO[CATEGORY_INFO.length - 1];
    },
    []
  );

  /**
   * Calculate category statistics from transactions
   */
  const calculateStatistics = useCallback(
    (transactions: Array<{ category?: TransactionCategory; amount: number }>): CategoryStatistics[] => {
      const categoryTotals = new Map<TransactionCategory, { count: number; total: number }>();

      // Initialize all categories
      CATEGORY_INFO.forEach(cat => {
        categoryTotals.set(cat.value, { count: 0, total: 0 });
      });

      // Calculate totals (only expenses - negative amounts)
      let totalExpenses = 0;
      transactions.forEach(tx => {
        // Only count expenses for statistics (negative amounts)
        if (tx.amount < 0) {
          const category = tx.category || 'other';
          const current = categoryTotals.get(category) || { count: 0, total: 0 };
          const absAmount = Math.abs(tx.amount);
          
          categoryTotals.set(category, {
            count: current.count + 1,
            total: current.total + absAmount,
          });
          
          totalExpenses += absAmount;
        }
      });

      // Convert to statistics array
      const statistics: CategoryStatistics[] = [];
      categoryTotals.forEach((data, category) => {
        const info = getCategoryInfo(category);
        statistics.push({
          category,
          count: data.count,
          totalAmount: data.total,
          percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
          info,
        });
      });

      // Sort by total amount (descending)
      return statistics.sort((a, b) => b.totalAmount - a.totalAmount);
    },
    [getCategoryInfo]
  );

  return {
    categories: CATEGORY_INFO,
    updateCategory,
    getCategoryInfo,
    calculateStatistics,
  };
}

/**
 * Get category color
 */
export function getCategoryColor(category: TransactionCategory): string {
  const info = CATEGORY_INFO.find(c => c.value === category);
  return info?.color || '#9ca3af';
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: TransactionCategory): string {
  const info = CATEGORY_INFO.find(c => c.value === category);
  return info?.icon || '📋';
}

/**
 * Get category label
 */
export function getCategoryLabel(category: TransactionCategory): string {
  const info = CATEGORY_INFO.find(c => c.value === category);
  return info?.label || 'Other';
}
