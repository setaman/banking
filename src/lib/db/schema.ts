import { z } from "zod";
import {
  UnifiedAccountSchema,
  UnifiedTransactionSchema,
  UnifiedBalanceSchema,
  SyncMetadataSchema,
} from "@/lib/banking/types";
import { CATEGORIES } from "@/lib/stats/categories";

// --- Budgets ---

/** Maximum allowed monthly budget limit (EUR). */
export const MAX_BUDGET_LIMIT = 1_000_000;

/** Monthly spending limit for a single category (one budget per category). */
export const BudgetSchema = z.object({
  id: z.string().min(1),
  category: z
    .enum(CATEGORIES)
    .refine((c) => c !== "Income", "Budgets cannot target Income"),
  monthlyLimit: z.number().positive().max(MAX_BUDGET_LIMIT),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Budget = z.infer<typeof BudgetSchema>;

// --- Database Schema ---

export const DatabaseSchema = z.object({
  accounts: z.array(UnifiedAccountSchema).default([]),
  transactions: z.array(UnifiedTransactionSchema).default([]),
  balances: z.array(UnifiedBalanceSchema).default([]),
  syncHistory: z.array(SyncMetadataSchema).default([]),
  budgets: z.array(BudgetSchema).default([]),
  meta: z
    .object({
      version: z.number().default(1),
      createdAt: z.string().datetime().optional(),
      lastModifiedAt: z.string().datetime().optional(),
      lastSyncAt: z.string().datetime().optional(),
      isDemoMode: z.boolean().default(false),
    })
    .default({ version: 1, isDemoMode: false }),
});

export type Database = z.infer<typeof DatabaseSchema>;

export const DEFAULT_DB: Database = {
  accounts: [],
  transactions: [],
  balances: [],
  syncHistory: [],
  budgets: [],
  meta: {
    version: 1,
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    isDemoMode: false,
  },
};
