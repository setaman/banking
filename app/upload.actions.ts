"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import {
  Institution,
  StatsI,
  TransactionI,
  TransactionsByMonthI,
} from "@/src/types";
import { mapDkbCsvExportToTransactions } from "@/src/lib/institutionsMaps/dkb";
import { hash256 } from "@/src/lib/hash256";
import { format } from "date-fns";
import { getExpenses, getIncome, getTotalBalance } from "@/src/statistics/calculator";

const groupTransactionByDate = (transactions: TransactionI[]) => {
  const groups: TransactionsByMonthI[] = [];

  for (const t of transactions) {
    const groupName = format(t.authorized_date, "MM.yyyy");
    const group = groups.find((g) => g.group === groupName);
    if (group) {
      group.transactions.push(t);
    } else {
      groups.push({
        group: groupName,
        date: t.authorized_date,
        transactions: [t],
      });
    }
  }

  return groups;
};

export async function uploadCsvExport(formData: FormData, inst: Institution) {
  const file = formData.get("file") as File;

  const fileContents = await file.text();
  const statsFileName = hash256(fileContents);

  if (!fs.existsSync(`uploads/${statsFileName}.json`)) {
    const transactions = mapDkbCsvExportToTransactions(fileContents);
    const transactionsByMonth = groupTransactionByDate(transactions);

    const stats: StatsI = {
      totalBalance: getTotalBalance(transactions),
      expenses: getExpenses(transactions),
      income: getIncome(transactions),
      transactionsByMonth: transactionsByMonth,
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
