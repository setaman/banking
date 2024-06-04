"use server";

import { Banks, Transactions } from "@/db/db";
import { calculateTransactionsStats } from "@/src/statistics/calculator";

export const getBanks = async () => {
  return new Banks().get();
};

export const getBankById = async (accountId: string) => {
  return new Banks().getById(accountId);
};

export const getBanksCount = async () => {
  return new Banks().count();
};

export const getBankTransactions = async (accountId: string) => {
  const bt = new Transactions().getByAccountId(accountId);
  return new Transactions().getByAccountId(accountId);
};

export const getBankAccountStats = async (accountId: string) => {
  const transactions = await getBankTransactions(accountId);
  return calculateTransactionsStats(transactions);
};
