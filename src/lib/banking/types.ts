import { z } from "zod";

// --- Enums ---

export const AccountType = z.enum([
  "checking",
  "savings",
  "credit",
  "investment",
]);
export type AccountType = z.infer<typeof AccountType>;

export const TransactionDirection = z.enum(["debit", "credit"]);
export type TransactionDirection = z.infer<typeof TransactionDirection>;

// --- Unified Account ---

export const UnifiedAccountSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  institutionId: z.string(),
  name: z.string(),
  type: AccountType,
  currency: z.string().default("EUR"),
  iban: z.string().optional(),
  // Optional holder name (populated by some adapters like DKB)
  holderName: z.string().optional(),
  lastSyncedAt: z.string().datetime().optional(),
});
export type UnifiedAccount = z.infer<typeof UnifiedAccountSchema>;

// --- Unified Transaction ---

export const UnifiedTransactionSchema = z.object({
  id: z.string(), // SHA256 hash for deduplication
  accountId: z.string(),
  date: z.string(), // ISO 8601 date (YYYY-MM-DD)
  bookingDate: z.string().optional(), // Booking/valuta date
  amount: z.number(), // Negative = expense, positive = income
  currency: z.string().default("EUR"),
  description: z.string(),
  counterparty: z.string().default(""),
  category: z.string().optional(),
  direction: TransactionDirection,
  raw: z.record(z.string(), z.unknown()).optional(), // Original bank data
});
export type UnifiedTransaction = z.infer<typeof UnifiedTransactionSchema>;

// --- Unified Balance ---

export const UnifiedBalanceSchema = z.object({
  accountId: z.string(),
  amount: z.number(),
  currency: z.string().default("EUR"),
  fetchedAt: z.string().datetime(), // ISO 8601 timestamp
});
export type UnifiedBalance = z.infer<typeof UnifiedBalanceSchema>;

// --- Institution ---

export const InstitutionSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string().default("DE"),
});
export type Institution = z.infer<typeof InstitutionSchema>;

// --- Bank Adapter Interface ---

export interface BankCredentials {
  cookie: string;
  xsrfToken?: string;
}

export interface BankAdapter {
  institutionId: string;
  institutionName: string;

  fetchAccounts(
    credentials: BankCredentials,
  ): Promise<UnifiedAccount[]>;

  fetchTransactions(
    accountId: string,
    credentials: BankCredentials,
    since?: Date,
  ): Promise<UnifiedTransaction[]>;

  fetchBalances(
    accountId: string,
    credentials: BankCredentials,
  ): Promise<UnifiedBalance>;
}

// --- Sync Metadata ---

export const SyncMetadataSchema = z.object({
  institutionId: z.string(),
  lastSyncAt: z.string().datetime(),
  accountsSynced: z.number(),
  transactionsFetched: z.number(),
  newTransactions: z.number(),
  status: z.enum(["success", "error", "partial"]),
  error: z.string().optional(),
});
export type SyncMetadata = z.infer<typeof SyncMetadataSchema>;
