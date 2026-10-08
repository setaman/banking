"use server";

import {
  clearMissingBudgets,
  getDb,
  getDbMode,
  hadMissingBudgets,
  invalidateDbCache,
  setDbMode,
} from "@/lib/db";
import { generateDemoBudgets, generateDemoData } from "@/lib/db/seed";
import { revalidatePath } from "next/cache";

export async function enableDemoMode(): Promise<{
  success: boolean;
  transactionCount: number;
}> {
  // Switch to demo mode (uses db-demo.json)
  setDbMode("demo");

  const db = await getDb();

  // Only generate if demo DB is empty or outdated
  if (db.data.transactions.length === 0) {
    const demoData = generateDemoData();
    db.data = demoData;
    await db.write();
  } else if (hadMissingBudgets(db)) {
    // Demo DB created before budgets existed (field absent): seed once.
    // An explicit [] (user deleted all budgets) is preserved.
    db.data.budgets = generateDemoBudgets();
    clearMissingBudgets(db);
    await db.write();
  }

  invalidateDbCache();
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/insights");
  revalidatePath("/budgets");

  return {
    success: true,
    transactionCount: db.data.transactions.length,
  };
}

export async function disableDemoMode(): Promise<{ success: boolean }> {
  // Switch back to real mode (uses db.json)
  setDbMode("real");
  invalidateDbCache();
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/insights");
  revalidatePath("/budgets");

  return { success: true };
}

export async function isDemoMode(): Promise<boolean> {
  return getDbMode() === "demo";
}
