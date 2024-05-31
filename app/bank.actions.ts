"use server";

import { Banks, Transactions } from "@/db/db";
import { init as initDkb } from "@/src/lib/institutionsMaps/dkb";

initDkb();

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
  return Transactions.getByAccountId(accountId);
};