"use server";

import { getDb, resetDb } from "@/lib/db";
import { generateDemoData } from "@/lib/db/seed";

export async function enableDemoMode(): Promise<{ success: boolean; transactionCount: number }> {
  const db = await getDb();
  const demoData = generateDemoData();

  db.data = demoData;
  await db.write();

  return {
    success: true,
    transactionCount: demoData.transactions.length,
  };
}

export async function disableDemoMode(): Promise<{ success: boolean }> {
  await resetDb();
  return { success: true };
}

export async function isDemoMode(): Promise<boolean> {
  const db = await getDb();
  return db.data.meta.isDemoMode;
}
