import { z } from "zod";
import {
  UnifiedAccountSchema,
  UnifiedTransactionSchema,
  UnifiedBalanceSchema,
  SyncMetadataSchema,
} from "@/lib/banking/types";

// --- Database Schema ---

export const DatabaseSchema = z.object({
  accounts: z.array(UnifiedAccountSchema).default([]),
  transactions: z.array(UnifiedTransactionSchema).default([]),
  balances: z.array(UnifiedBalanceSchema).default([]),
  syncHistory: z.array(SyncMetadataSchema).default([]),
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
  meta: {
    version: 1,
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    isDemoMode: false,
  },
};
