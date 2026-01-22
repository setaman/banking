import { create } from 'zustand';
import type { Account } from '../types';
import {
  upsertAccount,
  getAllAccounts as dbGetAllAccounts,
  getAccountById as dbGetAccountById,
  deleteAccount as dbDeleteAccount,
  getTransactionsByAccount,
} from '../lib/db';

interface AccountsState {
  accounts: Account[];
  isLoading: boolean;
  error: string | null;
}

interface AccountsActions {
  addAccount: (
    account: Omit<Account, 'id' | 'createdAt'>
  ) => Promise<Account>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  getAccountById: (id: string) => Account | undefined;
  getAllAccounts: () => Promise<void>;
  updateAccountBalance: (accountId: string) => Promise<void>;
  setError: (error: string | null) => void;
}

type AccountsStore = AccountsState & AccountsActions;

/**
 * Zustand store for managing accounts
 * 
 * Provides CRUD operations for accounts with automatic balance calculation
 * from associated transactions.
 */
export const useAccountsStore = create<AccountsStore>((set, get) => ({
  // State
  accounts: [],
  isLoading: false,
  error: null,

  // Actions

  /**
   * Add a new account
   * Generates UUID and sets createdAt timestamp
   */
  addAccount: async (account) => {
    set({ isLoading: true, error: null });
    try {
      const newAccount: Account = {
        ...account,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      };

      await upsertAccount(newAccount);
      
      set((state) => ({
        accounts: [...state.accounts, newAccount],
        isLoading: false,
      }));

      return newAccount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add account';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Update an existing account
   */
  updateAccount: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const existingAccount = await dbGetAccountById(id);
      if (!existingAccount) {
        throw new Error(`Account with id ${id} not found`);
      }

      const updatedAccount: Account = {
        ...existingAccount,
        ...updates,
        id, // Ensure ID cannot be changed
        createdAt: existingAccount.createdAt, // Preserve createdAt
      };

      await upsertAccount(updatedAccount);

      set((state) => ({
        accounts: state.accounts.map((acc) =>
          acc.id === id ? updatedAccount : acc
        ),
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update account';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Delete an account and all associated transactions
   */
  deleteAccount: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await dbDeleteAccount(id);

      set((state) => ({
        accounts: state.accounts.filter((acc) => acc.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete account';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Get account by ID from in-memory store
   */
  getAccountById: (id) => {
    return get().accounts.find((acc) => acc.id === id);
  },

  /**
   * Load all accounts from database
   */
  getAllAccounts: async () => {
    set({ isLoading: true, error: null });
    try {
      const accounts = await dbGetAllAccounts();
      set({ accounts, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load accounts';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Recalculate and update account balance from transactions
   * Balance = sum of all transaction amounts (positive = income, negative = expense)
   */
  updateAccountBalance: async (accountId) => {
    set({ isLoading: true, error: null });
    try {
      const transactions = await getTransactionsByAccount(accountId);
      
      // Calculate balance: sum of all transaction amounts (in cents)
      const balance = transactions.reduce(
        (sum, transaction) => sum + transaction.amount,
        0
      );

      await get().updateAccount(accountId, { balance });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update account balance';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  /**
   * Set error state
   */
  setError: (error) => {
    set({ error });
  },
}));
