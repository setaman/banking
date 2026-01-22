import { useEffect } from 'react';
import { useAccountsStore } from '../store/accounts.store';
import type { Account } from '../types';

/**
 * React hook for managing accounts
 * 
 * Provides access to account store state and actions.
 * Automatically loads accounts on mount.
 * 
 * @param autoLoad - Whether to automatically load accounts on mount (default: true)
 * @returns Account store state and actions
 * 
 * @example
 * ```tsx
 * const { accounts, addAccount, isLoading } = useAccounts();
 * 
 * // Add a new account
 * await addAccount({
 *   name: 'Checking Account',
 *   bank: 'dkb',
 *   balance: 100000, // 1000.00 EUR in cents
 *   currency: 'EUR'
 * });
 * ```
 */
export function useAccounts(autoLoad: boolean = true) {
  const {
    accounts,
    isLoading,
    error,
    addAccount,
    updateAccount,
    deleteAccount,
    getAccountById,
    getAllAccounts,
    updateAccountBalance,
    setError,
  } = useAccountsStore();

  // Auto-load accounts on mount
  useEffect(() => {
    if (autoLoad && accounts.length === 0 && !isLoading) {
      getAllAccounts().catch(() => {
        // Error is already set in store, just prevent unhandled rejection
      });
    }
  }, [autoLoad, accounts.length, isLoading, getAllAccounts]);

  return {
    // State
    accounts,
    isLoading,
    error,

    // Actions
    addAccount,
    updateAccount,
    deleteAccount,
    getAccountById,
    getAllAccounts,
    updateAccountBalance,
    setError,
  };
}

/**
 * Hook to get a specific account by ID
 * 
 * @param accountId - The account ID to retrieve
 * @returns The account or undefined if not found
 * 
 * @example
 * ```tsx
 * const account = useAccount('account-123');
 * if (account) {
 *   console.log(account.name);
 * }
 * ```
 */
export function useAccount(accountId: string | undefined): Account | undefined {
  const { accounts, getAllAccounts, isLoading } = useAccountsStore();

  // Auto-load accounts if not loaded
  useEffect(() => {
    if (accounts.length === 0 && !isLoading) {
      getAllAccounts().catch(() => {
        // Error is already set in store
      });
    }
  }, [accounts.length, isLoading, getAllAccounts]);

  if (!accountId) {
    return undefined;
  }

  return accounts.find((acc) => acc.id === accountId);
}
