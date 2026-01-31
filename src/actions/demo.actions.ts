"use server";

import { getDb, setDbMode, getDbMode, invalidateDbCache } from "@/lib/db";
import { generateDemoData } from "@/lib/db/seed";
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
  }

  invalidateDbCache();
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/insights");

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

  return { success: true };
}

export async function isDemoMode(): Promise<boolean> {
  return getDbMode() === "demo";
}
