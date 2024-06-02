"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import {
  StatsI,
} from "@/src/types";
import { hash256 } from "@/src/lib/hash256";
import { getExpenses, getIncome, getTotalBalance, groupTransactionByDate, groupTransactionByDay } from "@/src/statistics/calculator";
import { mapCsvExportToTransactions } from "@/src/lib/institutionsMaps/mapper";

export async function uploadCsvExport(formData: FormData, accountId: string ) {
  const file = formData.get("file") as File;

  const fileContents = await file.text();
  const statsFileName = hash256(fileContents);

  if (!fs.existsSync(`uploads/${statsFileName}.json`)) {
    const transactions = mapCsvExportToTransactions(fileContents, accountId)

    const transactionsGroupByMonth = groupTransactionByDate(transactions);
    const transactionsGroupByDay = groupTransactionByDay(transactions);

    const stats: StatsI = {
      totalBalance: getTotalBalance(transactions),
      expenses: getExpenses(transactions),
      income: getIncome(transactions),
      transactionsGroupByMonth: transactionsGroupByMonth,
      transactionsGroupByDay: transactionsGroupByDay,
    };

    fs.writeFileSync(`uploads/${statsFileName}.json`, JSON.stringify(stats));
    revalidatePath("/upload");
  }

  return statsFileName;
}

export async function getUploadResult(id: string) {
  try {
    const file = fs.readFileSync(`uploads/${id}.json`, "utf-8");
    return JSON.parse(file) as StatsI;
  } catch (error) {
    console.error(error);
    return null;
  }
}
