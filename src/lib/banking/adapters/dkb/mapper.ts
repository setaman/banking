import { z } from "zod";
import type { UnifiedAccount, UnifiedBalance, UnifiedTransaction } from "@/lib/banking/types";
import { createTransactionId } from "@/lib/banking/utils";

/**
 * DKB API Response Schemas
 *
 * Based on the real DKB API structure documented in DKB-API-SPEC.md
 * These schemas validate and transform the nested API responses.
 */

// Account response schema (nested structure: data[].attributes)
export const DkbAccountResponseSchema = z.object({
  type: z.literal("account"),
  id: z.string(), // UUID
  attributes: z.object({
    holderName: z.string(),
    iban: z.string(),
    currencyCode: z.string(),
    balance: z.object({
      currencyCode: z.string(),
      value: z.string(), // Decimal as string like "1234.56"
    }),
    availableBalance: z.object({
      currencyCode: z.string(),
      value: z.string(),
    }).optional(),
    nearTimeBalance: z.object({
      currencyCode: z.string(),
      value: z.string(),
    }).optional(),
    product: z.object({
      id: z.string(),
      type: z.string(), // e.g. "checking-account-private", "savings-account"
      displayName: z.string(),
    }),
    state: z.string(),
    updatedAt: z.string(), // YYYY-MM-DD
    openingDate: z.string().optional(),
    overdraftLimit: z.string().optional(),
    interestRate: z.string().optional(),
    permissions: z.array(z.string()).optional(),
  }),
});

// Transaction response schema (nested structure: data[].attributes)
export const DkbTransactionResponseSchema = z.object({
  type: z.literal("accountTransaction"),
  id: z.string(), // Timestamp-based: YYYY-MM-DD-HH.MM.SS.milliseconds
  attributes: z.object({
    status: z.string(), // "booked", "pending"
    bookingDate: z.string(), // YYYY-MM-DD
    valueDate: z.string(), // YYYY-MM-DD
    description: z.string(),
    endToEndId: z.string().optional(),
    transactionType: z.string().optional(), // e.g. "KARTENZAHLUNG", "UEBERWEISUNG"
    transactionTypeCode: z.string().optional(),
    purposeCode: z.string().optional(),
    businessTransactionCode: z.string().optional(),
    amount: z.object({
      currencyCode: z.string(), // "EUR"
      value: z.string(), // Decimal as string, negative = expense
    }),
    creditor: z.object({
      name: z.string().optional(),
      creditorAccount: z.object({
        accountNr: z.string().optional(),
        blz: z.string().optional(),
        iban: z.string().optional(),
      }).optional(),
      agent: z.object({
        bic: z.string().optional(),
      }).optional(),
      intermediaryName: z.string().optional(),
    }).optional(),
    debtor: z.object({
      name: z.string().optional(),
      debtorAccount: z.object({
        accountNr: z.string().optional(),
        blz: z.string().optional(),
        iban: z.string().optional(),
      }).optional(),
      agent: z.object({
        bic: z.string().optional(),
      }).optional(),
    }).optional(),
    isRevocable: z.boolean().optional(),
    merchant: z.object({
      name: z.string().optional(),
      category: z.object({
        name: z.string().optional(),
        imageUrl: z.string().optional(),
        subCategories: z.array(z.string()).optional(),
      }).optional(),
      logo: z.object({
        url: z.string().optional(),
        score: z.number().optional(),
      }).optional(),
    }).optional(),
  }),
});

// --- Mappers ---

export function mapDkbAccount(
  raw: z.infer<typeof DkbAccountResponseSchema>,
): UnifiedAccount {
  const { id, attributes } = raw;

  return {
    id: `dkb_${id}`,
    externalId: id,
    institutionId: "dkb",
    name: attributes.product.displayName,
    type: mapAccountType(attributes.product.type),
    currency: attributes.currencyCode,
    iban: attributes.iban,
  };
}

export function mapDkbTransaction(
  raw: z.infer<typeof DkbTransactionResponseSchema>,
  accountId: string,
): UnifiedTransaction {
  const { id, attributes } = raw;
  const amount = parseFloat(attributes.amount.value);
  const isDebit = amount < 0;

  // Extract counterparty: creditor.name for debits, debtor.name for credits
  const counterparty = isDebit
    ? (attributes.creditor?.name ?? "")
    : (attributes.debtor?.name ?? "");

  const tx: UnifiedTransaction = {
    id: "", // Will be set below
    accountId,
    date: attributes.valueDate, // Use valueDate as primary date
    bookingDate: attributes.bookingDate,
    amount,
    currency: attributes.amount.currencyCode,
    description: attributes.description,
    counterparty,
    direction: isDebit ? "debit" : "credit",
    raw: raw as unknown as Record<string, unknown>,
  };

  tx.id = createTransactionId(tx);
  return tx;
}

export function mapDkbBalance(
  raw: z.infer<typeof DkbAccountResponseSchema>,
  unifiedAccountId: string,
): UnifiedBalance {
  const amount = parseFloat(raw.attributes.balance.value);

  return {
    accountId: unifiedAccountId,
    amount,
    currency: raw.attributes.balance.currencyCode,
    fetchedAt: new Date().toISOString(),
  };
}

function mapAccountType(
  dkbType?: string,
): "checking" | "savings" | "credit" | "investment" {
  if (!dkbType) return "checking";

  // Map DKB product.type values to unified account types
  if (dkbType.includes("checking-account")) return "checking";
  if (dkbType.includes("savings-account")) return "savings";
  if (dkbType.includes("credit-card")) return "credit";
  if (dkbType.includes("depot") || dkbType.includes("investment")) return "investment";

  // Legacy mappings for German terms
  switch (dkbType.toLowerCase()) {
    case "girokonto":
      return "checking";
    case "tagesgeld":
      return "savings";
    case "kreditkarte":
      return "credit";
    case "depot":
      return "investment";
    default:
      return "checking";
  }
}
