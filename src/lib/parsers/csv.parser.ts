/**
 * CSV Parser for Deutsche Bank Transactions
 * 
 * Parses Deutsche Bank CSV format and converts to normalized Transaction format.
 * Handles German number/date formats and auto-categorization.
 * 
 * NOTE: This implementation uses a reasonable schema based on common German banking CSV formats.
 * The actual Deutsche Bank CSV schema may differ and should be adjusted based on real data samples.
 * Expected columns: Buchungstag, Wertstellung, Umsatzart, Begünstigter/Zahlungspflichtiger, 
 *                   Verwendungszweck, Betrag, Saldo
 */

import type { Transaction, TransactionCategory } from '@/types';
import { generateTransactionHash } from '@/lib/db';

/**
 * Deutsche Bank CSV Row Interface
 * 
 * Based on typical German bank CSV format.
 * Adjust column names based on actual Deutsche Bank CSV export.
 */
interface DeutscheBankCSVRow {
  Buchungstag: string;           // Booking date (DD.MM.YYYY)
  Wertstellung: string;          // Value date (DD.MM.YYYY)
  Umsatzart?: string;            // Transaction type
  'Begünstigter/Zahlungspflichtiger'?: string; // Counterparty name
  Verwendungszweck: string;      // Description/Purpose
  Betrag: string;                // Amount (German format: 1.234,56)
  Saldo?: string;                // Balance (German format)
  IBAN?: string;                 // Counterparty IBAN (optional)
}

/**
 * Parses German date format (DD.MM.YYYY) to Date object
 * 
 * @param dateString - Date in DD.MM.YYYY format
 * @returns Date object
 * @throws {Error} If date format is invalid
 */
