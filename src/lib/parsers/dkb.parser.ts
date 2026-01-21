/**
 * DKB Transaction Parser
 * 
 * Converts DKB API transaction format to normalized Transaction format.
 * Handles date parsing, amount conversion (EUR to cents), and category mapping.
 */

import type { DKBApiTransaction, Transaction, TransactionCategory } from '@/types';

/**
 * Maps DKB transaction types to transaction categories
 * 
 * Basic mapping - more sophisticated categorization happens later
 * based on merchant names for card payments.
 */
const TRANSACTION_TYPE_TO_CATEGORY: Record<string, TransactionCategory> = {
  'KARTENZAHLUNG': 'other',     // Will be categorized by merchant later
  'RECHNUNG': 'utilities',
  'ÜBERWEISUNG': 'transfer',
  'GEHALT': 'income',
  'LASTSCHRIFT': 'utilities',   // Direct debit
  'GUTSCHRIFT': 'income',
};

/**
 * Gets category from transaction type
 */
const mapTransactionTypeToCategory = (transactionType: string): TransactionCategory => {
  return TRANSACTION_TYPE_TO_CATEGORY[transactionType] || 'other';
};

/**
 * Converts amount from EUR string to cents (integer)
 * 
 * @param amountString - Amount as string (e.g., "-7.11", "100.00")
 * @returns Amount in cents (e.g., -711, 10000)
 */
const convertAmountToCents = (amountString: string): number => {
  const amount = parseFloat(amountString);
  
  if (isNaN(amount)) {
    throw new Error(`Invalid amount: ${amountString}`);
  }

  // Multiply by 100 and round to handle floating point precision
  return Math.round(amount * 100);
};

/**
 * Parses ISO date string to Date object
 * 
 * @param dateString - ISO date string (YYYY-MM-DD)
 * @returns Date object
 */
const parseISODate = (dateString: string): Date => {
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateString}`);
  }

  return date;
};

/**
 * Determines counterparty name from transaction
 * 
 * For outgoing payments (negative amount): use creditor name
 * For incoming payments (positive amount): use debtor name
 */
const getCounterpartyName = (transaction: DKBApiTransaction): string | undefined => {
  const amount = parseFloat(transaction.attributes.amount.value);

  if (amount < 0) {
    // Outgoing payment - money goes to creditor
    return transaction.attributes.creditor?.name;
  } else {
    // Incoming payment - money comes from debtor
    return transaction.attributes.debtor?.name;
  }
};

/**
 * Determines counterparty IBAN from transaction
 * 
 * For outgoing payments (negative amount): use creditor IBAN
 * For incoming payments (positive amount): use debtor IBAN
 */
const getCounterpartyIban = (transaction: DKBApiTransaction): string | undefined => {
  const amount = parseFloat(transaction.attributes.amount.value);

  if (amount < 0) {
    // Outgoing payment - money goes to creditor
    return transaction.attributes.creditor?.creditorAccount?.iban;
  } else {
    // Incoming payment - money comes from debtor
    return transaction.attributes.debtor?.debtorAccount?.iban;
  }
};

/**
 * Extracts merchant name from card payment descriptions
 * 
 * For KARTENZAHLUNG transactions, the creditor name is typically the merchant.
 */
const extractMerchantName = (transaction: DKBApiTransaction): string | undefined => {
  if (transaction.attributes.transactionType !== 'KARTENZAHLUNG') {
    return undefined;
  }

  // For card payments, creditor name is the merchant
  return transaction.attributes.creditor?.name;
};

/**
 * Parses a single DKB API transaction to normalized Transaction format
 * 
 * @param dkbTransaction - Raw DKB API transaction
 * @param accountId - Account ID this transaction belongs to
 * @returns Normalized Transaction object
 * 
 * @throws {Error} If required fields are missing or invalid
 */
export const parseDKBTransaction = (
  dkbTransaction: DKBApiTransaction,
  accountId: string
): Transaction => {
  // Validate required fields
  if (!dkbTransaction.id) {
    throw new Error('Transaction ID is required');
  }

  if (!dkbTransaction.attributes) {
    throw new Error('Transaction attributes are required');
  }

  const attrs = dkbTransaction.attributes;

  if (!attrs.bookingDate || !attrs.valueDate || !attrs.amount) {
    throw new Error('Missing required transaction fields');
  }

  // Parse and convert fields
  const bookingDate = parseISODate(attrs.bookingDate);
  const valueDate = parseISODate(attrs.valueDate);
  const amount = convertAmountToCents(attrs.amount.value);
  const category = mapTransactionTypeToCategory(attrs.transactionType);
  const counterpartyName = getCounterpartyName(dkbTransaction);
  const counterpartyIban = getCounterpartyIban(dkbTransaction);
  const merchantName = extractMerchantName(dkbTransaction);

  // Build normalized transaction
  return {
    id: dkbTransaction.id,
    accountId,
    bookingDate,
    valueDate,
    amount,
    currency: attrs.amount.currencyCode,
    description: attrs.description,
    counterpartyName,
    counterpartyIban,
    category,
    transactionType: attrs.transactionType,
    transactionTypeCode: attrs.transactionTypeCode,
    merchantName,
    rawData: dkbTransaction,
    createdAt: new Date(),
  };
};

/**
 * Parses multiple DKB API transactions
 * 
 * @param dkbTransactions - Array of raw DKB API transactions
 * @param accountId - Account ID these transactions belong to
 * @returns Array of normalized Transaction objects
 * 
 * @example
 * ```typescript
 * const apiResponse = await fetchAllTransactions(token, params);
 * const transactions = parseDKBTransactions(apiResponse.data, accountId);
 * await db.transactions.bulkPut(transactions);
 * ```
 */
export const parseDKBTransactions = (
  dkbTransactions: DKBApiTransaction[],
  accountId: string
): Transaction[] => {
  if (!Array.isArray(dkbTransactions)) {
    throw new Error('DKB transactions must be an array');
  }

  if (!accountId || accountId.trim() === '') {
    throw new Error('Account ID is required');
  }

  return dkbTransactions.map(transaction => 
    parseDKBTransaction(transaction, accountId)
  );
};
