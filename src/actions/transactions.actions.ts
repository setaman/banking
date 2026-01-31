"use server";

import { getDb } from "@/lib/db";
import type { UnifiedTransaction } from "@/lib/banking/types";

export interface TransactionFilters {
  accountId?: string;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  category?: string;
  direction?: "debit" | "credit";
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

export interface GetTransactionsOptions {
  excludeInternal?: boolean; // if true, filter out transactions with category 'internal-transfer'
}

export async function getTransactions(
  filters?: TransactionFilters,
  options?: GetTransactionsOptions
): Promise<UnifiedTransaction[]> {
  const db = await getDb();
  let transactions = [...db.data.transactions];

  if (filters) {
    if (filters.accountId) {
      transactions = transactions.filter(
        (t) => t.accountId === filters.accountId
      );
    }
    if (filters.startDate) {
      transactions = transactions.filter(
        (t) => t.bookingDate >= filters.startDate!
      );
    }
    if (filters.endDate) {
      transactions = transactions.filter(
        (t) => t.bookingDate <= filters.endDate!
      );
    }
    if (filters.category) {
      transactions = transactions.filter(
        (t) => t.category === filters.category
      );
    }
    if (filters.direction) {
      transactions = transactions.filter(
        (t) => t.direction === filters.direction
      );
    }
    if (filters.minAmount !== undefined) {
      transactions = transactions.filter(
        (t) => Math.abs(t.amount) >= filters.minAmount!
      );
    }
    if (filters.maxAmount !== undefined) {
      transactions = transactions.filter(
        (t) => Math.abs(t.amount) <= filters.maxAmount!
      );
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      transactions = transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(query) ||
          t.counterparty.toLowerCase().includes(query)
      );
    }
  }

  if (options?.excludeInternal) {
    transactions = transactions.filter(
      (t) =>
        t.category !== "internal-transfer" &&
        !(t.raw && (t.raw as any).__internalTransfer)
    );
  }

  return transactions.sort((a, b) =>
    b.bookingDate.localeCompare(a.bookingDate)
  );
}

export async function getTransactionCount(
  filters?: TransactionFilters,
  options?: GetTransactionsOptions
): Promise<number> {
  const transactions = await getTransactions(filters, options);
  return transactions.length;
}
