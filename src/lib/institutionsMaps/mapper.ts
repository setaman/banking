import { z } from "zod";
import { TransactionI } from "@/src/types";
import { parseCsv } from "@/src/lib/parseCsv";
import { dbBankAccount, dkbBankAccount } from "./accounts";
import { dkbTransaction } from "./dkb/index";
import { dbTransaction } from "./db/index";

export const mapCsvExportToTransactions = (file: string, accountId: string): TransactionI[] => {
  const instTransaction = (function () {
    switch (accountId) {
    case dkbBankAccount.account_id:
      return dkbTransaction;
    case dbBankAccount.account_id:
      return dbTransaction;
    default:
      console.warn(`Account ${ accountId } does not exist`);
    }
  })();

  if (instTransaction){
    let transactions = parseCsv(file).filter((t) => {
      const parseResult = instTransaction.safeParse(t);
      if (!parseResult.success) {
        console.warn("Invalid transaction entry! Skipped!", t, parseResult.error);
      }
      return parseResult.success;
    });
    return z
      .array(instTransaction)
      .parse(transactions)
      .map((t) => ({
        ...t,
        account_id: accountId,
      }));
  }
  return [];
};
