"use server";

import { Banks, Transactions } from "@/db/db";
import { calculateTransactionsStats } from "@/src/statistics/calculator";

export const getBanks = async () => {
  return Banks.get();
};

export const getBankById = async (accountId: string) => {
  return Banks.getById(accountId);
};

export const getBanksCount = async () => {
  return Banks.count();
};

export const getBankTransactions = async (accountId: string) => {
  const bt = Transactions.getByAccountId(accountId);
  return Transactions.getByAccountId(accountId);
};

export const getBankAccountStats = async (accountId: string) => {
  const transactions = await getBankTransactions(accountId);
  return calculateTransactionsStats(transactions);
};
