"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { BudgetSchema, type Budget } from "@/lib/db/schema";
import {
  computeAllBudgetProgress,
  type BudgetProgress,
} from "@/lib/stats/budgets";

/** Validated client input for creating/updating a budget. */
const UpsertBudgetInputSchema = BudgetSchema.pick({
  category: true,
  monthlyLimit: true,
});

/** Input accepted by {@link upsertBudget}. */
export type UpsertBudgetInput = z.infer<typeof UpsertBudgetInputSchema>;

/** Structured result returned by budget mutations. */
export interface BudgetActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Revalidates all pages that display budget data. */
function revalidateBudgetPaths(): void {
  revalidatePath("/budgets");
  revalidatePath("/");
}

/**
 * Lists all budgets (honours demo mode via the shared DB accessor).
 *
 * @returns Budgets sorted by category.
 */
export async function getBudgets(): Promise<Budget[]> {
  const db = await getDb();
  return [...db.data.budgets].sort((a, b) =>
    a.category.localeCompare(b.category)
  );
}

/**
 * Creates or updates the budget for a category (one budget per category).
 * On update, `id` and `createdAt` are preserved.
 *
 * @param input - Unvalidated `{ category, monthlyLimit }`.
 * @returns The stored budget, or a validation/persistence error.
 */
export async function upsertBudget(
  input: unknown
): Promise<BudgetActionResult<Budget>> {
  const parsed = UpsertBudgetInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid budget",
    };
  }

  try {
    const db = await getDb();
    const now = new Date().toISOString();
    const existing = db.data.budgets.find(
      (b) => b.category === parsed.data.category
    );

    let budget: Budget;
    if (existing) {
      existing.monthlyLimit = parsed.data.monthlyLimit;
      existing.updatedAt = now;
      budget = existing;
    } else {
      budget = {
        id: randomUUID(),
        category: parsed.data.category,
        monthlyLimit: parsed.data.monthlyLimit,
        createdAt: now,
        updatedAt: now,
      };
      db.data.budgets.push(budget);
    }

    await db.write();
    revalidateBudgetPaths();
    return { success: true, data: budget };
  } catch (error) {
    console.error("[budgets] upsertBudget failed:", error);
    return { success: false, error: "Failed to save budget" };
  }
}

/**
 * Deletes a budget by id.
 *
 * @param id - Budget id.
 * @returns Success flag, or an error when the budget does not exist.
 */
export async function deleteBudget(id: string): Promise<BudgetActionResult> {
  const parsedId = z.string().min(1).safeParse(id);
  if (!parsedId.success) return { success: false, error: "Invalid budget id" };

  try {
    const db = await getDb();
    const index = db.data.budgets.findIndex((b) => b.id === parsedId.data);
    if (index === -1) return { success: false, error: "Budget not found" };

    db.data.budgets.splice(index, 1);
    await db.write();
    revalidateBudgetPaths();
    return { success: true };
  } catch (error) {
    console.error("[budgets] deleteBudget failed:", error);
    return { success: false, error: "Failed to delete budget" };
  }
}

/**
 * Progress of every budget for the current calendar month, most-used first.
 *
 * @returns Budget progress entries.
 */
export async function getBudgetProgress(): Promise<BudgetProgress[]> {
  const db = await getDb();
  return computeAllBudgetProgress(db.data.budgets, db.data.transactions);
}