const parseGermanDate = (dateString: string): Date => {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  const parts = dateString.trim().split('.');
  
  if (parts.length !== 3) {
    throw new Error(`Invalid German date format: ${dateString}. Expected DD.MM.YYYY`);
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error(`Invalid date components in: ${dateString}`);
  }

  const date = new Date(year, month, day);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateString}`);
  }

  return date;
};

/**
 * Parses German number format to number in cents
 * 
 * Converts formats like:
 * - "1.234,56" → 123456 (cents)
 * - "-1.234,56" → -123456 (cents)
 * - "123,45" → 12345 (cents)
 * 
 * @param amountString - Amount in German format
 * @returns Amount in cents (integer)
 * @throws {Error} If amount format is invalid
 */
const parseGermanAmount = (amountString: string): number => {
  if (!amountString || typeof amountString !== 'string') {
    throw new Error(`Invalid amount string: ${amountString}`);
  }

  // Remove spaces and handle minus sign
  let cleaned = amountString.trim();
  const isNegative = cleaned.startsWith('-');
  
  if (isNegative) {
    cleaned = cleaned.substring(1).trim();
  }

  // Remove thousands separator (.)
  cleaned = cleaned.replace(/\./g, '');
  
  // Replace decimal comma with period
  cleaned = cleaned.replace(',', '.');

  const amount = parseFloat(cleaned);

  if (isNaN(amount)) {
    throw new Error(`Invalid amount after parsing: ${amountString}`);
  }

  // Convert to cents and apply sign
  const cents = Math.round(amount * 100);
  return isNegative ? -cents : cents;
};

/**
 * Basic auto-categorization based on transaction description and type
 * 
 * Uses simple keyword matching. This should be enhanced with a more
 * sophisticated categorization system in production.
 */
const categorizeTransaction = (
  description: string,
  transactionType?: string,
  counterpartyName?: string
): TransactionCategory => {
  const descLower = description.toLowerCase();
  const counterpartyLower = counterpartyName?.toLowerCase() || '';

  // Income patterns
  if (
    transactionType?.toLowerCase().includes('gehalt') ||
    descLower.includes('gehalt') ||
    descLower.includes('lohn') ||
    descLower.includes('salary')
  ) {
    return 'income';
  }

  // Groceries
  if (
    descLower.includes('rewe') ||
    descLower.includes('edeka') ||
    descLower.includes('aldi') ||
    descLower.includes('lidl') ||
    descLower.includes('penny') ||
    descLower.includes('netto') ||
    descLower.includes('kaufland') ||
    counterpartyLower.includes('rewe') ||
    counterpartyLower.includes('edeka')
  ) {
    return 'groceries';
  }

  // Restaurants
  if (
    descLower.includes('restaurant') ||
    descLower.includes('cafe') ||
    descLower.includes('pizza') ||
    descLower.includes('mcdonalds') ||
    descLower.includes('burger king')
  ) {
    return 'restaurants';
  }

  // Transport
  if (
    descLower.includes('tankstelle') ||
    descLower.includes('shell') ||
    descLower.includes('aral') ||
    descLower.includes('db ') ||
    descLower.includes('deutsche bahn') ||
    descLower.includes('uber') ||
    descLower.includes('taxi')
  ) {
    return 'transport';
  }

  // Utilities
  if (
    descLower.includes('strom') ||
    descLower.includes('gas') ||
    descLower.includes('wasser') ||
    descLower.includes('internet') ||
    descLower.includes('telefon') ||
    descLower.includes('vodafone') ||
    descLower.includes('telekom') ||
    transactionType?.toLowerCase().includes('lastschrift')
  ) {
    return 'utilities';
  }

  // Entertainment
  if (
    descLower.includes('netflix') ||
    descLower.includes('spotify') ||
    descLower.includes('amazon prime') ||
    descLower.includes('kino') ||
    descLower.includes('cinema')
  ) {
    return 'entertainment';
  }

  // Shopping
  if (
    descLower.includes('amazon') ||
    descLower.includes('ebay') ||
    descLower.includes('zalando') ||
    descLower.includes('h&m') ||
    descLower.includes('zara')
  ) {
    return 'shopping';
  }

  // Health
  if (
    descLower.includes('apotheke') ||
    descLower.includes('arzt') ||
    descLower.includes('kranken') ||
    descLower.includes('pharmacy')
  ) {
    return 'health';
  }

  // Transfer
  if (
    transactionType?.toLowerCase().includes('überweisung') ||
    descLower.includes('überweisung')
  ) {
    return 'transfer';
  }

  return 'other';
};

/**
 * Parses a single Deutsche Bank CSV row to normalized Transaction format
 * 
 * @param row - CSV row object
 * @param accountId - Account ID this transaction belongs to
 * @returns Normalized Transaction object
 * @throws {Error} If required fields are missing or invalid
 */
export const parseDeutscheBankCSVRow = async (
  row: DeutscheBankCSVRow,
  accountId: string
): Promise<Transaction> => {
  // Validate required fields
  if (!row.Buchungstag || !row.Verwendungszweck || !row.Betrag) {
    throw new Error('Missing required fields: Buchungstag, Verwendungszweck, or Betrag');
  }

  // Parse fields
  const bookingDate = parseGermanDate(row.Buchungstag);
  const valueDate = row.Wertstellung 
    ? parseGermanDate(row.Wertstellung)
    : bookingDate; // Fallback to booking date if value date missing
  
  const amount = parseGermanAmount(row.Betrag);
  const description = row.Verwendungszweck.trim();
  const counterpartyName = row['Begünstigter/Zahlungspflichtiger']?.trim();
  const counterpartyIban = row.IBAN?.trim();
  const transactionType = row.Umsatzart?.trim();

  // Auto-categorize
  const category = categorizeTransaction(description, transactionType, counterpartyName);

  // Generate unique transaction ID (hash-based deduplication)
  const id = await generateTransactionHash({
    accountId,
    bookingDate,
    amount,
    description,
  });

  return {
    id,
    accountId,
    bookingDate,
    valueDate,
    amount,
    currency: 'EUR',
    description,
    counterpartyName,
    counterpartyIban,
    category,
    transactionType,
    rawData: row as Record<string, any>,
    createdAt: new Date(),
  };
};

/**
 * Parses Deutsche Bank CSV content to array of normalized Transactions
 * 
 * @param csvRows - Parsed CSV rows (array of objects)
 * @param accountId - Account ID these transactions belong to
 * @returns Array of normalized Transaction objects
 * @throws {Error} If accountId is missing or rows format is invalid
 * 
 * @example
 * ```typescript
 * import Papa from 'papaparse';
 * 
 * const results = Papa.parse<DeutscheBankCSVRow>(csvContent, { header: true });
 * const transactions = await parseDeutscheBankCSV(results.data, accountId);
 * await db.transactions.bulkPut(transactions);
 * ```
 */
export const parseDeutscheBankCSV = async (
  csvRows: DeutscheBankCSVRow[],
  accountId: string
): Promise<Transaction[]> => {
  if (!Array.isArray(csvRows)) {
    throw new Error('CSV rows must be an array');
  }

  if (!accountId || accountId.trim() === '') {
    throw new Error('Account ID is required');
  }

  // Parse all rows, filtering out any empty/invalid rows
  const transactions: Transaction[] = [];
  
  for (const row of csvRows) {
    // Skip empty rows
    if (!row.Buchungstag || !row.Betrag) {
      continue;
    }

    try {
      const transaction = await parseDeutscheBankCSVRow(row, accountId);
      transactions.push(transaction);
    } catch (error) {
      console.warn('Failed to parse CSV row:', row, error);
      // Continue parsing other rows even if one fails
    }
  }

  return transactions;
};
