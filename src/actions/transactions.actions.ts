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

export async function getTransactions(
  filters?: TransactionFilters,
): Promise<UnifiedTransaction[]> {
  const db = await getDb();
  let transactions = [...db.data.transactions];

  if (filters) {
    if (filters.accountId) {
      transactions = transactions.filter(
        (t) => t.accountId === filters.accountId,
      );
    }
    if (filters.startDate) {
      transactions = transactions.filter((t) => t.date >= filters.startDate!);
    }
    if (filters.endDate) {
      transactions = transactions.filter((t) => t.date <= filters.endDate!);
    }
    if (filters.category) {
      transactions = transactions.filter(
        (t) => t.category === filters.category,
      );
    }
    if (filters.direction) {
      transactions = transactions.filter(
        (t) => t.direction === filters.direction,
      );
    }
    if (filters.minAmount !== undefined) {
      transactions = transactions.filter(
        (t) => Math.abs(t.amount) >= filters.minAmount!,
      );
    }
    if (filters.maxAmount !== undefined) {
      transactions = transactions.filter(
        (t) => Math.abs(t.amount) <= filters.maxAmount!,
      );
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      transactions = transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(query) ||
          t.counterparty.toLowerCase().includes(query),
      );
    }
  }

  return transactions.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getTransactionCount(
  filters?: TransactionFilters,
): Promise<number> {
  const transactions = await getTransactions(filters);
  return transactions.length;
}
