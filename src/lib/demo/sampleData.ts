/**
 * Demo/Sample Data Generator
 * 
 * Generates realistic sample transactions for testing and demo purposes
 * without requiring actual DKB API credentials.
 */

import type { Account, Transaction } from '@/types';

/**
 * Generate sample DKB account
 */
export function generateSampleAccount(): Account {
  return {
    id: 'demo-account-dkb-001',
    name: 'DKB Girokonto (Demo)',
    bank: 'dkb',
    iban: 'DE40120300001059965846',
    balance: 653704, // 6,537.04 EUR in cents
    currency: 'EUR',
    lastSynced: new Date(),
    createdAt: new Date('2024-01-01'),
  };
}

/**
 * Generate sample transactions based on real DKB API structure
 * 
 * Creates diverse transactions across multiple categories:
 * - Groceries (REWE, Edeka, Lidl)
 * - Restaurants (cafes, fast food)
 * - Transport (gas stations, public transport)
 * - Utilities (electricity, internet)
 * - Income (salary)
 * - Shopping (Amazon, clothing)
 * - Entertainment (streaming, gym)
 */
export function generateSampleTransactions(accountId: string): Transaction[] {
  const now = new Date();
  const transactions: Transaction[] = [];

  // Sample data spanning last 90 days
  const categories = [
    // Groceries
    { merchant: 'REWE', amount: -4599, category: 'groceries' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'EDEKA', amount: -3249, category: 'groceries' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'LIDL', amount: -2189, category: 'groceries' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'ALDI SÜD', amount: -1899, category: 'groceries' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'PENNY', amount: -1567, category: 'groceries' as const, type: 'KARTENZAHLUNG' },
    
    // Restaurants
    { merchant: 'CAFE CENTRAL', amount: -850, category: 'restaurants' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'PIZZA EXPRESS', amount: -1250, category: 'restaurants' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'MCDONALDS', amount: -789, category: 'restaurants' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'STARBUCKS', amount: -550, category: 'restaurants' as const, type: 'KARTENZAHLUNG' },
    
    // Transport
    { merchant: 'SHELL TANKSTELLE', amount: -6500, category: 'transport' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'DEUTSCHE BAHN', amount: -4920, category: 'transport' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'BVG Fahrscheine', amount: -2900, category: 'transport' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'ARAL', amount: -7200, category: 'transport' as const, type: 'KARTENZAHLUNG' },
    
    // Utilities (monthly recurring)
    { merchant: 'Stadtwerke München', amount: -8900, category: 'utilities' as const, type: 'LASTSCHRIFT' },
    { merchant: 'Telekom Deutschland', amount: -4999, category: 'utilities' as const, type: 'LASTSCHRIFT' },
    { merchant: 'Allianz Versicherung', amount: -12500, category: 'utilities' as const, type: 'LASTSCHRIFT' },
    { merchant: 'Miete Wohnung', amount: -95000, category: 'utilities' as const, type: 'DAUERAUFTRAG' },
    
    // Shopping
    { merchant: 'AMAZON EU', amount: -2999, category: 'shopping' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'ZALANDO', amount: -6899, category: 'shopping' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'MEDIA MARKT', amount: -14999, category: 'shopping' as const, type: 'KARTENZAHLUNG' },
    { merchant: 'DM Drogerie', amount: -1234, category: 'shopping' as const, type: 'KARTENZAHLUNG' },
    
    // Entertainment
    { merchant: 'SPOTIFY', amount: -999, category: 'entertainment' as const, type: 'LASTSCHRIFT' },
    { merchant: 'NETFLIX', amount: -1799, category: 'entertainment' as const, type: 'LASTSCHRIFT' },
    { merchant: 'FITNESSSTUDIO', amount: -3990, category: 'entertainment' as const, type: 'LASTSCHRIFT' },
    { merchant: 'KINO', amount: -1200, category: 'entertainment' as const, type: 'KARTENZAHLUNG' },
    
    // Income
    { merchant: 'Gehalt', amount: 325000, category: 'income' as const, type: 'GUTSCHRIFT' },
  ];

  // Generate transactions over last 90 days
  let transactionId = 1;
  for (let daysAgo = 0; daysAgo < 90; daysAgo++) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    
    // Income once per month
    if (daysAgo % 30 === 0) {
      transactions.push(createTransaction(
        accountId,
        `demo-tx-${transactionId++}`,
        date,
        categories.find(c => c.category === 'income')!,
      ));
    }
    
    // Utilities on specific days
    if (daysAgo === 5 || daysAgo === 35 || daysAgo === 65) {
      categories.filter(c => c.category === 'utilities').forEach(cat => {
        transactions.push(createTransaction(
          accountId,
          `demo-tx-${transactionId++}`,
          date,
          cat,
        ));
      });
    }
    
    // Random daily expenses (groceries, restaurants, transport)
    if (Math.random() > 0.3) {
      const randomCategory = categories.filter(c => 
        ['groceries', 'restaurants', 'transport', 'shopping', 'entertainment'].includes(c.category)
      );
      const selected = randomCategory[Math.floor(Math.random() * randomCategory.length)];
      transactions.push(createTransaction(
        accountId,
        `demo-tx-${transactionId++}`,
        date,
        selected,
      ));
    }
  }

  return transactions;
}

/**
 * Create a single transaction from template
 */
function createTransaction(
  accountId: string,
  id: string,
  date: Date,
  template: { merchant: string; amount: number; category: any; type: string }
): Transaction {
  const dateStr = date.toISOString().split('T')[0];
  
  return {
    id,
    accountId,
    bookingDate: date,
    valueDate: date,
    amount: template.amount,
    currency: 'EUR',
    description: `${template.type} - ${template.merchant}`,
    counterpartyName: template.merchant,
    category: template.category,
    transactionType: template.type,
    merchantName: template.merchant,
    rawData: {
      type: 'accountTransaction',
      id,
      attributes: {
        bookingDate: dateStr,
        valueDate: dateStr,
        transactionType: template.type,
        amount: {
          value: (template.amount / 100).toFixed(2),
          currencyCode: 'EUR',
        },
      },
    },
    createdAt: new Date(),
  };
}

/**
 * Generate a second sample account (Deutsche Bank)
 */
export function generateDeutscheBankAccount(): Account {
  return {
    id: 'demo-account-db-002',
    name: 'Deutsche Bank Girokonto (Demo)',
    bank: 'deutsche-bank',
    iban: 'DE89370400440532013000',
    balance: 425000, // 4,250.00 EUR in cents
    currency: 'EUR',
    lastSynced: new Date(),
    createdAt: new Date('2024-01-01'),
  };
}

/**
 * Check if data is demo data
 */
export function isDemoAccount(accountId: string): boolean {
  return accountId.startsWith('demo-account-');
}

/**
 * Check if any demo data exists
 */
export async function hasDemoData(db: any): Promise<boolean> {
  const accounts = await db.accounts.toArray();
  return accounts.some((acc: Account) => isDemoAccount(acc.id));
}
