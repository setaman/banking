"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import { CsvTransactionImportResult, StatsI } from "@/src/types";
import { mapCsvExportToTransactions } from "@/src/lib/institutionsMaps/mapper";
import { Transactions } from "@/db/db";

export async function uploadCsvExport(
  formData: FormData,
  accountId: string
): Promise<CsvTransactionImportResult> {
  const file = formData.get("file") as File;

  const fileContents = await file.text();

  const transactions = mapCsvExportToTransactions(fileContents, accountId);

  const transactionsDb = new Transactions();

  const newTransactions = transactions.filter(
    (t) => !transactionsDb.getById(t.transaction_id)
  );

  transactionsDb.insertBulk(newTransactions);

  revalidatePath("/upload");
  revalidatePath(`/${accountId}`);

  return {
    newTransactionsCount: newTransactions.length,
  };
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
