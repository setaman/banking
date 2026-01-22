/**
 * CSV Parsers Index
 * 
 * Exports all CSV parsers and provides a router function
 * to select the appropriate parser based on bank type.
 */

import type { BankType, Transaction } from '@/types';
import { parseDeutscheBankCSV } from './csv.parser';

/**
 * CSV row type - generic object with string values
 */
export type CSVRow = Record<string, string>;

/**
 * Parse CSV content using the appropriate bank parser
 * 
 * @param csvRows - Parsed CSV rows (array of objects)
 * @param bankType - Bank type (dkb, deutsche-bank, etc.)
 * @param accountId - Account ID for transactions
 * @returns Array of normalized Transaction objects
 * @throws {Error} If bank type is not supported
 * 
 * @example
 * ```typescript
 * import Papa from 'papaparse';
 * import { parseCSV } from '@/lib/parsers';
 * 
 * const results = Papa.parse(csvContent, { header: true });
 * const transactions = await parseCSV(results.data, 'deutsche-bank', accountId);
 * ```
 */
export async function parseCSV(
  csvRows: CSVRow[],
  bankType: BankType,
  accountId: string
): Promise<Transaction[]> {
  switch (bankType) {
    case 'deutsche-bank':
      return parseDeutscheBankCSV(csvRows as any, accountId);
    
    case 'dkb':
      // DKB uses API, not CSV - but can be added if needed
      throw new Error('DKB CSV parsing not implemented. Use API sync instead.');
    
    case 'other':
      throw new Error('Generic CSV parsing not implemented. Please select a specific bank type.');
    
    default:
      throw new Error(`Unsupported bank type: ${bankType}`);
  }
}

// Re-export specific parsers
export { parseDeutscheBankCSV } from './csv.parser';
export { parseDKBTransaction, parseDKBTransactions } from './dkb.parser';
