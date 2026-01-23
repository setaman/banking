import { z } from "zod";
import type { UnifiedAccount, UnifiedBalance, UnifiedTransaction } from "@/lib/banking/types";
import { createTransactionId } from "@/lib/banking/utils";

/**
 * DKB API Response Schemas
 *
 * These Zod schemas will be defined once the DKB API sample responses
 * are provided. They validate the raw API response and transform it
 * into the unified interface.
 */

// Placeholder: will be replaced with actual DKB response schema
export const DkbAccountResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  iban: z.string().optional(),
  balance: z.number().optional(),
  type: z.string().optional(),
});

export const DkbTransactionResponseSchema = z.object({
  id: z.string().optional(),
  date: z.string(),
  amount: z.number(),
  description: z.string(),
  counterparty: z.string().optional(),
  bookingDate: z.string().optional(),
});

// --- Mappers ---

export function mapDkbAccount(
  raw: z.infer<typeof DkbAccountResponseSchema>,
): UnifiedAccount {
  return {
    id: `dkb_${raw.id}`,
    externalId: raw.id,
    institutionId: "dkb",
    name: raw.name,
    type: mapAccountType(raw.type),
    currency: "EUR",
    iban: raw.iban,
  };
}

export function mapDkbTransaction(
  raw: z.infer<typeof DkbTransactionResponseSchema>,
  accountId: string,
): UnifiedTransaction {
  const tx: UnifiedTransaction = {
    id: "", // Will be set below
    accountId,
    date: raw.date,
    bookingDate: raw.bookingDate,
    amount: raw.amount,
    currency: "EUR",
    description: raw.description,
    counterparty: raw.counterparty ?? "",
    direction: raw.amount >= 0 ? "credit" : "debit",
    raw: raw as unknown as Record<string, unknown>,
  };

  tx.id = createTransactionId(tx);
  return tx;
}

export function mapDkbBalance(
  accountId: string,
  amount: number,
): UnifiedBalance {
  return {
    accountId,
    amount,
    currency: "EUR",
    fetchedAt: new Date().toISOString(),
  };
}

function mapAccountType(
  dkbType?: string,
): "checking" | "savings" | "credit" | "investment" {
  switch (dkbType?.toLowerCase()) {
    case "girokonto":
    case "checking":
      return "checking";
    case "tagesgeld":
    case "savings":
      return "savings";
    case "kreditkarte":
    case "credit":
      return "credit";
    case "depot":
    case "investment":
      return "investment";
    default:
      return "checking";
  }
}
