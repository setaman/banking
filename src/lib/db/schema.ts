import Dexie, { Table } from 'dexie';
import type { Account, Transaction } from '../../types';

/**
 * Database schema version management
 * 
 * Version 1: Initial schema
 * - accounts: id, iban indexes
 * - transactions: id, accountId, bookingDate, category indexes
 */
export class FinanceDashboardDB extends Dexie {
  // Tables
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;

  constructor() {
    super('FinanceDashboardDB');

    // Define schema version 1
    this.version(1).stores({
      // Accounts table
      // Primary key: id
      // Indexes: iban for lookup
      accounts: 'id, iban, bank',

      // Transactions table
      // Primary key: id
      // Indexes: accountId (for filtering by account),
      //          bookingDate (for date range queries),
      //          category (for filtering and analytics),
      //          [accountId+bookingDate] (compound index for efficient queries)
      transactions:
        'id, accountId, bookingDate, category, [accountId+bookingDate]',
    });
  }
}

/**
 * Get the database schema version
 */
export function getSchemaVersion(): number {
  return 1;
}

/**
 * Database migration notes:
 * 
 * When adding new versions:
 * 1. Increment version number: this.version(2).stores({ ... })
 * 2. Only specify NEW or MODIFIED tables
 * 3. Use null to delete a table: deletedTable: null
 * 4. Dexie handles migrations automatically
 * 
 * Example for future v2:
 * this.version(2).stores({
 *   transactions: 'id, accountId, bookingDate, category, [accountId+bookingDate], merchantName'
 * }).upgrade(trans => {
 *   // Optional: transform existing data
 * });
 */
