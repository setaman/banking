"use server";

import { getDb } from "@/lib/db";
import type { UnifiedTransaction } from "@/lib/banking/types";
import { classifyTransaction } from "@/lib/stats/categories";

export interface TransactionFilters {
  accountId?: string;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  category?: string;
  direction?: "debit" | "credit";
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

export interface GetTransactionsOptions {
  excludeInternal?: boolean; // if true, filter out transactions with category 'internal-transfer'
}

/**
 * Extracts merchant-related free text from a DKB transaction's raw API
 * payload for search purposes. `raw` is untyped on `UnifiedTransaction`
 * (`z.record(z.string(), z.unknown())`) since it stores each adapter's
 * original payload verbatim, so every layer of access here is narrowed
 * defensively — demo/seed data and other bank adapters simply won't have
 * this shape and will safely yield an empty array.
 *
 * Shape (see `src/lib/banking/adapters/dkb/mapper.ts`): `raw` is the full
 * DKB transaction response object, so the merchant fields live at
 * `raw.attributes.merchant.name` / `raw.attributes.merchant.category.name`
 * — NOT at the top level of `raw`.
 */
function extractRawMerchantText(raw: UnifiedTransaction["raw"]): string[] {
  if (!raw || typeof raw !== "object") return [];

  const attributes = (raw as Record<string, unknown>).attributes;
  if (!attributes || typeof attributes !== "object") return [];

  const merchant = (attributes as Record<string, unknown>).merchant;
  if (!merchant || typeof merchant !== "object") return [];

  const merchantRecord = merchant as Record<string, unknown>;
  const texts: string[] = [];

  if (typeof merchantRecord.name === "string") {
    texts.push(merchantRecord.name);
  }

  const category = merchantRecord.category;
  if (category && typeof category === "object") {
    const categoryName = (category as Record<string, unknown>).name;
    if (typeof categoryName === "string") {
      texts.push(categoryName);
    }
  }

  return texts;
}

/** Strips combining diacritical marks (e.g. the umlaut dots on "ü") after
 * Unicode NFD decomposition, so accented and unaccented spellings of the
 * same word compare equal (e.g. "München" / "Munchen"). */
function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Expands German umlauts/eszett to their common ASCII digraph spelling
 * (ä→ae, ö→oe, ü→ue, ß→ss). Combined with `stripDiacritics`, this lets a
 * search for "muenchen" match data spelled "München" and vice versa —
 * simple diacritic-stripping alone turns "München" into "Munchen" (7
 * letters), which is NOT a substring of the transliterated "Muenchen" (8
 * letters), so both normalizations are needed to cover real-world query
 * spelling variance.
 */
function transliterateGerman(value: string): string {
  return value
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

/**
 * Produces the set of case-insensitive, diacritic-normalized forms a piece
 * of search text (query term or haystack) should be compared under. Used
 * for both the needle and the haystack so any combination of spelling
 * conventions on either side still matches.
 */
function searchNormalizedVariants(value: string): string[] {
  const lower = value.toLowerCase();
  return Array.from(
    new Set([stripDiacritics(lower), transliterateGerman(lower)])
  );
}

export async function getTransactions(
  filters?: TransactionFilters,
  options?: GetTransactionsOptions
): Promise<UnifiedTransaction[]> {
  const db = await getDb();
  let transactions = [...db.data.transactions];

  if (filters) {
    if (filters.accountId) {
      transactions = transactions.filter(
        (t) => t.accountId === filters.accountId
      );
    }
    if (filters.startDate) {
      transactions = transactions.filter(
        (t) => t.bookingDate >= filters.startDate!
      );
    }
    if (filters.endDate) {
      transactions = transactions.filter(
        (t) => t.bookingDate <= filters.endDate!
      );
    }
    if (filters.category) {
      transactions = transactions.filter((t) => {
        // Real synced bank data almost never has `t.category` set (only
        // sync-flagged internal transfers persist a literal
        // "internal-transfer" category) — everywhere else in the codebase
        // the category is derived on read via `classifyTransaction`
        // (see `calculateTopCategories` / `search-transactions.ts`).
        // Filtering on the raw stored field alone silently returns zero
        // rows for virtually all real transactions; derive it the same way
        // instead. `t.category || classifyTransaction(...)` preserves the
        // internal-transfer marker exactly (it is truthy, so it short-
        // circuits before classification), so `excludeInternal` below
        // keeps working unchanged and classification can never resurrect
        // an internal transfer under a "real" category.
        const effectiveCategory =
          t.category || classifyTransaction(t.description, t.counterparty);
        return effectiveCategory === filters.category;
      });
    }
    if (filters.direction) {
      transactions = transactions.filter(
        (t) => t.direction === filters.direction
      );
    }
    if (filters.minAmount !== undefined) {
      transactions = transactions.filter(
        (t) => Math.abs(t.amount) >= filters.minAmount!
      );
    }
    if (filters.maxAmount !== undefined) {
      transactions = transactions.filter(
        (t) => Math.abs(t.amount) <= filters.maxAmount!
      );
    }
    if (filters.search) {
      // Multi-term OR search: whitespace-separated terms each get matched
      // independently, and a transaction matches if ANY term matches. This
      // is what makes thematic queries like "hotel flight taxi" (built by
      // an LLM tool call, not typed by a human) actually find something,
      // instead of only ever matching a single literal phrase.
      const terms = filters.search
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length > 0);

      if (terms.length > 0) {
        transactions = transactions.filter((t) => {
          const haystack = [
            t.description,
            t.counterparty,
            ...extractRawMerchantText(t.raw),
          ].join(" ");
          const haystackVariants = searchNormalizedVariants(haystack);

          return terms.some((term) =>
            searchNormalizedVariants(term).some((termVariant) =>
              haystackVariants.some((haystackVariant) =>
                haystackVariant.includes(termVariant)
              )
            )
          );
        });
      }
    }
  }

  if (options?.excludeInternal) {
    transactions = transactions.filter(
      (t) =>
        t.category !== "internal-transfer" &&
        !(t.raw && (t.raw as any).__internalTransfer)
    );
  }

  return transactions.sort((a, b) =>
    b.bookingDate.localeCompare(a.bookingDate)
  );
}

export async function getTransactionCount(
  filters?: TransactionFilters,
  options?: GetTransactionsOptions
): Promise<number> {
  const transactions = await getTransactions(filters, options);
  return transactions.length;
}
